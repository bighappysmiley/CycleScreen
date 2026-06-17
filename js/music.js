/* music.js — Spotify & Apple Music via their official embed players.
 *
 * Both services provide embeddable iframe players designed to be framed (no
 * X-Frame-Options issues): they play previews for everyone and full tracks for
 * signed-in subscribers. The embedded content (playlist/album) is configurable
 * in js/firebase-config.js → window.CYCLESCREEN_MUSIC.
 */
const Music = (() => {
  const cfg = () => window.CYCLESCREEN_MUSIC || {};

  const SERVICES = [
    { id: 'spotify', name: 'Spotify',     color: '#1db954', logo: Icons.spotify },
    { id: 'apple',   name: 'Apple Music', color: '#fa233b', logo: Icons.apple },
  ];
  const allowed = (id) => !Store.get('parental.enabled') || (Store.get('parental.musicServices') || {})[id] !== false;

  let host = null, mount = null, service = Store.get('music.service') || 'spotify';

  function render(h) {
    host = h;
    if (!allowed(service)) service = SERVICES.find((s) => allowed(s.id))?.id || 'spotify';
    renderHub();
  }

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
    service === 'spotify' ? renderSpotify() : renderApple();
  }

  function frame(src) {
    return `<div class="embed-wrap"><iframe class="embed-frame" src="${src}"
      allow="autoplay *; encrypted-media *; clipboard-write; fullscreen"
      loading="lazy"></iframe></div>`;
  }

  function renderSpotify() {
    const path = cfg().spotify || 'playlist/37i9dQZF1DXcBWIGoYBM5M'; // Today's Top Hits (default)
    mount.innerHTML = frame(`https://open.spotify.com/embed/${path}?utm_source=cyclescreen`);
  }

  function renderApple() {
    const path = cfg().apple; // e.g. "us/playlist/.../pl.xxxxxxxx"
    if (!path) { mount.innerHTML = setupCard('Apple Music', 'apple'); return; }
    mount.innerHTML = frame(`https://embed.music.apple.com/${path}`);
  }

  function setupCard(name, id) {
    return `<div class="coming-soon">
      <div class="cs-logo" style="background:${SERVICES.find((s) => s.id === id).color}">${SERVICES.find((s) => s.id === id).logo}</div>
      <h2>${name}</h2>
      <p>Add a default ${name} playlist/album to <code>window.CYCLESCREEN_MUSIC.${id}</code> in js/firebase-config.js to play it here.</p>
    </div>`;
  }

  return { render };
})();
