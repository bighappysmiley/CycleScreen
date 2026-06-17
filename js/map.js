/* map.js — the dashboard map.
 *
 * Uses Google Maps when a key is supplied via window.CYCLESCREEN_GMAPS_KEY,
 * otherwise falls back to Leaflet + OpenStreetMap tiles so it works with zero
 * configuration. Exposes a tiny common interface either way.
 */
const MapView = (() => {
  let map, marker, trail, trailCoords = [], ready = false, follow = true;

  function init() {
    const el = document.getElementById('map');
    map = L.map(el, { zoomControl: false, attributionControl: true, fadeAnimation: true });
    const dark = document.body.dataset.theme === 'dark';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap, © CARTO',
    }).addTo(map);

    const c = Device.state.coords;
    map.setView([c.lat, c.lng], 16);

    const icon = L.divIcon({ className: 'rider-dot', html: '<div class="core rider-pulse"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
    marker = L.marker([c.lat, c.lng], { icon }).addTo(map);
    trail = L.polyline([], { color: '#0a84ff', weight: 5, opacity: .8, lineCap: 'round' }).addTo(map);

    // dragging the map pauses auto-follow; a tap on the rider re-centers.
    map.on('dragstart', () => { follow = false; });
    marker.on('click', () => { follow = true; recenter(); });

    ready = true;
    Device.on('gps', onGPS);
    onGPS(Device.state);
  }

  function onGPS(s) {
    if (!ready) return;
    const ll = [s.coords.lat, s.coords.lng];
    marker.setLatLng(ll);
    trailCoords.push(ll);
    if (trailCoords.length > 400) trailCoords.shift();
    trail.setLatLngs(trailCoords);
    if (follow) map.panTo(ll, { animate: true, duration: 0.5 });
  }

  function recenter() { if (ready) { follow = true; map.setView([Device.state.coords.lat, Device.state.coords.lng], 16, { animate: true }); } }
  function invalidate() { if (ready) setTimeout(() => map.invalidateSize(), 60); }

  return { init, recenter, invalidate };
})();
