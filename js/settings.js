/* settings.js — appearance, profile, quick-dial, parental controls, about. */
const Settings = (() => {
  const accents = ['#0a84ff','#30d158','#ff375f','#bf5af2','#ff9f0a','#64d2ff'];

  function render(host) {
    const p = Store.get('profile');
    const par = Store.get('parental');
    host.innerHTML = `<div class="settings-pad">
      <div class="profile-head">
        <div class="avatar">${p.initials}</div>
        <div class="pname">${p.name}</div>
        <div class="puser">@${p.username}</div>
      </div>

      <div class="list-section-title">Appearance</div>
      <div class="list">
        <div class="list-row"><div class="lr-icon" style="background:#5e5ce6">◐</div>
          <div class="lr-main"><div class="lr-title">Theme</div></div>
          <div class="segmented" id="theme-seg" style="width:150px">
            <button data-v="light">Light</button><button data-v="dark">Dark</button>
          </div></div>
        <div class="list-row"><div class="lr-icon" style="background:var(--accent)">🎨</div>
          <div class="lr-main"><div class="lr-title">Accent Color</div>
            <div class="swatch-row" id="swatches">${accents.map((c) => `<button class="swatch" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
          </div></div>
      </div>

      <div class="list-section-title">Profile</div>
      <div class="list">
        <div class="list-row" id="edit-name"><div class="lr-icon" style="background:#0a84ff">👤</div>
          <div class="lr-main"><div class="lr-title">Name</div></div><div class="lr-trail">${p.name} ›</div></div>
        <div class="list-row" id="edit-user"><div class="lr-icon" style="background:#5856d6">＠</div>
          <div class="lr-main"><div class="lr-title">Username</div></div><div class="lr-trail">@${p.username} ›</div></div>
        <div class="list-row"><div class="lr-icon" style="background:#ff9f0a">📐</div>
          <div class="lr-main"><div class="lr-title">Units</div></div>
          <div class="segmented" id="units-seg" style="width:160px">
            <button data-v="metric">km/h</button><button data-v="imperial">mph</button>
          </div></div>
      </div>

      <div class="list-section-title">Connectivity</div>
      <div class="list">
        <div class="list-row" id="bt-row"><div class="lr-icon" style="background:#0a84ff">
          <svg width="16" height="16" viewBox="0 0 24 24"><path d="M6.5 6.5 17 17l-5 5V2l5 5L6.5 17.5" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></div>
          <div class="lr-main"><div class="lr-title">Bluetooth (Phone)</div><div class="lr-sub" id="bt-sub">Not connected</div></div>
          <div class="lr-trail" id="bt-act">Connect</div></div>
        <div class="list-row" id="dial-edit"><div class="lr-icon" style="background:#30d158">📞</div>
          <div class="lr-main"><div class="lr-title">Quick Dial Contacts</div></div><div class="lr-trail">Edit ›</div></div>
      </div>

      <div class="list-section-title">Parental Controls</div>
      <div class="list">
        <div class="list-row"><div class="lr-icon" style="background:#ff375f">🛡️</div>
          <div class="lr-main"><div class="lr-title">Enable Controls</div><div class="lr-sub">PIN-protected limits</div></div>
          <label class="switch"><input type="checkbox" id="par-en" ${par.enabled?'checked':''}><span class="track"></span><span class="thumb"></span></label></div>
        <div class="list-row"><div class="lr-icon" style="background:#ff9f0a">⚡</div>
          <div class="lr-main"><div class="lr-title">Speed Alert</div><div class="lr-sub">Warn above limit</div></div>
          <div class="lr-trail"><input class="field" id="par-speed" type="number" style="width:64px;margin:0;padding:7px;text-align:center" value="${par.maxSpeedAlert}"> km/h</div></div>
        <div class="list-row"><div class="lr-icon" style="background:#bf5af2">🎵</div>
          <div class="lr-main"><div class="lr-title">Restrict Music</div></div>
          <label class="switch"><input type="checkbox" id="par-music" ${par.blockMusic?'checked':''}><span class="track"></span><span class="thumb"></span></label></div>
        <div class="list-row"><div class="lr-icon" style="background:#5856d6">👥</div>
          <div class="lr-main"><div class="lr-title">Restrict Friends</div></div>
          <label class="switch"><input type="checkbox" id="par-friends" ${par.blockFriends?'checked':''}><span class="track"></span><span class="thumb"></span></label></div>
        <div class="list-row" id="par-pin"><div class="lr-icon" style="background:#8e8e93">🔑</div>
          <div class="lr-main"><div class="lr-title">${par.pin?'Change':'Set'} PIN</div></div><div class="lr-trail">›</div></div>
      </div>

      <div class="list-section-title">About</div>
      <div class="list">
        <div class="list-row"><div class="lr-main"><div class="lr-title">CycleScreen</div><div class="lr-sub">Raspberry Pi • 7″ display • GLONASS GPS</div></div><div class="lr-trail">v1.0</div></div>
        <div class="list-row"><div class="lr-main"><div class="lr-title">GPS Source</div></div><div class="lr-trail" id="about-gps">—</div></div>
      </div>
    </div>`;

    // theme
    const themeSeg = host.querySelector('#theme-seg');
    const paintSeg = (seg, val) => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === val));
    paintSeg(themeSeg, Store.get('theme'));
    themeSeg.querySelectorAll('button').forEach((b) => b.onclick = () => { App.setTheme(b.dataset.v); paintSeg(themeSeg, b.dataset.v); });

    // accent
    host.querySelectorAll('#swatches .swatch').forEach((s) => {
      s.classList.toggle('sel', s.dataset.c === Store.get('accent'));
      s.onclick = () => { App.setAccent(s.dataset.c); host.querySelectorAll('#swatches .swatch').forEach((x) => x.classList.toggle('sel', x === s)); };
    });

    // units
    const unitsSeg = host.querySelector('#units-seg');
    paintSeg(unitsSeg, Store.get('profile.units'));
    unitsSeg.querySelectorAll('button').forEach((b) => b.onclick = () => { Store.set('profile.units', b.dataset.v); paintSeg(unitsSeg, b.dataset.v); Dashboard.refresh(); });

    // profile edits
    host.querySelector('#edit-name').onclick = () => editField('Name', 'name', () => render(host));
    host.querySelector('#edit-user').onclick = () => editField('Username', 'username', () => render(host));

    // bluetooth
    const btSync = () => {
      const s = Device.state;
      host.querySelector('#bt-sub').textContent = s.btConnected ? `Connected — ${s.btDevice}` : 'Not connected';
      host.querySelector('#bt-act').textContent = s.btConnected ? 'Disconnect' : 'Connect';
    };
    host.querySelector('#bt-row').onclick = async () => { Device.state.btConnected ? Device.disconnectBluetooth() : await Device.connectBluetooth(); btSync(); };
    btSync();
    host.querySelector('#about-gps').textContent = Device.state.simulated ? 'Simulated' : 'GLONASS (live)';

    host.querySelector('#dial-edit').onclick = () => dialSheet(() => render(host));

    // parental
    host.querySelector('#par-en').onchange = (e) => Store.set('parental.enabled', e.target.checked);
    host.querySelector('#par-speed').onchange = (e) => Store.set('parental.maxSpeedAlert', +e.target.value || 30);
    host.querySelector('#par-music').onchange = (e) => { Store.set('parental.blockMusic', e.target.checked); App.refreshDrawer(); };
    host.querySelector('#par-friends').onchange = (e) => { Store.set('parental.blockFriends', e.target.checked); App.refreshDrawer(); };
    host.querySelector('#par-pin').onclick = () => setPinSheet();
  }

  function editField(label, key, after) {
    App.sheet(`Edit ${label}`, `
      <input class="field" id="ef" value="${Store.get('profile.' + key)}" />
      <button class="btn btn--block" id="efgo">Save</button>`, (root, close) => {
      root.querySelector('#efgo').onclick = () => {
        const v = root.querySelector('#ef').value.trim(); if (!v) return;
        Store.set('profile.' + key, v);
        if (key === 'name') Store.set('profile.initials', v.split(/\s+/).map((w) => w[0]).join('').slice(0,2).toUpperCase());
        close(); Dashboard.refresh(); after && after();
      };
    });
  }

  function dialSheet(after) {
    const dials = Store.get('quickDial');
    App.sheet('Quick Dial Contacts', dials.map((d, i) => `
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
        <input class="field" style="margin:0;flex:1" data-i="${i}" data-f="name" placeholder="Name (slot ${i+1})" value="${d?.name||''}">
        <input class="field" style="margin:0;flex:1" data-i="${i}" data-f="phone" placeholder="Phone" value="${d?.phone||''}">
      </div>`).join('') + `<button class="btn btn--block" id="dialsave" style="margin-top:6px">Save Contacts</button>`,
    (root, close) => {
      root.querySelector('#dialsave').onclick = () => {
        const next = [null,null,null,null];
        root.querySelectorAll('input[data-i]').forEach((inp) => {
          const i = +inp.dataset.i; next[i] = next[i] || {};
          next[i][inp.dataset.f] = inp.value.trim();
        });
        const cleaned = next.map((c) => (c && c.name) ? { name: c.name, phone: c.phone || '', initials: c.name.slice(0,1).toUpperCase(), color: ['#ff375f','#0a84ff','#30d158','#bf5af2'][Math.floor(Math.random()*4)] } : null);
        Store.set('quickDial', cleaned); close(); Dashboard.refresh(); after && after();
      };
    });
  }

  function setPinSheet() {
    App.sheet('Set 4-digit PIN', `
      <input class="field" id="pin1" inputmode="numeric" maxlength="4" placeholder="New PIN">
      <input class="field" id="pin2" inputmode="numeric" maxlength="4" placeholder="Confirm PIN">
      <button class="btn btn--block" id="pingo">Save PIN</button>`, (root, close) => {
      root.querySelector('#pingo').onclick = () => {
        const a = root.querySelector('#pin1').value, b = root.querySelector('#pin2').value;
        if (a.length !== 4 || a !== b) return App.toast('PINs must match (4 digits)');
        Store.set('parental.pin', a); close(); App.toast('PIN saved');
      };
    });
  }

  return { render };
})();
