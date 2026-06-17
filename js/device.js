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
  let simTimer = null;
  function startGPS() {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => {
          state.simulated = false;
          state.coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (pos.coords.heading != null) state.heading = pos.coords.heading;
          state.speedKmh = pos.coords.speed != null ? Math.max(0, pos.coords.speed * 3.6) : state.speedKmh;
          state.satellites = 9; state.hasFix = true;
          emit('gps', { ...state });
        },
        () => simulateGPS(),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
      );
      // Kick off sim immediately too; real fixes will override it.
      simulateGPS();
    } else {
      simulateGPS();
    }
  }

  function simulateGPS() {
    if (simTimer) return;
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
    startGPS();
    startBattery();
    fetchWeather();
    setInterval(fetchWeather, 10 * 60 * 1000);
  }

  return { state, on, init, connectBluetooth, disconnectBluetooth, dial, fetchWeather };
})();
