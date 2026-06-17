/* dashboard.js — left rail: profile, speed, weather, quick-dial. */
const Dashboard = (() => {
  let speedWarned = false;

  function refresh() {
    const p = Store.get('profile');
    document.getElementById('rail-name').textContent = p.name;
    document.getElementById('rail-username').textContent = '@' + p.username;
    document.getElementById('rail-avatar').textContent = p.initials;
    document.getElementById('rail-speed-unit').textContent = p.units === 'imperial' ? 'mph' : 'km/h';
    renderDials();
    paintSpeed(Device.state.speedKmh);
    if (Device.state.weather) paintWeather(Device.state.weather);
  }

  function renderDials() {
    const grid = document.getElementById('dial-grid');
    const dials = Store.get('quickDial');
    grid.innerHTML = dials.map((d, i) => d
      ? `<button class="dial" data-i="${i}">
           <div class="avatar" style="background:${d.color}">${d.initials}</div>
           <span class="dial-name">${d.name}</span></button>`
      : `<button class="dial dial--empty" data-i="${i}">
           <div class="avatar">＋</div><span class="dial-name">Add</span></button>`
    ).join('');
    grid.querySelectorAll('.dial').forEach((b) => b.onclick = () => {
      const d = dials[+b.dataset.i];
      if (!d) { App.open('settings'); return; }
      callContact(d);
    });
  }

  function callContact(d) {
    Device.dial(d);
    const connected = Device.state.btConnected;
    App.callOverlay(d, connected);
  }

  function paintSpeed(kmh) {
    const imperial = Store.get('profile.units') === 'imperial';
    const v = imperial ? kmh * 0.621371 : kmh;
    document.getElementById('rail-speed').textContent = Math.round(v);
    // parental speed alert
    const par = Store.get('parental');
    if (par.enabled && kmh > par.maxSpeedAlert) {
      if (!speedWarned) { speedWarned = true; App.toast(`⚠️ Over ${par.maxSpeedAlert} km/h limit`); }
    } else { speedWarned = false; }
  }

  function paintWeather(w) {
    document.getElementById('rail-weather-icon').textContent = w.glyph;
    document.getElementById('rail-weather-temp').textContent = w.temp + '°';
    document.getElementById('rail-weather-desc').textContent = `${w.desc} • ${w.wind} km/h`;
  }

  function init() {
    refresh();
    Device.on('gps', (s) => paintSpeed(s.speedKmh));
    Device.on('weather', paintWeather);
  }

  return { init, refresh, renderDials };
})();
