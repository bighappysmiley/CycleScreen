/* dashboard.js — rail (profile / speed / weather / quick-dial / ride) +
 * map overlays (clock, search, speed gauge) + ride tracking. */
const Dashboard = (() => {
  let speedWarned = false;
  const ride = { active: false, startTs: 0, distanceKm: 0, lastFix: null, bpm: 0, elapsed: 0 };
  let rideTimer = null;

  function refresh() {
    const p = Store.get('profile');
    document.getElementById('rail-name').textContent = p.name;
    document.getElementById('rail-avatar').textContent = p.initials;
    const unit = p.units === 'imperial' ? 'mph' : 'km/h';
    document.getElementById('rail-speed-unit').textContent = unit;
    document.getElementById('ov-speed-unit').textContent = unit.toUpperCase();
    document.getElementById('ride-avg').nextElementSibling.textContent = unit;
    document.getElementById('ride-dist').nextElementSibling.textContent = p.units === 'imperial' ? 'mi' : 'km';
    applyLabels();
    renderDials();
    paintSpeed(Device.state.speedKmh);
    if (Device.state.weather) paintWeather(Device.state.weather);
  }

  function applyLabels() {
    const map = {
      'rail-presence-txt': 'online', 'lbl-speed': 'speed', 'lbl-quickdial': 'quick_dial',
      'lbl-holdedit': 'hold_to_edit', 'lbl-ride': 'current_ride',
      'tab-home': 'home', 'tab-apps': 'apps', 'tab-theme': 'theme', 'tab-settings': 'settings', 'tab-lock': 'lock',
    };
    for (const [id, key] of Object.entries(map)) { const el = document.getElementById(id); if (el) el.textContent = I18n.t(key); }
    document.getElementById('ov-search-input').placeholder = I18n.t('search_places');
    if (!ride.active) document.getElementById('ride-btn').textContent = I18n.t('start_ride');
  }

  /* ---- Quick dial: rows with call button + hold-to-edit ---- */
  function renderDials() {
    const grid = document.getElementById('dial-grid');
    const dials = Store.get('quickDial');
    grid.innerHTML = dials.map((d, i) => d
      ? `<div class="dial-row" data-i="${i}">
           <div class="avatar" style="background:${d.color}">${d.initials}</div>
           <div class="dr-main"><div class="dr-name">${d.name}</div><div class="dr-num">${d.phone || ''}</div></div>
           <button class="dr-call" data-call="${i}" aria-label="Call">
             <svg width="15" height="15" viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11 11 0 0 0 3.5.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11 11 0 0 0 .56 3.5 1 1 0 0 1-.25 1z"/></svg>
           </button>
         </div>`
      : `<div class="dial-row dial--empty" data-i="${i}">
           <div class="avatar">＋</div>
           <div class="dr-main"><div class="dr-name">${I18n.t('add_contact')}</div><div class="dr-num">${I18n.t('hold_to_set')}</div></div>
         </div>`
    ).join('');

    grid.querySelectorAll('.dial-row').forEach((row) => {
      const i = +row.dataset.i;
      bindHold(row,
        () => Settings && Settings.editDial ? Settings.editDial(i, refresh) : App.open('settings'),  // long press = edit
        () => { const d = dials[i]; if (d) callContact(d); else (Settings.editDial ? Settings.editDial(i, refresh) : App.open('settings')); } // tap = call
      );
    });
    grid.querySelectorAll('[data-call]').forEach((b) => b.onclick = (e) => {
      e.stopPropagation(); const d = dials[+b.dataset.call]; if (d) callContact(d);
    });
  }

  // press-and-hold helper: fires onHold after 550ms, else onTap on release
  function bindHold(el, onHold, onTap) {
    let timer, held;
    const start = (e) => { held = false; timer = setTimeout(() => { held = true; navigator.vibrate && navigator.vibrate(15); onHold(); }, 550); };
    const end = () => { clearTimeout(timer); if (!held) onTap(); };
    const cancel = () => clearTimeout(timer);
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end);
    el.addEventListener('touchmove', cancel, { passive: true });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', cancel);
  }

  function callContact(d) { Device.dial(d); App.callOverlay(d, Device.state.btConnected); }

  /* ---- Speed (rail + gauge) ---- */
  function paintSpeed(kmh) {
    const imperial = Store.get('profile.units') === 'imperial';
    const v = Math.round(imperial ? kmh * 0.621371 : kmh);
    document.getElementById('rail-speed').textContent = v;
    document.getElementById('ov-speed-val').textContent = v;
    document.getElementById('ov-speed').classList.toggle('fast', kmh > 28);
    const par = Store.get('parental');
    if (par.enabled && kmh > par.maxSpeedAlert) {
      if (!speedWarned) { speedWarned = true; App.toast(`⚠️ Over ${par.maxSpeedAlert} km/h limit`); }
    } else speedWarned = false;
  }

  function paintWeather(w) {
    document.getElementById('rail-weather-icon').textContent = w.glyph;
    const imperial = Store.get('profile.units') === 'imperial';
    const temp = imperial ? Math.round(w.temp * 9 / 5 + 32) : w.temp;
    document.getElementById('rail-weather-temp').textContent = temp + '°';
    document.getElementById('rail-weather-desc').textContent = w.desc;
  }

  /* ---- Clock overlay ---- */
  function paintClock() {
    const now = new Date();
    document.getElementById('ov-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('ov-date').textContent = now.toLocaleDateString(I18n.current(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ---- Ride tracking ---- */
  function toggleRide() {
    ride.active ? endRide() : startRide();
  }
  function startRide() {
    ride.active = true; ride.startTs = Date.now(); ride.distanceKm = 0; ride.lastFix = { ...Device.state.coords }; ride.elapsed = 0;
    document.getElementById('ride-card').classList.add('active');
    document.getElementById('ride-btn').textContent = I18n.t('end_ride');
    rideTimer = setInterval(tickRide, 1000);
    App.toast('🚴 ' + I18n.t('start_ride'));
  }
  function endRide() {
    ride.active = false; clearInterval(rideTimer);
    document.getElementById('ride-card').classList.remove('active');
    document.getElementById('ride-btn').textContent = I18n.t('start_ride');
    const imperial = Store.get('profile.units') === 'imperial';
    const dist = imperial ? ride.distanceKm * 0.621371 : ride.distanceKm;
    Store.set('lastRide', { date: new Date().toISOString(), distanceKm: ride.distanceKm, durationSec: ride.elapsed, avgKmh: avgKmh() });
    App.toast(`🏁 ${dist.toFixed(1)} ${imperial ? 'mi' : 'km'} · ${fmtDur(ride.elapsed)}`);
  }
  function tickRide() {
    ride.elapsed = Math.floor((Date.now() - ride.startTs) / 1000);
    document.getElementById('ride-timer').textContent = fmtDur(ride.elapsed);
    // simulated heart rate that tracks effort/speed
    const target = 90 + Math.min(90, Device.state.speedKmh * 2.4);
    ride.bpm += (target - ride.bpm) * 0.15 + (Math.random() - 0.5) * 3;
    document.getElementById('ride-bpm').textContent = Math.round(ride.bpm) || '--';
  }
  function onRideFix(s) {
    if (!ride.active) return;
    if (ride.lastFix) ride.distanceKm += haversine(ride.lastFix, s.coords);
    ride.lastFix = { ...s.coords };
    const imperial = Store.get('profile.units') === 'imperial';
    document.getElementById('ride-dist').textContent = (imperial ? ride.distanceKm * 0.621371 : ride.distanceKm).toFixed(1);
    const avg = avgKmh();
    document.getElementById('ride-avg').textContent = (imperial ? avg * 0.621371 : avg).toFixed(1);
  }
  function avgKmh() { return ride.elapsed > 0 ? (ride.distanceKm / (ride.elapsed / 3600)) : 0; }
  function fmtDur(s) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':'); }
  function haversine(a, b) {
    const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  /* ---- Place search (Nominatim, graceful fallback) ---- */
  function wireSearch() {
    const input = document.getElementById('ov-search-input');
    const clear = document.getElementById('ov-search-clear');
    input.oninput = () => { clear.hidden = !input.value; };
    clear.onclick = () => { input.value = ''; clear.hidden = true; };
    input.onkeydown = async (e) => {
      if (e.key !== 'Enter' || !input.value.trim()) return;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(input.value)}`, { headers: { 'Accept-Language': I18n.current() } });
        const j = await r.json();
        if (j[0]) { MapView.goTo(+j[0].lat, +j[0].lon, j[0].display_name.split(',')[0]); App.toast('📍 ' + j[0].display_name.split(',')[0]); }
        else App.toast('No results');
      } catch { App.toast('Search unavailable offline'); }
    };
  }

  function init() {
    refresh();
    paintClock(); setInterval(paintClock, 15000);
    wireSearch();
    Device.on('gps', (s) => { paintSpeed(s.speedKmh); onRideFix(s); });
    Device.on('weather', paintWeather);
    document.getElementById('ride-btn').onclick = toggleRide;
    document.getElementById('rail-gear').onclick = () => App.open('settings');
    document.getElementById('ov-speed').onclick = () => App.open('fitness');
  }

  return { init, refresh, renderDials };
})();
