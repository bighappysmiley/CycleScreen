/* music.js — 24six music, driven by the native app on the Pi via the bridge.
 *
 * The native 24six app handles login/playback (which an embedded web view
 * can't, due to 24six's auth/DRM). This screen:
 *   - launches / re-focuses the native 24six app
 *   - shows live "Now Playing" (title/artist/art/progress) from the bridge
 *   - sends play-pause / next / previous over MPRIS through the bridge
 *
 * When the bridge isn't reachable (e.g. a normal browser, or it's not set up
 * yet) it shows setup guidance plus the best-effort web embed as a fallback.
 */
const Music = (() => {
  const fmt = (us) => {
    const s = Math.max(0, Math.floor((us || 0) / 1e6));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  let host = null, mount = null, service = '24six';

  const SERVICES = [
    { id: '24six', name: '24six', color: '#bf5af2' },
    { id: 'apple', name: 'Apple Music', color: '#fa233b', soon: true },
    { id: 'spotify', name: 'Spotify', color: '#1db954', soon: true },
  ];
  const allowed = (id) => !Store.get('parental.enabled') || (Store.get('parental.musicServices') || {})[id] !== false;

  function render(h) {
    host = h;
    if (!allowed(service)) service = '24six';
    renderHub();
  }

  function renderHub() {
    host.innerHTML = `
      <div class="svc-bar">${SERVICES.map((s) => `
        <button class="svc ${service === s.id ? 'on' : ''} ${!allowed(s.id) ? 'locked' : ''}" data-s="${s.id}" style="--svc:${s.color}">
          ${s.name}${!allowed(s.id) ? ' 🔒' : ''}</button>`).join('')}</div>
      <div class="svc-body" id="svc-body"></div>`;
    host.querySelectorAll('.svc').forEach((b) => b.onclick = () => {
      if (!allowed(b.dataset.s)) return App.toast('🔒 Restricted by Parental Controls');
      service = b.dataset.s; renderHub();
    });
    mount = host.querySelector('#svc-body');
    if (service === '24six') (Bridge.isAvailable() ? renderPlayer() : renderSetup());
    else renderComingSoon(SERVICES.find((s) => s.id === service));
  }

  function renderComingSoon(svc) {
    mount.innerHTML = `
      <div class="coming-soon">
        <div class="cs-logo" style="background:${svc.color}">${svc.id === 'spotify' ? '🟢' : '🍎'}</div>
        <h2>${svc.name}</h2>
        <div class="cs-badge">Coming Soon</div>
        <p>Streaming from ${svc.name} will arrive in a future CycleScreen update.</p>
      </div>`;
  }

  /* ---- native player (bridge connected) ---- */
  function renderPlayer() {
    const np = Bridge.now();
    const has = np && np.title;
    const art = has && np.artUrl ? `<img src="${np.artUrl}" alt="">` : '🎵';
    const playing = np && np.status === 'playing';
    const pct = has && np.length ? Math.min(100, (np.position / np.length) * 100) : 0;

    mount.innerHTML = `
      <div class="music-hero">
        <div class="music-art ${playing ? 'spin' : ''}" id="mart">${art}</div>
        <div class="music-meta">
          <div class="music-brand">24SIX • ${has ? (playing ? 'NOW PLAYING' : 'PAUSED') : 'READY'}</div>
          <div class="music-track-title" id="mtitle">${has ? np.title : 'Nothing playing'}</div>
          <div class="music-track-artist" id="martist">${has ? (np.artist || '') : 'Open 24six and pick a song'}</div>
        </div>
      </div>
      <div class="music-progress"><div class="fill" id="mfill" style="width:${pct}%"></div></div>
      <div class="music-times"><span>${has ? fmt(np.position) : '0:00'}</span><span>${has ? fmt(np.length) : '0:00'}</span></div>
      <div class="music-controls">
        <button id="mprev"><svg width="30" height="30" viewBox="0 0 24 24"><path d="M19 20L9 12l10-8v16zM5 19V5" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linejoin="round"/></svg></button>
        <button id="mplay" class="music-play"></button>
        <button id="mnext"><svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 4l10 8-10 8V4zM19 5v14" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linejoin="round"/></svg></button>
      </div>
      <div class="app-pad">
        <button class="btn btn--block btn--pill" id="open24" style="background:linear-gradient(135deg,#bf5af2,#ff375f)">Open 24six app</button>
        <p style="text-align:center;color:var(--text-2);font-size:12px;margin-top:10px">
          Pick a song in 24six — CycleScreen returns automatically when it starts.</p>
      </div>`;

    paintPlay(playing);
    mount.querySelector('#mplay').onclick = () => Bridge.control('playpause');
    mount.querySelector('#mnext').onclick = () => Bridge.control('next');
    mount.querySelector('#mprev').onclick = () => Bridge.control('previous');
    mount.querySelector('#open24').onclick = () => { Bridge.launch(); App.toast('Opening 24six…'); };
  }

  function paintPlay(playing) {
    const b = mount && mount.querySelector('#mplay'); if (!b) return;
    b.innerHTML = playing
      ? '<svg width="26" height="26" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
      : '<svg width="26" height="26" viewBox="0 0 24 24" style="margin-left:3px"><path d="M7 4l13 8-13 8V4z"/></svg>';
  }

  /* ---- setup / fallback (bridge not connected) ---- */
  let usingEmbed = false;
  function renderSetup() {
    if (usingEmbed) return renderEmbed();
    mount.innerHTML = `
      <div class="app-pad" style="max-width:520px;margin:0 auto">
        <div style="text-align:center;padding:8px 0 6px"><div style="font-size:48px">🎵</div>
          <h3 style="margin:6px 0 2px">Connect 24six</h3>
          <p style="color:var(--text-2);font-size:13px;margin:0">Run the 24six app on the Pi with the CycleScreen bridge for real login &amp; playback.</p>
        </div>
        <div class="list" style="margin-top:14px">
          <div class="list-row"><div class="lr-icon" style="background:#34c759">1</div><div class="lr-main"><div class="lr-title">Install the bridge</div><div class="lr-sub">pi/cyclescreen-bridge.py + playerctl, wmctrl</div></div></div>
          <div class="list-row"><div class="lr-icon" style="background:#0a84ff">2</div><div class="lr-main"><div class="lr-title">Run the native 24six app</div><div class="lr-sub">Android (Waydroid) or desktop build</div></div></div>
          <div class="list-row"><div class="lr-icon" style="background:#bf5af2">3</div><div class="lr-main"><div class="lr-title">Set the bridge URL</div><div class="lr-sub" id="setup-url">${Bridge.base()}</div></div><div class="lr-trail" id="setup-edit">Edit ›</div></div>
        </div>
        <button class="btn btn--block btn--pill" id="setup-web" style="margin-top:14px">Use 24six web player instead</button>
        <p style="text-align:center;color:var(--text-3);font-size:11px;margin-top:8px">Web player can't keep you logged in (24six blocks embedding).</p>
      </div>`;
    mount.querySelector('#setup-edit').onclick = () => App.open('settings');
    mount.querySelector('#setup-web').onclick = () => { usingEmbed = true; renderEmbed(); };
  }

  function renderEmbed() {
    mount.innerHTML = `<div class="t24-wrap">
      <iframe class="t24-frame" src="/24six/" allow="autoplay; encrypted-media; microphone; clipboard-write; fullscreen"></iframe>
    </div>`;
  }

  /* live updates while the player screen is open */
  function refresh() {
    if (host && mount && document.body.contains(host) && service === '24six' && Bridge.isAvailable() && !usingEmbed) renderPlayer();
  }
  Bridge.on('nowplaying', refresh);
  Bridge.on('status', () => { usingEmbed = false; refresh(); });

  return { render };
})();
