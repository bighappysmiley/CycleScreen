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

  /* ----- full-screen player UI ----- */
  function render(host) {
    const t = cur();
    host.innerHTML = `
      <div class="music-hero">
        <div class="music-art ${playing ? 'spin' : ''}" id="mart">${t.art}</div>
        <div class="music-meta">
          <div class="music-brand">24SIX • NOW PLAYING</div>
          <div class="music-track-title" id="mtitle">${t.title}</div>
          <div class="music-track-artist" id="martist">${t.artist}</div>
        </div>
      </div>
      <div class="music-progress" id="mprog"><div class="fill" id="mfill"></div></div>
      <div class="music-times"><span id="mcur">0:00</span><span id="mdur">${fmt(t.dur)}</span></div>
      <div class="music-controls">
        <button id="mshuffle" class="${Store.get('music.shuffle') ? 'on' : ''}" title="Shuffle">
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7M21 16v5h-5M14 14l7 7M3 3l7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button id="mprev"><svg width="30" height="30" viewBox="0 0 24 24"><path d="M19 20L9 12l10-8v16zM5 19V5"  stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linejoin="round"/></svg></button>
        <button id="mplay" class="music-play"></button>
        <button id="mnext"><svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 4l10 8-10 8V4zM19 5v14" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linejoin="round"/></svg></button>
        <button id="mrepeat" class="${Store.get('music.repeat') ? 'on' : ''}" title="Repeat">
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="app-pad">
        <div class="list-section-title">Up Next on 24six</div>
        <div class="list" id="mlist"></div>
      </div>`;

    const list = host.querySelector('#mlist');
    list.innerHTML = catalog.map((s, i) => `
      <div class="list-row playlist-row ${i === idx ? 'playing' : ''}" data-i="${i}">
        <div class="lr-icon">${i === idx && playing ? '♪' : i + 1}</div>
        <div class="lr-main"><div class="lr-title">${s.title}</div><div class="lr-sub">${s.artist}</div></div>
        <div class="lr-trail">${fmt(s.dur)}</div>
      </div>`).join('');
    list.querySelectorAll('.playlist-row').forEach((r) => r.onclick = () => { play(+r.dataset.i); render(host); });

    host.querySelector('#mplay').onclick = () => { toggle(); paintPlay(host); };
    host.querySelector('#mnext').onclick = () => { next(); render(host); };
    host.querySelector('#mprev').onclick = () => { prev(); render(host); };
    host.querySelector('#mshuffle').onclick = (e) => { Store.set('music.shuffle', !Store.get('music.shuffle')); e.currentTarget.classList.toggle('on'); };
    host.querySelector('#mrepeat').onclick = (e) => { Store.set('music.repeat', !Store.get('music.repeat')); e.currentTarget.classList.toggle('on'); };
    host.querySelector('#mprog').onclick = (e) => { const b = e.currentTarget.getBoundingClientRect(); seek((e.clientX - b.left) / b.width); paintProgress(host); };
    paintPlay(host); paintProgress(host);

    music._host = host;
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
