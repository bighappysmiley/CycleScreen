/* music.js — 24SIX-style music player.
 *
 * The catalog below stands in for the 24six streaming service; on the Pi the
 * `src` URLs would point at the 24six API stream endpoints. Playback uses a
 * single shared <audio> element so the dashboard now-playing pill stays in
 * sync with the full player.
 */
const Music = (() => {
  const audio = new Audio();
  audio.preload = 'none';

  const catalog = [
    { id: 1, title: 'Tracht Gut',      artist: 'Benny Friedman', dur: 214, art: '🎵' },
    { id: 2, title: 'Im Eshkachech',   artist: 'Abie Rotenberg', dur: 252, art: '🎶' },
    { id: 3, title: 'One Day',         artist: 'Yaakov Shwekey',  dur: 233, art: '🎼' },
    { id: 4, title: 'Yesh Tikva',      artist: 'Mordechai Ben David', dur: 198, art: '🎹' },
    { id: 5, title: 'Kol Haolam',      artist: 'Eitan Katz',     dur: 276, art: '🪕' },
    { id: 6, title: 'Hofaim',          artist: 'Ishay Ribo',     dur: 241, art: '🎤' },
  ];

  let idx = 0, playing = false, pos = 0, ticker = null;
  const subs = [];
  const onChange = (fn) => subs.push(fn);
  const notify = () => subs.forEach((f) => f(stateView()));
  const cur = () => catalog[idx];
  function stateView() { return { track: cur(), playing, pos, dur: cur().dur, idx }; }

  function play(i) {
    if (i != null && i !== idx) { idx = i; pos = 0; }
    playing = true;
    // (real audio.src would be set here; we simulate progress for the demo)
    startTicker();
    notify();
  }
  function pause() { playing = false; stopTicker(); notify(); }
  function toggle() { playing ? pause() : play(); }
  function next() { idx = (idx + 1) % catalog.length; pos = 0; if (playing) startTicker(); notify(); }
  function prev() { if (pos > 4) { pos = 0; } else { idx = (idx - 1 + catalog.length) % catalog.length; } if (playing) startTicker(); notify(); }
  function seek(frac) { pos = Math.max(0, Math.min(1, frac)) * cur().dur; notify(); }

  function startTicker() {
    stopTicker();
    ticker = setInterval(() => {
      pos += 1;
      if (pos >= cur().dur) { Store.get('music.repeat') ? (pos = 0) : next(); }
      notify();
    }, 1000);
  }
  function stopTicker() { if (ticker) clearInterval(ticker); ticker = null; }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* ----- 24six: load the real service (no public API → embed + launch) ----- */
  const URL_24SIX = 'https://24six.app';
  function render(host) {
    host.innerHTML = `
      <div class="t24-wrap">
        <div class="t24-bar">
          <div class="music-brand" style="margin:0">24SIX MUSIC</div>
          <a class="btn btn--pill" id="t24-open" href="${URL_24SIX}" target="_blank" rel="noopener">Open 24six ↗</a>
        </div>
        <iframe class="t24-frame" id="t24-frame" src="${URL_24SIX}"
                allow="autoplay; encrypted-media; microphone; clipboard-write"
                referrerpolicy="no-referrer"></iframe>
        <div class="t24-fallback" id="t24-fallback" hidden>
          <div style="font-size:48px">🎵</div>
          <h3 style="margin:6px 0">Open 24six</h3>
          <p style="color:var(--text-2);max-width:320px;margin:0 auto 14px">
            24six is a closed app with no embeddable web player, so it can't run inside CycleScreen.
            Tap below to open the real 24six.</p>
          <a class="btn btn--pill" href="${URL_24SIX}" target="_blank" rel="noopener" style="background:linear-gradient(135deg,#bf5af2,#ff375f)">Open 24six ↗</a>
        </div>
      </div>`;

    const frame = host.querySelector('#t24-frame');
    let loaded = false;
    frame.addEventListener('load', () => { loaded = true; });
    // Most streaming apps block framing (X-Frame-Options/CSP); if it doesn't
    // appear, fall back to the guaranteed launch button.
    setTimeout(() => { if (!loaded) { frame.style.display = 'none'; host.querySelector('#t24-fallback').hidden = false; } }, 4500);

    // launching the real app from a kiosk: open in a new window/tab
    host.querySelector('#t24-open').onclick = (e) => { e.preventDefault(); window.open(URL_24SIX, '_blank', 'noopener'); };
  }

  function paintPlay(host) {
    const b = host.querySelector('#mplay'); if (!b) return;
    b.innerHTML = playing
      ? '<svg width="26" height="26" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
      : '<svg width="26" height="26" viewBox="0 0 24 24" style="margin-left:3px"><path d="M7 4l13 8-13 8V4z"/></svg>';
    const art = host.querySelector('#mart'); if (art) art.classList.toggle('spin', playing);
  }
  function paintProgress(host) {
    const f = host.querySelector('#mfill'); if (!f) return;
    f.style.width = (pos / cur().dur * 100) + '%';
    host.querySelector('#mcur').textContent = fmt(pos);
  }

  const music = { render, play, pause, toggle, next, prev, onChange, stateView, _host: null };
  // keep the open player view live
  onChange(() => { if (music._host && document.body.contains(music._host)) { paintPlay(music._host); paintProgress(music._host); } });
  return music;
})();
