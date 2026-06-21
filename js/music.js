/* music.js — Music app with a service sidebar (24Six / Apple Music / Spotify /
 * Local). The streaming services are Coming Soon; "Local" is a working player
 * for music transferred onto the device (e.g. over Bluetooth), imported via the
 * file picker and kept in IndexedDB so it persists across reloads.
 */
const Music = (() => {
  const SERVICES = [
    { id: '24six',   name: '24Six',       color: '#bf5af2', logo: Icons.note,    soon: true },
    { id: 'apple',   name: 'Apple Music', color: '#fa233b', logo: Icons.apple,   soon: true },
    { id: 'spotify', name: 'Spotify',     color: '#1db954', logo: Icons.spotify, soon: true },
    { id: 'local',   name: 'Local',       color: '#34c759', logo: Icons.download },
  ];
  const allowed = (id) => !Store.get('parental.enabled') || (Store.get('parental.musicServices') || {})[id] !== false;

  let host = null, mount = null, service = Store.get('music.service') || 'local';

  /* ---------------- local library (IndexedDB) ---------------- */
  const DB = 'cyclescreen-music', STORE = 'tracks';
  function db() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function libList() { const d = await db(); return new Promise((res) => { const out = []; const tx = d.transaction(STORE); tx.objectStore(STORE).openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { out.push({ id: c.value.id, name: c.value.name }); c.continue(); } else res(out); }; }); }
  async function libGet(id) { const d = await db(); return new Promise((res) => { const r = d.transaction(STORE).objectStore(STORE).get(id); r.onsuccess = () => res(r.result); }); }
  async function libPut(t) { const d = await db(); return new Promise((res) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(t); tx.oncomplete = res; }); }
  async function libDel(id) { const d = await db(); return new Promise((res) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete = res; }); }

  // Optional Pi helper that serves a Bluetooth-received music folder (pi/cyclescreen-music.py).
  const serverBase = () => (Store.get('musicServer.url') || 'http://127.0.0.1:8780').replace(/\/+$/, '');
  async function serverTracks() {
    try { const r = await fetch(serverBase() + '/tracks', { cache: 'no-store' }); if (!r.ok) throw 0; return (await r.json()).map((t) => ({ id: t.id, name: t.name, source: 'pi' })); }
    catch { return []; }
  }

  const audio = new Audio();
  let library = [], idx = -1, playing = false, curUrl = null;
  const niceName = (n) => n.replace(/\.[a-z0-9]+$/i, '');

  audio.addEventListener('play', () => { playing = true; paintLocal(); });
  audio.addEventListener('pause', () => { playing = false; paintLocal(); });
  audio.addEventListener('ended', () => next());

  async function playIndex(i) {
    if (i < 0 || i >= library.length) return;
    idx = i;
    const meta = library[i];
    if (curUrl) { URL.revokeObjectURL(curUrl); curUrl = null; }
    let src;
    if (meta.source === 'pi') {
      src = serverBase() + '/file?name=' + encodeURIComponent(meta.id);
    } else {
      const rec = await libGet(meta.id); if (!rec) return;
      curUrl = URL.createObjectURL(rec.blob); src = curUrl;
    }
    audio.src = src;
    audio.play().catch(() => App.toast('Tap play to start audio'));
    renderLocal();
  }
  function toggle() { if (idx < 0) return playIndex(0); playing ? audio.pause() : audio.play(); }
  function next() { if (library.length) playIndex((idx + 1) % library.length); }
  function prev() { if (library.length) playIndex((idx - 1 + library.length) % library.length); }

  /* ---------------- UI ---------------- */
  function render(h) { host = h; if (!allowed(service)) service = SERVICES.find((s) => allowed(s.id))?.id || 'local'; renderHub(); }

  function renderHub() {
    host.innerHTML = `
      <div class="svc-bar">${SERVICES.map((s) => `
        <button class="svc ${service === s.id ? 'on' : ''} ${!allowed(s.id) ? 'locked' : ''}" data-s="${s.id}" style="--svc:${s.color}">
          <span class="svc-logo">${s.logo}</span>${s.name}${!allowed(s.id) ? '<span class="svc-lock">' + Icons.lock + '</span>' : ''}</button>`).join('')}</div>
      <div class="svc-body" id="svc-body"></div>`;
    host.querySelectorAll('.svc').forEach((b) => b.onclick = () => {
      if (!allowed(b.dataset.s)) return App.toast('Restricted by Parental Controls');
      service = b.dataset.s; Store.set('music.service', service); renderHub();
    });
    mount = host.querySelector('#svc-body');
    const svc = SERVICES.find((s) => s.id === service);
    svc.soon ? renderComingSoon(svc) : renderLocal();
  }

  function renderComingSoon(svc) {
    mount.innerHTML = `
      <div class="coming-soon">
        <div class="cs-logo" style="background:${svc.color}">${svc.logo}</div>
        <h2>${svc.name}</h2>
        <div class="cs-badge">Coming Soon</div>
        <p>Streaming from ${svc.name} will arrive in a future CycleScreen update. For now, use <b>Local</b> for your own music.</p>
      </div>`;
  }

  async function renderLocal() {
    const [pi, idb] = await Promise.all([serverTracks(), libList()]);
    library = [...pi, ...idb.map((t) => ({ ...t, source: 'idb' }))];
    const cur = idx >= 0 && library[idx];
    mount.innerHTML = `
      <div class="local-np">
        <div class="local-art ${playing ? 'spin' : ''}">${Icons.note}</div>
        <div class="local-meta">
          <div class="music-kicker">LOCAL · ${cur ? (playing ? 'PLAYING' : 'PAUSED') : 'READY'}</div>
          <div class="local-title">${cur ? esc(niceName(cur.name)) : 'No track selected'}</div>
        </div>
      </div>
      <div class="local-controls">
        <button id="lp-prev" aria-label="Previous"><svg width="26" height="26" viewBox="0 0 24 24"><path d="M19 20L9 12l10-8v16zM5 19V5" fill="currentColor"/></svg></button>
        <button id="lp-play" class="music-play"></button>
        <button id="lp-next" aria-label="Next"><svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 4l10 8-10 8V4zM19 5v14" fill="currentColor"/></svg></button>
      </div>
      <div class="app-pad">
        <div class="local-head">
          <div class="list-section-title" style="margin:0">Library · ${library.length}</div>
          <button class="btn btn--pill" id="lp-add" style="padding:7px 14px;font-size:13px">＋ Add music</button>
        </div>
        <input type="file" id="lp-file" accept="audio/*" multiple hidden />
        ${library.length ? `<div class="list">${library.map((t, i) => `
          <div class="list-row track-row ${i === idx ? 'playing' : ''}" data-i="${i}">
            <div class="lr-icon" style="background:${i === idx && playing ? 'var(--accent-2)' : 'var(--fill)'};color:${i === idx && playing ? '#fff' : 'var(--text-2)'}">${Icons.note}</div>
            <div class="lr-main"><div class="lr-title">${esc(niceName(t.name))}</div>${t.source === 'pi' ? '<div class="lr-sub">From Bluetooth folder</div>' : ''}</div>
            ${t.source === 'idb' ? `<button class="track-del" data-del="${t.id}" aria-label="Remove">${Icons.trash}</button>` : ''}
          </div>`).join('')}</div>`
          : `<div class="empty">No local music yet.<br>Transfer songs to the device over Bluetooth (auto-detected), or tap <b>Add music</b> to import files.</div>`}
      </div>`;

    paintLocal();
    mount.querySelector('#lp-play').onclick = toggle;
    mount.querySelector('#lp-next').onclick = next;
    mount.querySelector('#lp-prev').onclick = prev;
    mount.querySelector('#lp-add').onclick = () => mount.querySelector('#lp-file').click();
    mount.querySelector('#lp-file').onchange = async (e) => {
      const files = [...e.target.files]; e.target.value = '';
      for (const f of files) await libPut({ id: 'l' + Date.now() + Math.random().toString(36).slice(2, 6), name: f.name, blob: f });
      if (files.length) App.toast(`Added ${files.length} track${files.length > 1 ? 's' : ''}`);
      renderLocal();
    };
    mount.querySelectorAll('.track-row').forEach((r) => r.onclick = () => playIndex(+r.dataset.i));
    mount.querySelectorAll('.track-del').forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const id = b.dataset.del;
      const removingCur = idx >= 0 && library[idx] && library[idx].id === id;
      if (removingCur) { audio.pause(); audio.removeAttribute('src'); idx = -1; }
      await libDel(id); renderLocal();
    });
  }

  function paintLocal() {
    const b = mount && mount.querySelector('#lp-play'); if (!b) return;
    b.innerHTML = playing
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-left:3px"><path d="M7 4l13 8-13 8V4z"/></svg>';
    const art = mount.querySelector('.local-art'); if (art) art.classList.toggle('spin', playing);
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  return { render };
})();
