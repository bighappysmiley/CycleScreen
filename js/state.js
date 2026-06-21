/* state.js — persistent app store (localStorage). */
const Store = (() => {
  const KEY = 'cyclescreen.v1';
  const defaults = {
    profile: { name: '', username: '', initials: '', units: 'imperial', photo: '' },
    onboarded: false,
    language: 'en',
    theme: 'dark',
    accent: '#0a84ff',
    quickDial: [null, null, null],
    groups: [], // each: { id, name, color, members:[{id,name,username,role}], messages:[], challenges:[] }
    parental: {
      enabled: false, pin: '', maxSpeedAlert: 30, blockMusic: false, blockFriends: false,
      bikeTime: { enabled: false, start: '21:00', end: '07:00' },
      musicServices: { '24six': true, apple: true, spotify: true, local: true },
      msgBlockedGroups: [], // group ids the user may NOT message in
    },
    security: { lockPin: '', locked: false, alarmArmed: false, alarmThresholdM: 20 },
    music: { volume: 0.7, shuffle: false, repeat: false, service: 'local' },
    musicServer: { url: 'http://127.0.0.1:8780' }, // Pi local-music helper
    gpsBridge: { url: 'http://127.0.0.1:8781' },    // Pi gpsd dongle bridge
    lastRide: null, // { date, distanceKm, durationSec, avgKmh }
    rides: [],      // ride history (newest first)
    manualLocation: null, // { lat, lng, label } — overrides GPS when set
  };

  let data = load();
  function load() {
    try { return Object.assign(structuredClone(defaults), JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch { return structuredClone(defaults); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }
  function get(path) { return path.split('.').reduce((o, k) => (o ? o[k] : undefined), data); }
  function set(path, val) {
    const keys = path.split('.'); const last = keys.pop();
    keys.reduce((o, k) => (o[k] = o[k] || {}), data)[last] = val;
    save();
  }
  function update(fn) { fn(data); save(); }
  return { data, get, set, update, save };
})();
