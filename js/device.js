/* device.js — hardware abstraction layer.
 *
 * On the Raspberry Pi this talks to the real GLONASS GPS dongle (via the
 * browser's Geolocation API, fed by gpsd→geoclue), Web Bluetooth (paired
 * phone for quick-dial / hands-free), Web Audio (USB speaker + mic), and a
 * weather API. When that hardware isn't present (e.g. a laptop browser) it
 * transparently falls back to a realistic simulation so the whole UI is
 * fully demoable. Everything funnels through one event bus.
 */
const Device = (() => {
  const listeners = {};
  const emit = (ev, data) => (listeners[ev] || []).forEach((fn) => fn(data));
  const on = (ev, fn) => ((listeners[ev] = listeners[ev] || []).push(fn), fn);

  const state = {
    coords: { lat: 32.0853, lng: 34.7818 }, // Tel Aviv default
    heading: 45,
    speedKmh: 0,
    satellites: 0,
    hasFix: false,
    btConnected: false,
    btDevice: null,
    weather: null,
    battery: 1,
    manual: false,
  };

  /* ---------------- GPS (real device geolocation only — no simulation) ---------------- */
  let fallbackTimer = null, lastReal = 0, watchId = null, triedLowAccuracy = false;

  function startGPS() {
    const man = (typeof Store !== 'undefined') && Store.get('manualLocation');
    if (man) { applyManual(man, false); return; }
    if (!navigator.geolocation) { emit('gpsstatus', { state: 'unsupported' }); return; }
    if (!window.isSecureContext) { emit('gpsstatus', { state: 'insecure' }); App.toast && App.toast('⚠️ Location needs HTTPS'); }
    requestLocation();
  }

  function stopWatch() {
    clearTimeout(fallbackTimer);
    if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  // Pin the rider to a manually chosen place.
  function applyManual(man, persist = true) {
    stopWatch();
    if (persist) Store.set('manualLocation', man);
    state.coords = { lat: man.lat, lng: man.lng };
    state.manual = true; state.hasFix = true; state.speedKmh = 0; state.accuracy = 0;
    emit('gps', { ...state });
    emit('gpsstatus', { state: 'manual', label: man.label });
    fetchWeather();
  }
  function setManualLocation(lat, lng, label) { applyManual({ lat, lng, label: label || 'Set location' }); }
  function clearManualLocation() {
    state.manual = false;
    if (typeof Store !== 'undefined') Store.set('manualLocation', null);
    lastReal = 0; triedLowAccuracy = false;
    startGPS();
  }

  // (Re)request location: a fast one-shot fix, plus a continuous high-accuracy watch.
  function requestLocation() {
    emit('gpsstatus', { state: 'locating' });
    navigator.geolocation.getCurrentPosition(onRealFix, onGeoError, { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 });
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(onRealFix, onGeoError, { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 });
  }

  function onRealFix(pos) {
    const c = pos.coords;
    if (state.manual) {
      // Real GPS takes over from a manual pin only once it's accurate enough to trust.
      if (!(c.accuracy != null && c.accuracy <= 80)) return;
      state.manual = false;
      if (typeof Store !== 'undefined') Store.set('manualLocation', null);
    }
    clearTimeout(fallbackTimer);
    const firstFix = lastReal === 0;
    lastReal = Date.now();
    if (c.speed != null && !Number.isNaN(c.speed)) state.speedKmh = Math.max(0, c.speed * 3.6);
    else if (state.lastCoords) {
      const d = haversineKm(state.lastCoords, { lat: c.latitude, lng: c.longitude });
      const dt = (pos.timestamp - (state.lastTs || pos.timestamp)) / 1000;
      if (dt > 0) state.speedKmh = Math.min(120, (d / dt) * 3600);
    }
    if (c.heading != null && !Number.isNaN(c.heading)) state.heading = c.heading;
    state.lastCoords = { lat: c.latitude, lng: c.longitude };
    state.lastTs = pos.timestamp;
    state.coords = { lat: c.latitude, lng: c.longitude };
    state.accuracy = c.accuracy || null;
    state.satellites = c.accuracy && c.accuracy < 25 ? 11 : 7;
    state.hasFix = true;
    emit('gps', { ...state });
    emit('gpsstatus', { state: (c.accuracy && c.accuracy > 200) ? 'coarse' : 'live', accuracy: c.accuracy });
    if (firstFix) fetchWeather();
  }

  function onGeoError(err) {
    // err.code: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
    if (err && err.code === 3 && !triedLowAccuracy) {
      triedLowAccuracy = true; // high-accuracy timed out → retry coarse/network (faster)
      navigator.geolocation.getCurrentPosition(onRealFix, onGeoError, { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 });
      return;
    }
    emit('gpsstatus', { state: err && err.code === 1 ? 'denied' : err && err.code === 2 ? 'unavailable' : 'timeout' });
  }

  // Called from the UI to (re)prompt for location, e.g. after enabling permission.
  function retryLocation() {
    if (state.manual) return clearManualLocation();
    triedLowAccuracy = false; clearTimeout(fallbackTimer); requestLocation();
  }

  /* ---------------- Heart-rate monitor (BLE) ---------------- */
  // Connects to a standard Bluetooth Heart Rate sensor (GATT 0x180D / 0x2A37):
  // chest straps, many watches, etc. Pulls live BPM and emits 'hr'.
  let hrChar = null;
  async function connectHeartRate() {
    if (!navigator.bluetooth) { App.toast && App.toast('Web Bluetooth not supported in this browser'); return false; }
    try {
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }], optionalServices: ['battery_service'] });
      const server = await dev.gatt.connect();
      const svc = await server.getPrimaryService('heart_rate');
      hrChar = await svc.getCharacteristic('heart_rate_measurement');
      await hrChar.startNotifications();
      hrChar.addEventListener('characteristicvaluechanged', (e) => {
        const v = e.target.value, flags = v.getUint8(0);
        state.bpm = (flags & 0x1) ? v.getUint16(1, true) : v.getUint8(1);
        emit('hr', state.bpm);
      });
      state.hrConnected = true; state.hrDevice = dev.name || 'Heart Rate';
      dev.addEventListener('gattserverdisconnected', () => { state.hrConnected = false; state.bpm = 0; emit('hr', null); emit('hrstatus', { ...state }); });
      emit('hrstatus', { ...state });
      return true;
    } catch (e) { return false; } // user cancelled or no device
  }
  function disconnectHeartRate() {
    try { if (hrChar && hrChar.service && hrChar.service.device.gatt.connected) hrChar.service.device.gatt.disconnect(); } catch (e) {}
    state.hrConnected = false; state.bpm = 0; emit('hr', null); emit('hrstatus', { ...state });
  }

  function haversineKm(a, b) {
    const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  /* ---------------- Bluetooth (phone) ---------------- */
  async function connectBluetooth() {
    if (navigator.bluetooth) {
      try {
        const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
        state.btConnected = true; state.btDevice = dev.name || 'Phone';
        emit('bt', { ...state });
        return true;
      } catch (e) { /* user cancelled — fall through to sim */ }
    }
    // simulate a pairing
    state.btConnected = true; state.btDevice = "iPhone";
    emit('bt', { ...state });
    return true;
  }
  function disconnectBluetooth() { state.btConnected = false; state.btDevice = null; emit('bt', { ...state }); }

  // Place a call over the phone's Bluetooth HFP (simulated UI here).
  function dial(contact) {
    emit('call', contact);
    return state.btConnected;
  }

  /* ---------------- Weather ---------------- */
  async function fetchWeather() {
    try {
      const { lat, lng } = state.coords;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,weather_code,wind_speed_10m`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('weather');
      const j = await r.json();
      state.weather = mapWeather(j.current);
    } catch (e) {
      state.weather = { temp: 24, code: 0, wind: 8, ...glyphFor(0) };
    }
    emit('weather', state.weather);
  }
  function mapWeather(c) {
    return { temp: Math.round(c.temperature_2m), code: c.weather_code, wind: Math.round(c.wind_speed_10m), ...glyphFor(c.weather_code) };
  }
  function glyphFor(code) {
    if (code === 0) return { glyph: '☀️', desc: 'Clear' };
    if (code <= 2) return { glyph: '🌤️', desc: 'Partly cloudy' };
    if (code === 3) return { glyph: '☁️', desc: 'Cloudy' };
    if (code <= 48) return { glyph: '🌫️', desc: 'Fog' };
    if (code <= 67) return { glyph: '🌧️', desc: 'Rain' };
    if (code <= 77) return { glyph: '🌨️', desc: 'Snow' };
    if (code <= 82) return { glyph: '🌧️', desc: 'Showers' };
    if (code <= 99) return { glyph: '⛈️', desc: 'Storm' };
    return { glyph: '🌡️', desc: 'Weather' };
  }

  /* ---------------- Battery ---------------- */
  async function startBattery() {
    if (navigator.getBattery) {
      try {
        const b = await navigator.getBattery();
        const upd = () => { state.battery = b.level; emit('battery', b.level); };
        b.addEventListener('levelchange', upd); upd();
        return;
      } catch (e) {}
    }
    let lvl = 0.86;
    emit('battery', lvl);
    setInterval(() => { lvl = Math.max(0.05, lvl - 0.002); state.battery = lvl; emit('battery', lvl); }, 30000);
  }

  function init() {
    // defer so UI listeners (gps/gpsstatus) are subscribed before the first emit
    setTimeout(startGPS, 0);
    startBattery();
    fetchWeather();
    setInterval(fetchWeather, 10 * 60 * 1000);
  }

  return { state, on, init, connectBluetooth, disconnectBluetooth, dial, fetchWeather, retryLocation, setManualLocation, clearManualLocation, connectHeartRate, disconnectHeartRate };
})();
