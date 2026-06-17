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
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('screen--active'));
    const map = { dashboard: 'screen-dashboard', drawer: 'screen-drawer', app: 'screen-app' };
    document.getElementById(map[id] || 'screen-dashboard').classList.add('screen--active');
    current = id;
    document.getElementById('status-title').textContent = id === 'dashboard' ? 'CycleScreen' : (id === 'drawer' ? 'Apps' : document.getElementById('app-title').textContent);
    if (id === 'dashboard') MapView.invalidate();
  }

  function open(appId) {
    const app = APPS.find((a) => a.id === appId);
    if (!app) return;
    if (app.guard && !app.guard()) return App.toast('🔒 Restricted by Parental Controls');
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
  function paintGPS(s) { document.getElementById('gps-sats').textContent = s.hasFix ? s.satellites : '—'; }
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
  function maybeLock() {
    const par = Store.get('parental');
    if (!par.enabled || !par.pin) return;
    const ov = document.createElement('div'); ov.className = 'locked-overlay';
    ov.innerHTML = `<div class="lock-emoji">🔒</div><div style="font-size:18px;font-weight:700">CycleScreen Locked</div>
      <div style="color:var(--text-2);font-size:13px">Enter parental PIN</div>
      <div class="pin-dots">${'<span class="d"></span>'.repeat(4)}</div>
      <div class="keypad">${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k) => `<button data-k="${k}" ${k===''?'style="visibility:hidden"':''}>${k}</button>`).join('')}</div>`;
    document.body.append(ov);
    let entry = '';
    const dots = ov.querySelectorAll('.pin-dots .d');
    const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < entry.length));
    ov.querySelectorAll('.keypad button').forEach((b) => b.onclick = () => {
      const k = b.dataset.k;
      if (k === '⌫') entry = entry.slice(0, -1);
      else if (entry.length < 4) entry += k;
      paint();
      if (entry.length === 4) {
        if (entry === par.pin) { ov.style.opacity = 0; setTimeout(() => ov.remove(), 300); }
        else { ov.querySelector('.pin-dots').animate([{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'translateX(0)'}],{duration:300}); entry=''; setTimeout(paint, 60); }
      }
    });
  }

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

    // bottom tab bar
    document.querySelectorAll('#tabbar .tab').forEach((b) => b.onclick = () => {
      const t = b.dataset.tab;
      if (t === 'home') nav('dashboard');
      else if (t === 'apps') nav('drawer');
      else if (t === 'theme') setTheme(Store.get('theme') === 'dark' ? 'light' : 'dark');
      else if (t === 'settings') open('settings');
      else if (t === 'lock') lockNow();
      setTab(t === 'theme' || t === 'lock' ? 'home' : t);
    });
  }

  function setTab(t) {
    document.querySelectorAll('#tabbar .tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  }

  function lockNow() {
    const par = Store.get('parental');
    if (!par.pin) return App.toast('Set a passcode in Settings to enable lock');
    Store.set('parental.enabled', true);
    maybeLock();
  }

  function boot() {
    // restore prefs + language before anything renders
    setTheme(Store.get('theme'));
    setAccent(Store.get('accent'));
    I18n.set(Store.get('language') || 'en');
    init();
    if (!Store.get('onboarded')) {
      Onboarding.start(() => { I18n.set(Store.get('language')); Dashboard.refresh(); renderDrawer(); maybeLock(); });
    } else {
      maybeLock();
    }
  }

  return { init, boot, nav, open, toast, sheet, setTheme, setAccent, callOverlay, refreshDrawer: renderDrawer, setTab };
})();

window.addEventListener('DOMContentLoaded', App.boot);
