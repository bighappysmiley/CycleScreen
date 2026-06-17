/* app.js — shell: navigation, app drawer/registry, status bar, sheets, theme. */
const App = (() => {
  // App registry — drawer order & metadata.
  const APPS = [
    { id: 'music',    name: '24six',   color: 'linear-gradient(135deg,#bf5af2,#ff375f)', glyph: '🎵', render: (h) => Music.render(h), guard: () => !Store.get('parental.blockMusic') },
    { id: 'friends',  name: 'Friends', color: 'linear-gradient(135deg,#0a84ff,#64d2ff)', glyph: '👥', render: (h) => Friends.render(h), guard: () => true },
    { id: 'settings', name: 'Settings',color: 'linear-gradient(135deg,#8e8e93,#48484a)', glyph: '⚙️', render: (h) => Settings.render(h), guard: () => true },
    { id: 'maps',     name: 'Map',     color: 'linear-gradient(135deg,#30d158,#0a84ff)', glyph: '🗺️', action: () => { nav('dashboard'); MapView.recenter(); } },
    { id: 'weather',  name: 'Weather', color: 'linear-gradient(135deg,#0a84ff,#64d2ff)', glyph: '⛅', action: () => weatherSheet() },
    { id: 'fitness',  name: 'Fitness', color: 'linear-gradient(135deg,#30d158,#a2f44a)', glyph: '📊', action: () => fitnessSheet() },
  ];

  let current = 'dashboard';

  function nav(id) {
    document.querySelectorAll('#screens .screen').forEach((s) => s.classList.remove('screen--active'));
    const map = { dashboard: 'screen-dashboard', app: 'screen-app' };
    document.getElementById(map[id] || 'screen-dashboard').classList.add('screen--active');
    current = id;
    document.getElementById('status-title').textContent = id === 'dashboard' ? 'CycleScreen' : document.getElementById('app-title').textContent;
    if (id === 'dashboard') MapView.invalidate();
  }

  /* ---- App drawer: slide-up sheet over the dashboard ---- */
  let drawerOpen = false;
  function openDrawer() {
    nav('dashboard'); // drawer always sits over the dashboard
    document.getElementById('drawer-backdrop').classList.add('open');
    document.getElementById('screen-drawer').classList.add('open');
    document.getElementById('screen-drawer').setAttribute('aria-hidden', 'false');
    document.getElementById('status-title').textContent = 'Apps';
    setTab('apps'); drawerOpen = true;
  }
  function closeDrawer() {
    document.getElementById('drawer-backdrop').classList.remove('open');
    document.getElementById('screen-drawer').classList.remove('open');
    document.getElementById('screen-drawer').setAttribute('aria-hidden', 'true');
    if (current === 'dashboard') document.getElementById('status-title').textContent = 'CycleScreen';
    setTab('home'); drawerOpen = false;
  }

  function open(appId) {
    const app = APPS.find((a) => a.id === appId);
    if (!app) return;
    if (app.guard && !app.guard()) return App.toast('🔒 Restricted by Parental Controls');
    closeDrawer();
    if (app.action) return app.action();
    document.getElementById('app-title').textContent = app.name;
    const host = document.getElementById('app-body'); host.innerHTML = '';
    app.render(host);
    nav('app');
  }

  function renderDrawer() {
    const grid = document.getElementById('drawer-grid');
    grid.innerHTML = APPS.map((a, i) => {
      const locked = a.guard && !a.guard();
      return `<button class="app-icon" data-id="${a.id}" style="animation-delay:${i*0.03}s">
        <div class="glyph" style="background:${a.color};${locked?'filter:grayscale(.6);opacity:.6':''}">${a.glyph}</div>
        <span class="label">${a.name}${locked?' 🔒':''}</span></button>`;
    }).join('');
    grid.querySelectorAll('.app-icon').forEach((b) => b.onclick = () => open(b.dataset.id));
  }

  /* ---- status bar ---- */
  function startClock() {
    const el = document.getElementById('status-clock');
    const tick = () => { el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
    tick(); setInterval(tick, 15000);
  }
  function paintBattery(level) {
    document.getElementById('batt-pct').textContent = Math.round(level * 100) + '%';
    const f = document.getElementById('batt-fill');
    f.style.width = Math.round(level * 100) + '%';
    f.style.background = level < 0.2 ? 'var(--danger)' : level < 0.4 ? 'var(--warn)' : 'var(--accent-2)';
  }
  function paintGPS(s) { document.getElementById('gps-sats').textContent = s.hasFix ? (s.simulated ? 'SIM' : s.satellites) : '…'; }

  let warnedDenied = false;
  function onGpsStatus(st) {
    const chip = document.getElementById('status-gps');
    chip.classList.remove('gps-live', 'gps-sim', 'gps-bad');
    if (st.state === 'live') { chip.classList.add('gps-live'); warnedDenied = false; }
    else if (st.state === 'locating') { document.getElementById('gps-sats').textContent = '…'; }
    else if (['denied', 'insecure', 'iframe', 'unsupported'].includes(st.state)) {
      chip.classList.add('gps-bad');
      if (!warnedDenied) {
        warnedDenied = true;
        const msg = {
          denied: '📍 Location blocked. Enable it for this site, then tap the GPS icon to retry.',
          insecure: '📍 Real location needs HTTPS (open the https:// site).',
          iframe: '📍 Open cyclescreen.netlify.app in a full browser tab for real GPS.',
          unsupported: '📍 This browser has no geolocation.',
        }[st.state];
        toast(msg);
      }
    } else if (st.state === 'slow' || st.state === 'timeout' || st.state === 'unavailable') {
      chip.classList.add('gps-sim');
    }
  }
  function paintBT(s) { document.getElementById('status-bt').classList.toggle('off', !s.btConnected); }

  /* ---- theme ---- */
  function setTheme(t) { document.body.dataset.theme = t; Store.set('theme', t); }
  function setAccent(c) { document.documentElement.style.setProperty('--accent', c); Store.set('accent', c); }

  /* ---- toast ---- */
  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.hidden = false; el.textContent = msg; requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.remove('show'); setTimeout(() => (el.hidden = true), 300); }, 2200);
  }

  /* ---- bottom sheet ---- */
  function sheet(title, html, wire) {
    const bd = document.createElement('div'); bd.className = 'sheet-backdrop';
    const sh = document.createElement('div'); sh.className = 'sheet';
    sh.innerHTML = `<div class="sheet-grab"></div><h3>${title}</h3>${html}`;
    document.body.append(bd, sh);
    requestAnimationFrame(() => { bd.classList.add('show'); sh.classList.add('show'); });
    const close = () => { bd.classList.remove('show'); sh.classList.remove('show'); setTimeout(() => { bd.remove(); sh.remove(); }, 340); };
    bd.onclick = close;
    if (wire) wire(sh, close);
    return close;
  }

  /* ---- call overlay (uses phone Bluetooth HFP) ---- */
  function callOverlay(contact, connected) {
    const body = `
      <div style="text-align:center;padding:6px 0 4px">
        <div class="avatar" style="width:84px;height:84px;font-size:30px;margin:0 auto 12px;background:${contact.color}">${contact.initials}</div>
        <div style="font-size:22px;font-weight:700">${contact.name}</div>
        <div style="color:var(--text-2);margin-top:2px">${contact.phone || ''}</div>
        <div style="color:${connected?'var(--accent-2)':'var(--warn)'};font-size:13px;margin-top:8px;font-weight:600">
          ${connected ? '📞 Calling via phone Bluetooth…' : '⚠️ Connect your phone in Settings → Bluetooth'}</div>
      </div>
      <button class="btn btn--block btn--danger btn--pill" id="endcall" style="margin-top:14px">End</button>`;
    const close = sheet('Quick Dial', body, (root, c) => { root.querySelector('#endcall').onclick = c; });
    if (connected) setTimeout(close, 3500);
  }

  function weatherSheet() {
    const w = Device.state.weather || { glyph: '⛅', temp: '--', desc: '…', wind: 0 };
    sheet('Weather', `<div style="text-align:center;padding:8px 0">
      <div style="font-size:64px">${w.glyph}</div>
      <div style="font-size:40px;font-weight:700">${w.temp}°</div>
      <div style="color:var(--text-2)">${w.desc} • Wind ${w.wind} km/h</div>
      <div style="color:var(--text-3);font-size:12px;margin-top:10px">At your current GPS location</div>
    </div>`);
  }
  function fitnessSheet() {
    const s = Device.state;
    sheet('Ride Stats', `<div class="list">
      <div class="list-row"><div class="lr-main"><div class="lr-title">Current Speed</div></div><div class="lr-trail">${s.speedKmh.toFixed(1)} km/h</div></div>
      <div class="list-row"><div class="lr-main"><div class="lr-title">Heading</div></div><div class="lr-trail">${Math.round(s.heading)}°</div></div>
      <div class="list-row"><div class="lr-main"><div class="lr-title">GPS Satellites</div></div><div class="lr-trail">${s.satellites}</div></div>
      <div class="list-row"><div class="lr-main"><div class="lr-title">Position</div></div><div class="lr-trail">${s.coords.lat.toFixed(4)}, ${s.coords.lng.toFixed(4)}</div></div>
    </div>`);
  }

  /* ---- parental lock gate on boot ---- */
  function init() {
    // restore prefs
    setTheme(Store.get('theme'));
    setAccent(Store.get('accent'));

    Device.init();
    MapView.init();
    Dashboard.init();
    renderDrawer();
    startClock();

    Device.on('gps', paintGPS); paintGPS(Device.state);
    Device.on('gpsstatus', onGpsStatus);
    // GPS chip is tappable to (re)request real location
    const gpsChip = document.getElementById('status-gps');
    gpsChip.style.pointerEvents = 'auto'; gpsChip.style.cursor = 'pointer';
    gpsChip.onclick = () => { toast('📍 Requesting location…'); Device.retryLocation(); };
    Device.on('battery', paintBattery);
    Device.on('bt', paintBT); paintBT(Device.state);
    Device.on('call', () => {});

    // now-playing pill
    Music.onChange((st) => {
      const pill = document.getElementById('now-pill');
      pill.hidden = !st.playing && st.pos === 0;
      document.getElementById('now-pill-title').textContent = `${st.track.title} — ${st.track.artist}`;
      document.getElementById('now-pill-art').textContent = st.track.art;
      pill.querySelector('.now-pill-eq').style.visibility = st.playing ? 'visible' : 'hidden';
    });
    document.getElementById('now-pill').onclick = () => open('music');

    // nav wiring
    document.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => nav(b.dataset.nav));

    // app drawer open/close
    document.getElementById('drawer-backdrop').onclick = closeDrawer;
    document.getElementById('drawer-done').onclick = closeDrawer;
    // "Back" from a full-screen app returns to the dashboard with the drawer up
    document.getElementById('app-back').onclick = () => { nav('dashboard'); openDrawer(); };

    // bottom tab bar
    document.querySelectorAll('#tabbar .tab').forEach((b) => b.onclick = () => {
      const t = b.dataset.tab;
      if (t === 'home') { closeDrawer(); nav('dashboard'); setTab('home'); }
      else if (t === 'apps') { drawerOpen ? closeDrawer() : openDrawer(); }
      else if (t === 'theme') setTheme(Store.get('theme') === 'dark' ? 'light' : 'dark');
      else if (t === 'settings') open('settings');
      else if (t === 'lock') Security.lockNow();
    });
  }

  function setTab(t) {
    document.querySelectorAll('#tabbar .tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  }

  function boot() {
    // restore prefs + language before anything renders
    setTheme(Store.get('theme'));
    setAccent(Store.get('accent'));
    I18n.set(Store.get('language') || 'en');
    init();
    Security.init();
    if (!Store.get('onboarded')) {
      Onboarding.start(() => { I18n.set(Store.get('language')); Dashboard.refresh(); renderDrawer(); });
    }
  }

  return { init, boot, nav, open, toast, sheet, setTheme, setAccent, callOverlay, refreshDrawer: renderDrawer, setTab };
})();

window.addEventListener('DOMContentLoaded', App.boot);
