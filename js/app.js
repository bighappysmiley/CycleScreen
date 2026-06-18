/* app.js — shell: navigation, app drawer/registry, status bar, sheets, theme. */
const App = (() => {
  // App registry — drawer order & metadata.
  const APPS = [
    { id: 'music',    name: 'Music',   color: '#ff2d55', icon: 'music',    render: (h) => Music.render(h), guard: () => !Store.get('parental.blockMusic') },
    { id: 'friends',  name: 'Friends', color: '#0a84ff', icon: 'friends',  render: (h) => Friends.render(h), guard: () => true },
    { id: 'settings', name: 'Settings',color: '#8e8e93', icon: 'settings', render: (h) => Settings.render(h), guard: () => true },
    { id: 'maps',     name: 'Map',     color: '#34c759', icon: 'map',      action: () => { nav('dashboard'); MapView.recenter(); } },
    { id: 'weather',  name: 'Weather', color: '#0a84ff', icon: 'weather',  action: () => weatherSheet() },
    { id: 'fitness',  name: 'Fitness', color: '#ff9500', icon: 'fitness',  render: (h) => Fitness.render(h) },
  ];

  let current = 'dashboard';

  function nav(id) {
    document.querySelectorAll('#screens .screen').forEach((s) => s.classList.remove('screen--active'));
    const map = { dashboard: 'screen-dashboard', app: 'screen-app' };
    document.getElementById(map[id] || 'screen-dashboard').classList.add('screen--active');
    if (current === 'app' && id !== 'app') Settings.lockParental(); // re-lock parental on leaving Settings
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
        <div class="glyph" style="background:${a.color};${locked?'opacity:.45':''}">${Icons[a.icon] || ''}${locked?'<span class="glyph-lock">'+Icons.lock+'</span>':''}</div>
        <span class="label">${a.name}</span></button>`;
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
  function paintGPS(s) { document.getElementById('gps-sats').textContent = s.manual ? 'SET' : s.hasFix ? (s.simulated ? 'SIM' : s.satellites) : '…'; }

  let warnedDenied = false;
  function onGpsStatus(st) {
    const chip = document.getElementById('status-gps');
    chip.classList.remove('gps-live', 'gps-sim', 'gps-bad');
    if (st.state === 'manual') { chip.classList.add('gps-live'); document.getElementById('gps-sats').textContent = 'SET'; warnedDenied = false; }
    else if (st.state === 'live') { chip.classList.add('gps-live'); warnedDenied = false; }
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
    } else if (st.state === 'coarse') {
      chip.classList.add('gps-sim');
      if (!warnedDenied) { warnedDenied = true; toast('📍 Approximate location (no GPS). Set it in Settings → Location, or connect the GPS dongle.'); }
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
  function callOverlay(contact) {
    const tel = (contact.phone || '').replace(/[^\d+]/g, '');
    const body = `
      <div style="text-align:center;padding:6px 0 4px">
        <div class="avatar" style="width:84px;height:84px;font-size:30px;margin:0 auto 12px;background:${contact.color}">${contact.initials}</div>
        <div style="font-size:22px;font-weight:700">${contact.name}</div>
        <div style="color:var(--text-2);margin-top:2px">${contact.phone || 'No number set'}</div>
        <div style="color:var(--text-2);font-size:12px;margin-top:8px">Dials through the connected phone / cellular handler</div>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px">
        ${tel ? `<a class="btn btn--block btn--pill" href="tel:${tel}" id="docall" style="background:var(--accent-2)">📞 Call</a>` : ''}
        <button class="btn btn--block btn--pill btn--ghost" id="endcall">Close</button>
      </div>`;
    const close = sheet('Quick Dial', body, (root, c) => {
      root.querySelector('#endcall').onclick = c;
      const a = root.querySelector('#docall');
      if (a) a.onclick = () => { setTimeout(c, 600); }; // let the tel: handler take over, then close
    });
    // also fire the tel: handoff immediately so a single tap places the call
    if (tel) { try { window.location.href = 'tel:' + tel; } catch (e) {} }
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
  /* ---- parental lock gate on boot ---- */
  function init() {
    // restore prefs
    setTheme(Store.get('theme'));
    setAccent(Store.get('accent'));

    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = Icons[el.dataset.icon] || ''; });

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

  /* ---- BikeTime (parental downtime) ---- */
  let bikeBypassUntil = 0; // epoch ms until which a parent has unlocked downtime
  const toMin = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
  function inDowntime(bt, now) {
    const cur = now.getHours() * 60 + now.getMinutes();
    const s = toMin(bt.start), e = toMin(bt.end);
    if (s === e) return false;
    return s < e ? (cur >= s && cur < e) : (cur >= s || cur < e); // handles overnight windows
  }
  function bikeTimeTick() {
    const par = Store.get('parental');
    const bt = par.bikeTime || {};
    const active = par.enabled && bt.enabled && inDowntime(bt, new Date()) && Date.now() > bikeBypassUntil;
    const existing = document.getElementById('biketime-overlay');
    if (active && !existing) showBikeTime(bt);
    else if (!active && existing) existing.remove();
  }
  function showBikeTime(bt) {
    const ov = document.createElement('div');
    ov.id = 'biketime-overlay';
    ov.className = 'locked-overlay biketime';
    ov.innerHTML = `
      <div class="bt-emoji">🌙</div>
      <div class="bt-title">Come back soon</div>
      <div class="bt-sub">BikeTime is enabled, come back at <b>${formatTime(bt.end)}</b></div>
      ${Store.get('parental.pin') ? `<button class="bt-bypass" id="bt-bypass">Parent: enter passcode</button>` : ''}`;
    document.body.append(ov);
    const by = ov.querySelector('#bt-bypass');
    if (by) by.onclick = () => Security.verify(Store.get('parental.pin'), 'BikeTime', () => { bikeBypassUntil = Date.now() + 60 * 60 * 1000; ov.remove(); });
  }
  function formatTime(t) {
    const [h, m] = (t || '7:00').split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function afterOnboard() { I18n.set(Store.get('language')); Dashboard.refresh(); renderDrawer(); }

  function boot() {
    // restore prefs + language before anything renders
    setTheme(Store.get('theme'));
    setAccent(Store.get('accent'));
    I18n.set(Store.get('language') || 'en');
    init();
    Security.init();
    Cloud.init();
    bikeTimeTick(); setInterval(bikeTimeTick, 20000); // parental downtime watcher

    if (Cloud.enabled) {
      // Real accounts: gate on Firebase auth state.
      let started = false;
      Cloud.onAuth((u) => {
        if (u) {
          const initials = (u.name || u.username).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
          Store.update((d) => { d.profile.name = u.name; d.profile.username = u.username; d.profile.initials = initials; d.onboarded = true; });
          afterOnboard();
        } else if (!started) {
          started = true;
          Onboarding.start(afterOnboard); // language → sign in / create account
        }
      });
    } else if (!Store.get('onboarded')) {
      Onboarding.start(afterOnboard);
    }
  }

  return { init, boot, nav, open, toast, sheet, setTheme, setAccent, callOverlay, refreshDrawer: renderDrawer, setTab };
})();

window.addEventListener('DOMContentLoaded', App.boot);
