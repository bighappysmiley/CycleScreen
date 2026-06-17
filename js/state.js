/* state.js — persistent app store (localStorage). */
const Store = (() => {
  const KEY = 'cyclescreen.v1';
  const defaults = {
    profile: { name: '', username: '', initials: '', units: 'imperial' },
    onboarded: false,
    language: 'en',
    theme: 'dark',
    accent: '#0a84ff',
    quickDial: [null, null, null, null],
    friends: [
      { id: 'f1', name: 'Maya Levi',  username: 'mayal', initials: 'ML', presence: 'riding',  color: '#ff375f' },
      { id: 'f2', name: 'Eitan Cohen',username: 'eitanc',initials: 'EC', presence: 'online',  color: '#30d158' },
      { id: 'f3', name: 'Dana R.',    username: 'danar', initials: 'DR', presence: 'offline', color: '#bf5af2' },
    ],
    challenges: [
      { id: 'c1', type: 'race',     title: 'Sunset Sprint',  meta: '5 km • 3 riders', joined: true,  distance: 5 },
      { id: 'c2', type: 'climb',    title: 'Carmel Climb',   meta: '420 m ascent • 6 riders', joined: false, distance: 12 },
      { id: 'c3', type: 'distance', title: 'Weekly 100',     meta: '100 km this week', joined: true,  distance: 100 },
    ],
    parental: { enabled: false, pin: '', maxSpeedAlert: 30, blockMusic: false, blockFriends: false, curfewEnd: '' },
    security: { lockPin: '', locked: false, alarmArmed: false, alarmThresholdM: 20 },
    music: { volume: 0.7, shuffle: false, repeat: false },
    bridge: { url: 'http://127.0.0.1:8765' }, // CycleScreen companion service on the Pi
    lastRide: null, // { date, distanceKm, durationSec, avgKmh }
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
