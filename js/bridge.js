/* bridge.js — talks to the CycleScreen companion service on the Pi.
 *
 * The native 24six app (run on the Pi) exposes its playback over Linux MPRIS.
 * A small local service (see pi/cyclescreen-bridge.py) surfaces that as a
 * localhost HTTP API. CycleScreen polls it for "now playing" and sends
 * play/pause/next, launches the 24six app, and asks the bridge to bring the
 * kiosk back to the foreground.
 *
 * If the bridge isn't running (e.g. testing in a normal browser) everything
 * degrades gracefully — isAvailable() stays false and the Music app shows
 * setup instructions instead.
 */
const Bridge = (() => {
  const listeners = {};
  const emit = (ev, d) => (listeners[ev] || []).forEach((fn) => fn(d));
  const on = (ev, fn) => ((listeners[ev] = listeners[ev] || []).push(fn), fn);

  let available = false, np = null, timer = null, wasPlaying = false;

  const base = () => (Store.get('bridge.url') || 'http://127.0.0.1:8765').replace(/\/+$/, '');

  async function poll() {
    try {
      const r = await fetch(base() + '/nowplaying', { cache: 'no-store' });
      if (!r.ok) throw new Error('bad');
      const j = await r.json();
      if (!available) { available = true; emit('status', true); }
      np = j;
      emit('nowplaying', j);
      // when a track starts playing, surface the now-playing on the dashboard
      if (j && j.status === 'playing' && !wasPlaying) emit('startedplaying', j);
      wasPlaying = j && j.status === 'playing';
    } catch {
      if (available) { available = false; emit('status', false); }
      np = null; wasPlaying = false;
      emit('nowplaying', null);
    }
  }

  function start() { poll(); clearInterval(timer); timer = setInterval(poll, 2000); }

  async function control(cmd) { // playpause | next | previous
    try { await fetch(base() + '/control/' + cmd, { method: 'POST' }); setTimeout(poll, 250); } catch {}
  }
  async function launch() { try { await fetch(base() + '/launch', { method: 'POST' }); } catch {} }
  async function focusKiosk() { try { await fetch(base() + '/focus', { method: 'POST' }); } catch {} }

  return { start, on, control, launch, focusKiosk, isAvailable: () => available, now: () => np, base };
})();
