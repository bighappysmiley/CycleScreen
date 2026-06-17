/* security.js — manual screen lock + GPS anti-theft alarm.
 *
 * Two independent PINs live in the store:
 *   - security.lockPin   → unlocks the screen and cancels the theft alarm
 *   - parental.pin       → parental controls only (handled in settings.js)
 *
 * Locking is always manual (no auto-lock). The locked state is persisted, so
 * if the bike is powered off while locked it comes back up locked.
 */
const Security = (() => {

  /* ---------- generic PIN entry overlay ---------- */
  // opts: { emoji, title, sub, pin, onSuccess, dismissible, danger }
  function pinScreen(opts) {
    const ov = document.createElement('div');
    ov.className = 'locked-overlay' + (opts.danger ? ' alarm-overlay' : '');
    ov.innerHTML = `
      <div class="lock-emoji">${opts.emoji}</div>
      <div style="font-size:18px;font-weight:700">${opts.title}</div>
      <div style="color:var(--text-2);font-size:13px">${opts.sub || ''}</div>
      <div class="pin-dots">${'<span class="d"></span>'.repeat(4)}</div>
      <div class="keypad">${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k) => `<button data-k="${k}" ${k===''?'style="visibility:hidden"':''}>${k}</button>`).join('')}</div>
      ${opts.dismissible ? '<button class="lock-cancel" id="lock-cancel">Cancel</button>' : ''}`;
    document.body.append(ov);

    let entry = '';
    const dots = ov.querySelectorAll('.pin-dots .d');
    const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < entry.length));
    const shake = () => { ov.querySelector('.pin-dots').animate([{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'translateX(0)'}], {duration:300}); };

    ov.querySelectorAll('.keypad button').forEach((b) => b.onclick = () => {
      const k = b.dataset.k;
      if (k === '⌫') entry = entry.slice(0, -1);
      else if (entry.length < 4) entry += k;
      paint();
      if (entry.length === 4) {
        if (entry === opts.pin) { close(); opts.onSuccess && opts.onSuccess(); }
        else { shake(); entry = ''; setTimeout(paint, 80); }
      }
    });
    function close() { ov.style.opacity = 0; setTimeout(() => ov.remove(), 300); }
    if (opts.dismissible) { const c = ov.querySelector('#lock-cancel'); if (c) c.onclick = close; }
    return ov;
  }

  /* ---------- screen lock ---------- */
  function lockNow() {
    const pin = Store.get('security.lockPin');
    if (!pin) return App.toast('Set a Lock Passcode in Settings → Security first');
    Store.set('security.locked', true);
    showLockScreen();
  }
  function showLockScreen() {
    pinScreen({
      emoji: '🔒', title: 'CycleScreen Locked', sub: 'Enter your lock passcode',
      pin: Store.get('security.lockPin'),
      onSuccess: () => { Store.set('security.locked', false); },
    });
  }
  // called on boot — only shows if it was locked when last used (not auto-lock)
  function restoreLock() {
    if (Store.get('security.locked') && Store.get('security.lockPin')) showLockScreen();
  }

  /* ---------- anti-theft alarm ---------- */
  let anchor = null, triggered = false, audioCtx = null, sirenTimer = null, alarmOv = null, needsReanchor = false;

  function arm() {
    if (!Store.get('security.lockPin')) { App.toast('Set a Lock Passcode in Settings → Security first'); return false; }
    anchor = { ...Device.state.coords };
    triggered = false;
    // prime audio now (within the user gesture) so the siren isn't blocked later
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
    Store.set('security.alarmArmed', true);
    App.toast('🛡️ Anti-theft armed — move detection on');
    return true;
  }
  function disarm() {
    Store.set('security.alarmArmed', false);
    anchor = null; triggered = false;
    stopSiren();
    if (alarmOv) { alarmOv.remove(); alarmOv = null; }
  }

  function onGPS(s) {
    if (!Store.get('security.alarmArmed') || triggered) return;
    // after a reboot, anchor to the first real fix (avoids the default→real jump)
    if (needsReanchor) { if (s.simulated) return; anchor = { ...s.coords }; needsReanchor = false; return; }
    if (!anchor) { anchor = { ...s.coords }; return; }
    const moved = haversineM(anchor, s.coords);
    if (moved > Store.get('security.alarmThresholdM')) trigger(moved);
  }

  function trigger(moved) {
    triggered = true;
    startSiren();
    if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
    alarmOv = pinScreen({
      emoji: '🚨', danger: true, title: 'THEFT ALARM',
      sub: `Bike moved ${Math.round(moved)} m — enter passcode to cancel`,
      pin: Store.get('security.lockPin'),
      onSuccess: () => { alarmOv = null; disarm(); App.toast('Alarm cancelled'); },
    });
  }

  /* ---- siren via Web Audio (works with the USB speaker on the Pi) ---- */
  function startSiren() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const beep = () => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(880, audioCtx.currentTime);
        o.frequency.linearRampToValueAtTime(1480, audioCtx.currentTime + 0.5);
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.6, audioCtx.currentTime + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.55);
        o.connect(g).connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + 0.6);
      };
      beep(); sirenTimer = setInterval(beep, 650);
    } catch (e) { /* audio unavailable */ }
  }
  function stopSiren() { if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; } }

  function haversineM(a, b) {
    const R = 6371000, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function init() {
    Device.on('gps', onGPS);
    // if it was left armed, re-anchor once we have a real fix on boot
    if (Store.get('security.alarmArmed')) needsReanchor = true;
    restoreLock();
  }

  // Verify an arbitrary PIN (e.g. parental). onSuccess runs on match; cancellable.
  function verify(pin, title, onSuccess) {
    pinScreen({ emoji: '🔑', title, sub: 'Enter PIN', pin, onSuccess, dismissible: true });
  }

  return { init, lockNow, arm, disarm, verify, isArmed: () => Store.get('security.alarmArmed') };
})();
