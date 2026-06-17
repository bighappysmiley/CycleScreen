/* state.js — persistent app store (localStorage). */
const Store = (() => {
  const KEY = 'cyclescreen.v1';
  const defaults = {
    profile: { name: 'Or Frankel', username: 'orf', initials: 'OF', units: 'metric' },
    theme: 'dark',
    accent: '#0a84ff',
    quickDial: [
      { name: 'Maya',  phone: '+972500000001', initials: 'M', color: '#ff375f' },
      { name: 'Dad',   phone: '+972500000002', initials: 'D', color: '#0a84ff' },
      { name: 'Eitan', phone: '+972500000003', initials: 'E', color: '#30d158' },
      null,
    ],
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
    music: { volume: 0.7, shuffle: false, repeat: false },
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
