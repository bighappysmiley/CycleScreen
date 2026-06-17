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
    simulated: true,
  };

  /* ---------------- GPS ---------------- */
  let simTimer = null, fallbackTimer = null, lastReal = 0, watchId = null, triedLowAccuracy = false;

  function startGPS() {
    if (!navigator.geolocation) { emit('gpsstatus', { state: 'unsupported' }); simulateGPS(); return; }
    if (!window.isSecureContext) { emit('gpsstatus', { state: 'insecure' }); App.toast && App.toast('⚠️ Location needs HTTPS'); }
    if (window.self !== window.top) emit('gpsstatus', { state: 'iframe' });
    requestLocation();
    // Fall back to simulation only if NOTHING (real or error) arrives in time.
    fallbackTimer = setTimeout(() => { if (!state.hasFix) { emit('gpsstatus', { state: 'slow' }); simulateGPS(); } }, 9000);
  }

  // (Re)request location: a fast one-shot fix, plus a continuous high-accuracy watch.
  function requestLocation() {
    emit('gpsstatus', { state: 'locating' });
    navigator.geolocation.getCurrentPosition(onRealFix, onGeoError, { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 });
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(onRealFix, onGeoError, { enableHighAccuracy: true, maximumAge: 1000, timeout: 27000 });
  }

  function onRealFix(pos) {
    stopSim();
    clearTimeout(fallbackTimer);
    const firstFix = lastReal === 0;
    lastReal = Date.now();
    const c = pos.coords;
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
    state.hasFix = true; state.simulated = false;
    emit('gps', { ...state });
    emit('gpsstatus', { state: 'live', accuracy: c.accuracy });
    if (firstFix) fetchWeather();
  }

  function onGeoError(err) {
    // err.code: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
    if (err && err.code === 3 && !triedLowAccuracy) {
      // high-accuracy timed out — retry with network/coarse location (faster)
      triedLowAccuracy = true;
      navigator.geolocation.getCurrentPosition(onRealFix, onGeoError, { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 });
      return;
    }
    const reason = err && err.code === 1 ? 'denied' : err && err.code === 2 ? 'unavailable' : 'timeout';
    emit('gpsstatus', { state: reason });
    if (!state.hasFix || (Date.now() - lastReal > 20000)) simulateGPS();
  }

  // Called from the UI to (re)prompt for location, e.g. after enabling permission.
  function retryLocation() { triedLowAccuracy = false; clearTimeout(fallbackTimer); requestLocation(); }

  function haversineKm(a, b) {
    const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function stopSim() { if (simTimer) { clearInterval(simTimer); simTimer = null; } }

  function simulateGPS() {
    if (simTimer || state.hasFix && !state.simulated) return;
    state.simulated = true;
    let t = 0, targetSpeed = 22;
    simTimer = setInterval(() => {
      t += 0.6;
      // satellites lock-on
      if (state.satellites < 11) state.satellites++;
      state.hasFix = state.satellites >= 4;
      // ease speed toward a wandering target
      if (Math.random() < 0.04) targetSpeed = 6 + Math.random() * 30;
      state.speedKmh += (targetSpeed - state.speedKmh) * 0.08;
      if (Math.random() < 0.02) state.speedKmh = Math.max(0, state.speedKmh - 12); // stop sign
      // move along a gently curving heading
      state.heading = (state.heading + Math.sin(t / 5) * 3 + 360) % 360;
      const metersPerTick = (state.speedKmh / 3.6) * 0.6;
      const rad = (state.heading * Math.PI) / 180;
      state.coords.lat += (metersPerTick * Math.cos(rad)) / 111320;
      state.coords.lng += (metersPerTick * Math.sin(rad)) / (111320 * Math.cos(state.coords.lat * Math.PI / 180));
      emit('gps', { ...state });
    }, 600);
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

  return { state, on, init, connectBluetooth, disconnectBluetooth, dial, fetchWeather, retryLocation };
})();
