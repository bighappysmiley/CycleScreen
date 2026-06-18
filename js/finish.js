/* finish.js — "Finish" ride app: Ride / Watch / History tabs.
 *
 * Ride:    live stats for the current ride (shared with the rail card) + Start/End.
 * Watch:   connect a Bluetooth heart-rate monitor (Pixel Watch / strap) for live BPM.
 * History: every finished ride, saved automatically when a ride ends.
 */
const Finish = (() => {
  let host = null, tab = 'ride', timer = null;

  function render(h) { host = h; renderTabs(); }

  function renderTabs() {
    clearInterval(timer);
    host.innerHTML = `
      <div class="friends-tabs"><div class="segmented" id="ftabs">
        <button data-t="ride" class="${tab === 'ride' ? 'on' : ''}">Ride</button>
        <button data-t="watch" class="${tab === 'watch' ? 'on' : ''}">Watch</button>
        <button data-t="history" class="${tab === 'history' ? 'on' : ''}">History</button>
      </div></div>
      <div class="app-pad" id="fbody"></div>`;
    host.querySelectorAll('#ftabs button').forEach((b) => b.onclick = () => { tab = b.dataset.t; renderTabs(); });
    const body = host.querySelector('#fbody');
    if (tab === 'ride') renderRide(body);
    else if (tab === 'watch') renderWatch(body);
    else renderHistory(body);
  }

  /* ---- Ride ---- */
  function renderRide(body) {
    const draw = () => {
      const r = Dashboard.getRide();
      body.innerHTML = `
        <div class="finish-timer ${r.active ? 'live' : ''}">${r.durationStr}</div>
        <div class="finish-grid">
          <div class="finish-stat"><b>${r.distance.toFixed(2)}</b><small>${r.unit}</small></div>
          <div class="finish-stat"><b>${r.avg.toFixed(1)}</b><small>avg ${r.speedUnit}</small></div>
          <div class="finish-stat"><b>${Math.round(Device.state.speedKmh * (r.speedUnit === 'mph' ? 0.621371 : 1))}</b><small>${r.speedUnit}</small></div>
          <div class="finish-stat"><b>${r.bpm || '--'}</b><small>bpm${Device.state.hrConnected ? ' ♥' : ''}</small></div>
        </div>
        <button class="btn btn--block btn--pill ${r.active ? 'btn--danger' : ''}" id="ride-toggle" style="${r.active ? '' : 'background:var(--accent-2)'}">${r.active ? 'End Ride' : 'Start Ride'}</button>
        ${!Device.state.hrConnected ? `<p style="text-align:center;color:var(--text-2);font-size:12px;margin-top:10px">Connect a heart-rate monitor in the <b>Watch</b> tab for real BPM.</p>` : ''}`;
      body.querySelector('#ride-toggle').onclick = () => { Dashboard.toggleRide(); draw(); };
    };
    draw();
    timer = setInterval(() => { if (tab === 'ride' && document.body.contains(body)) draw(); }, 1000);
  }

  /* ---- Watch (Bluetooth heart rate) ---- */
  function renderWatch(body) {
    const s = Device.state;
    body.innerHTML = `
      <div class="watch-hero">
        <div class="watch-bpm ${s.hrConnected ? 'live' : ''}"><span id="w-bpm">${s.hrConnected ? (s.bpm || '–') : '–'}</span><small>BPM</small></div>
        <div class="watch-status" id="w-status">${s.hrConnected ? 'Connected · ' + (s.hrDevice || 'Heart Rate') : 'No monitor connected'}</div>
      </div>
      <button class="btn btn--block btn--pill" id="w-btn" style="${s.hrConnected ? '' : 'background:var(--accent)'}">${s.hrConnected ? 'Disconnect' : 'Connect heart-rate monitor'}</button>
      <p style="color:var(--text-2);font-size:12px;margin-top:12px;line-height:1.5">
        Works with any Bluetooth monitor that broadcasts the standard Heart-Rate profile (chest straps, many watches). On a Pixel/Wear OS watch, enable heart-rate broadcasting in its companion app first. Live BPM updates the Current Ride card on the dashboard.</p>`;
    body.querySelector('#w-btn').onclick = async () => {
      if (Device.state.hrConnected) { Device.disconnectHeartRate(); renderWatch(body); return; }
      body.querySelector('#w-btn').textContent = 'Pairing…';
      const ok = await Device.connectHeartRate();
      if (!ok) App.toast('No heart-rate monitor connected');
      renderWatch(body);
    };
  }
  // keep the Watch BPM display live
  Device.on('hr', (bpm) => {
    if (tab !== 'watch' || !host) return;
    const el = host.querySelector('#w-bpm'); if (el) el.textContent = bpm || '–';
  });
  Device.on('hrstatus', () => { if (tab === 'watch' && host) renderWatch(host.querySelector('#fbody')); });

  /* ---- History ---- */
  function renderHistory(body) {
    const rides = Store.get('rides') || [];
    const imperial = Store.get('profile.units') === 'imperial';
    const u = imperial ? 'mi' : 'km';
    const conv = (km) => (imperial ? km * 0.621371 : km);
    if (!rides.length) { body.innerHTML = `<div class="empty">No rides yet.<br>Finish a ride and it'll show up here.</div>`; return; }
    const totalKm = rides.reduce((a, r) => a + (r.distanceKm || 0), 0);
    const totalSec = rides.reduce((a, r) => a + (r.durationSec || 0), 0);
    body.innerHTML = `
      <div class="finish-grid" style="margin-bottom:14px">
        <div class="finish-stat"><b>${rides.length}</b><small>rides</small></div>
        <div class="finish-stat"><b>${conv(totalKm).toFixed(0)}</b><small>total ${u}</small></div>
        <div class="finish-stat"><b>${Math.round(totalSec / 60)}</b><small>total min</small></div>
      </div>
      <div class="list">${rides.map((r) => `
        <div class="list-row">
          <div class="lr-icon" style="background:var(--accent-2)">${Icons.fitness}</div>
          <div class="lr-main"><div class="lr-title">${conv(r.distanceKm || 0).toFixed(2)} ${u} · ${fmtDur(r.durationSec || 0)}</div>
            <div class="lr-sub">${new Date(r.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${conv(r.avgKmh || 0).toFixed(1)} ${imperial ? 'mph' : 'km/h'} avg${r.bpm ? ' · ' + r.bpm + ' bpm' : ''}</div></div>
        </div>`).join('')}</div>
      <button class="btn btn--block btn--ghost btn--pill" id="hist-clear" style="margin-top:14px">Clear History</button>`;
    body.querySelector('#hist-clear').onclick = () => { Store.set('rides', []); renderHistory(body); };
  }

  function fmtDur(s) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return (h ? [h, m, sec] : [m, sec]).map((n) => String(n).padStart(2, '0')).join(':'); }

  return { render };
})();
