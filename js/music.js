/* music.js — Spotify via its official embed player.
 *
 * Spotify's iframe embed is designed to be framed (no X-Frame-Options issues):
 * it plays previews for everyone and full tracks for signed-in subscribers. The
 * embedded content (playlist/album) is configurable in js/firebase-config.js →
 * window.CYCLESCREEN_MUSIC. (Apple Music was removed — commonly blocked by
 * content filters; the SERVICES array makes it easy to add services back.)
 */
const Music = (() => {
  const cfg = () => window.CYCLESCREEN_MUSIC || {};

  const SERVICES = [
    { id: 'spotify', name: 'Spotify', color: '#1db954', logo: Icons.spotify },
  ];
  const allowed = (id) => !Store.get('parental.enabled') || (Store.get('parental.musicServices') || {})[id] !== false;

  let host = null, mount = null, service = Store.get('music.service') || 'spotify';

  function render(h) {
    host = h;
    if (!allowed(service)) service = SERVICES.find((s) => allowed(s.id))?.id || 'spotify';
    renderHub();
  }

  function renderHub() {
    // Single service → no tab bar needed; show more than one and the bar appears.
    const bar = SERVICES.length > 1 ? `<div class="svc-bar">${SERVICES.map((s) => `
        <button class="svc ${service === s.id ? 'on' : ''} ${!allowed(s.id) ? 'locked' : ''}" data-s="${s.id}" style="--svc:${s.color}">
          <span class="svc-logo">${s.logo}</span>${s.name}${!allowed(s.id) ? '<span class="svc-lock">' + Icons.lock + '</span>' : ''}</button>`).join('')}</div>` : '';
    host.innerHTML = `${bar}<div class="svc-body" id="svc-body"></div>`;
    host.querySelectorAll('.svc').forEach((b) => b.onclick = () => {
      if (!allowed(b.dataset.s)) return App.toast('Restricted by Parental Controls');
      service = b.dataset.s; Store.set('music.service', service); renderHub();
    });
    mount = host.querySelector('#svc-body');
    renderSpotify();
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

  return { render };
})();
