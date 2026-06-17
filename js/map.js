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

    // long-press (or right-click) to drop your location pin — works even when
    // GPS is wrong and the place-search geocoder is blocked by a filter.
    map.on('contextmenu', (e) => {
      const { lat, lng } = e.latlng;
      App.sheet('Set your location here?', `
        <p style="font-size:13px;color:var(--text-2);margin:0 0 12px">${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
        <button class="btn btn--block" id="loc-here">Pin my location here</button>`, (root, close) => {
        root.querySelector('#loc-here').onclick = () => {
          Device.setManualLocation(lat, lng, 'Pinned location');
          recenter(); close(); App.toast('📍 Location set');
        };
      });
    });

    ready = true;
    Device.on('gps', onGPS);
    onGPS(Device.state);
  }

  let snappedReal = false;
  function onGPS(s) {
    if (!ready) return;
    const ll = [s.coords.lat, s.coords.lng];
    marker.setLatLng(ll);
    // first real (non-simulated) fix can be far from the default — snap, don't slow-pan
    if (!snappedReal && !s.simulated) {
      snappedReal = true; trailCoords = [];
      map.setView(ll, 16); marker.setLatLng(ll); trail.setLatLngs([]); return;
    }
    trailCoords.push(ll);
    if (trailCoords.length > 400) trailCoords.shift();
    trail.setLatLngs(trailCoords);
    if (follow) map.panTo(ll, { animate: true, duration: 0.5 });
  }

  function recenter() { if (ready) { follow = true; map.setView([Device.state.coords.lat, Device.state.coords.lng], 16, { animate: true }); } }
  function invalidate() { if (ready) setTimeout(() => map.invalidateSize(), 60); }

  let searchMarker = null;
  function goTo(lat, lng, label) {
    if (!ready) return;
    follow = false;
    map.setView([lat, lng], 15, { animate: true });
    if (searchMarker) searchMarker.remove();
    searchMarker = L.marker([lat, lng]).addTo(map);
    if (label) searchMarker.bindPopup(label).openPopup();
  }

  return { init, recenter, invalidate, goTo };
})();
