/* settings.js — appearance, profile, quick-dial, parental controls, about. */
const Settings = (() => {
  const accents = ['#0a84ff','#30d158','#ff375f','#bf5af2','#ff9f0a','#64d2ff'];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let parentalUnlocked = false;            // unlocked for the current Settings visit
  function lockParental() { parentalUnlocked = false; }
  // True when parental changes must be PIN-verified first.
  const parentalLocked = () => { const par = Store.get('parental'); return par.enabled && par.pin && !parentalUnlocked; };
  // Run `after` once the parent is verified (or immediately if not locked).
  function requireParental(after) {
    if (!parentalLocked()) return after && after();
    Security.verify(Store.get('parental.pin'), 'Parental Controls', () => { parentalUnlocked = true; after && after(); });
  }

  function render(host) {
    const p = Store.get('profile');
    const par = Store.get('parental');
    const sec = Store.get('security');
    host.innerHTML = `<div class="settings-pad">
      <div class="profile-head">
        <div class="avatar-wrap">
          <button class="avatar avatar-edit" id="pf-avatar" title="Change photo">${p.photo ? `<img src="${p.photo}" alt="">` : (p.initials || '👤')}</button>
          <span class="avatar-cam">${Icons.camera}</span>
        </div>
        <input type="file" id="pf-photo" accept="image/*" hidden />
        <div class="pname">${p.name}</div>
        <div class="puser">@${p.username}</div>
      </div>

      <div class="list-section-title">Appearance</div>
      <div class="list">
        <div class="list-row"><div class="lr-icon" style="background:#5e5ce6">${Icons.moon}</div>
          <div class="lr-main"><div class="lr-title">Theme</div></div>
          <div class="segmented" id="theme-seg" style="width:150px">
            <button data-v="light">Light</button><button data-v="dark">Dark</button>
          </div></div>
        <div class="list-row"><div class="lr-icon" style="background:var(--accent)">${Icons.palette}</div>
          <div class="lr-main"><div class="lr-title">Accent Color</div>
            <div class="swatch-row" id="swatches">${accents.map((c) => `<button class="swatch" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
          </div></div>
        <div class="list-row" id="lang-row"><div class="lr-icon" style="background:#34c759">${Icons.globe}</div>
          <div class="lr-main"><div class="lr-title">Language</div></div>
          <div class="lr-trail">${I18n.meta().flag} ${I18n.meta().native} ›</div></div>
      </div>

      ${Cloud.enabled ? `<div class="list-section-title">Account</div>
      <div class="list">
        <div class="list-row"><div class="lr-icon" style="background:#30d158">${Icons.check}</div>
          <div class="lr-main"><div class="lr-title">${Cloud.user() ? 'Signed in' : 'Not signed in'}</div><div class="lr-sub">${Cloud.user() ? '@' + Cloud.user().username + ' · synced' : 'Local only'}</div></div></div>
        ${Cloud.user() ? `<div class="list-row" id="signout-row"><div class="lr-icon" style="background:#ff453a">${Icons.signout}</div><div class="lr-main"><div class="lr-title">Sign Out</div></div><div class="lr-trail">›</div></div>` : ''}
      </div>` : ''}

      <div class="list-section-title">Profile</div>
      <div class="list">
        <div class="list-row" id="edit-name"><div class="lr-icon" style="background:#0a84ff">${Icons.user}</div>
          <div class="lr-main"><div class="lr-title">Name</div></div><div class="lr-trail">${p.name} ›</div></div>
        <div class="list-row" id="edit-user"><div class="lr-icon" style="background:#5856d6">${Icons.at}</div>
          <div class="lr-main"><div class="lr-title">Username</div></div><div class="lr-trail">@${p.username} ›</div></div>
        <div class="list-row"><div class="lr-icon" style="background:#ff9f0a">${Icons.ruler}</div>
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
        <div class="list-row" id="dial-edit"><div class="lr-icon" style="background:#30d158">${Icons.phone}</div>
          <div class="lr-main"><div class="lr-title">Quick Dial Contacts</div></div><div class="lr-trail">Edit ›</div></div>
      </div>

      <div class="list-section-title">Parental Controls</div>
      <div class="list">
        <div class="list-row"><div class="lr-icon" style="background:#ff375f">${Icons.shield}</div>
          <div class="lr-main"><div class="lr-title">Enable Controls</div><div class="lr-sub">PIN-protected limits</div></div>
          <label class="switch"><input type="checkbox" id="par-en" ${par.enabled?'checked':''}><span class="track"></span><span class="thumb"></span></label></div>
        <div class="list-row"><div class="lr-icon" style="background:#ff9f0a">${Icons.bolt}</div>
          <div class="lr-main"><div class="lr-title">Speed Alert</div><div class="lr-sub">Warn above limit</div></div>
          <div class="lr-trail"><input class="field" id="par-speed" type="number" style="width:64px;margin:0;padding:7px;text-align:center" value="${par.maxSpeedAlert}"> km/h</div></div>
        <div class="list-row"><div class="lr-icon" style="background:#5e5ce6">${Icons.moon}</div>
          <div class="lr-main"><div class="lr-title">BikeTime</div><div class="lr-sub" id="bt-sub-row">Off</div></div>
          <div class="lr-trail" id="par-biketime">Edit ›</div></div>
        <div class="list-row"><div class="lr-icon" style="background:#bf5af2">${Icons.music}</div>
          <div class="lr-main"><div class="lr-title">Restrict Music</div><div class="lr-sub">Block the Music app entirely</div></div>
          <label class="switch"><input type="checkbox" id="par-music" ${par.blockMusic?'checked':''}><span class="track"></span><span class="thumb"></span></label></div>
        <div class="list-row"><div class="lr-icon" style="background:#ff9f0a">${Icons.headphones}</div>
          <div class="lr-main"><div class="lr-title">Music Services</div><div class="lr-sub" id="ms-sub">Choose allowed services</div></div>
          <div class="lr-trail" id="par-services">Edit ›</div></div>
        <div class="list-row"><div class="lr-icon" style="background:#5856d6">${Icons.friends}</div>
          <div class="lr-main"><div class="lr-title">Restrict Friends</div><div class="lr-sub">Block the Friends app entirely</div></div>
          <label class="switch"><input type="checkbox" id="par-friends" ${par.blockFriends?'checked':''}><span class="track"></span><span class="thumb"></span></label></div>
        <div class="list-row"><div class="lr-icon" style="background:#0a84ff">${Icons.chat}</div>
          <div class="lr-main"><div class="lr-title">Group Messaging</div><div class="lr-sub" id="gm-sub">Choose which groups can be messaged</div></div>
          <div class="lr-trail" id="par-groups">Edit ›</div></div>
        <div class="list-row" id="par-pin"><div class="lr-icon" style="background:#8e8e93">${Icons.key}</div>
          <div class="lr-main"><div class="lr-title">${par.pin?'Change':'Set'} Parental PIN</div><div class="lr-sub">Separate from your lock passcode</div></div><div class="lr-trail">›</div></div>
      </div>

      <div class="list-section-title">Security &amp; Anti-Theft</div>
      <div class="list">
        <div class="list-row" id="lock-pin"><div class="lr-icon" style="background:#1c1c1e;border:1px solid var(--hairline)">${Icons.lock}</div>
          <div class="lr-main"><div class="lr-title">${sec.lockPin?'Change':'Set'} Lock Passcode</div><div class="lr-sub">Required to unlock the screen & cancel the alarm</div></div><div class="lr-trail">›</div></div>
        <div class="list-row" id="lock-now-row"><div class="lr-icon" style="background:#48484a">${Icons.lock}</div>
          <div class="lr-main"><div class="lr-title">Lock Now</div><div class="lr-sub">Manual lock — no automatic locking</div></div><div class="lr-trail">›</div></div>
        <div class="list-row"><div class="lr-icon" style="background:#ff453a">${Icons.shield}</div>
          <div class="lr-main"><div class="lr-title">Anti-Theft Alarm</div><div class="lr-sub">Loud siren if the bike is moved while locked</div></div>
          <label class="switch"><input type="checkbox" id="sec-alarm" ${sec.alarmArmed?'checked':''}><span class="track"></span><span class="thumb"></span></label></div>
        <div class="list-row"><div class="lr-icon" style="background:#ff9f0a">${Icons.mappin}</div>
          <div class="lr-main"><div class="lr-title">Trigger Distance</div><div class="lr-sub">Ignore GPS drift / wind below this</div></div>
          <div class="lr-trail"><input class="field" id="sec-thresh" type="number" min="5" style="width:60px;margin:0;padding:7px;text-align:center" value="${sec.alarmThresholdM}"> m</div></div>
      </div>

      <div class="list-section-title">About</div>
      <div class="list">
        <div class="list-row"><div class="lr-main"><div class="lr-title">CycleScreen</div><div class="lr-sub">Raspberry Pi • 7″ display • GLONASS GPS</div></div><div class="lr-trail">v1.0</div></div>
        <div class="list-row" id="gps-row"><div class="lr-icon" style="background:#34c759">${Icons.mappin}</div>
          <div class="lr-main"><div class="lr-title">Location</div><div class="lr-sub" id="about-gps">—</div></div>
          <div class="lr-trail" id="gps-retry">Use my location ›</div></div>
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
    // profile photo (Cloudinary)
    const avBtn = host.querySelector('#pf-avatar'), photoIn = host.querySelector('#pf-photo');
    avBtn.onclick = () => photoIn.click();
    photoIn.onchange = async () => {
      const f = photoIn.files[0]; if (!f) return;
      if (!(window.CYCLESCREEN_CLOUDINARY || {}).cloudName) return App.toast('Set up Cloudinary to upload photos');
      App.toast('Uploading photo…');
      try {
        const url = await Cloud.uploadImage(f);
        Store.set('profile.photo', url);
        if (Cloud.enabled && Cloud.user()) await Cloud.setPhoto(url);
        Dashboard.refresh(); render(host);
      } catch (e) { App.toast('Photo upload failed'); }
    };

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
    const gpsLabel = () => {
      const s = Device.state;
      const man = Store.get('manualLocation');
      const el = host.querySelector('#about-gps'); if (!el) return;
      el.textContent = man ? `Set manually: ${man.label}`
        : !s.hasFix ? 'Locating…'
        : s.simulated ? 'Simulated (using GPS)'
        : `Live${s.accuracy ? ' · ±' + Math.round(s.accuracy) + 'm' : ''}`;
    };
    gpsLabel();
    Device.on('gps', gpsLabel); Device.on('gpsstatus', gpsLabel);
    host.querySelector('#gps-row').onclick = () => locationSheet(() => render(host));

    const signoutRow = host.querySelector('#signout-row');
    if (signoutRow) signoutRow.onclick = async () => { await Cloud.signOut(); Store.set('onboarded', false); location.reload(); };

    host.querySelector('#dial-edit').onclick = () => dialSheet(() => render(host));


    host.querySelector('#lang-row').onclick = () => {
      App.sheet('Language', `<div class="onb-langs" style="max-height:50vh">
        ${I18n.LANGS.map((l) => `<button class="onb-lang ${l.code === I18n.current() ? 'sel' : ''}" data-c="${l.code}">
          <span class="flag">${l.flag}</span><span class="lg"><b>${l.native}</b><small>${l.label}</small></span><span class="tick">✓</span></button>`).join('')}
      </div>`, (root, close) => {
        root.querySelectorAll('.onb-lang').forEach((b) => b.onclick = () => {
          I18n.set(b.dataset.c); close(); Dashboard.refresh(); App.refreshDrawer(); render(host);
        });
      });
    };

    // parental — ANY change requires the parental PIN (unlock once per visit)
    const gateToggle = (input, apply) => input.onchange = (e) => {
      if (!parentalLocked()) return apply(e.target.checked);
      const want = e.target.checked; e.target.checked = !want;       // revert until verified
      requireParental(() => { e.target.checked = want; apply(want); });
    };
    const gateRow = (el, open) => el.onclick = () => requireParental(open);

    host.querySelector('#par-en').onchange = (e) => {
      // turning OFF (while protected) needs the PIN; turning ON is always allowed
      if (!e.target.checked && par.pin && !parentalUnlocked) {
        e.target.checked = true;
        Security.verify(par.pin, 'Parental Controls', () => { parentalUnlocked = true; Store.set('parental.enabled', false); render(host); });
        return;
      }
      Store.set('parental.enabled', e.target.checked);
    };
    gateToggle(host.querySelector('#par-music'), (v) => { Store.set('parental.blockMusic', v); App.refreshDrawer(); });
    gateToggle(host.querySelector('#par-friends'), (v) => { Store.set('parental.blockFriends', v); App.refreshDrawer(); });
    host.querySelector('#par-speed').onchange = (e) => {
      const v = +e.target.value || 30;
      if (!parentalLocked()) return Store.set('parental.maxSpeedAlert', v);
      e.target.value = par.maxSpeedAlert; requireParental(() => { Store.set('parental.maxSpeedAlert', v); render(host); });
    };
    gateRow(host.querySelector('#par-pin'), () => setPinSheet('parental.pin', 'Parental PIN', () => render(host)));

    // BikeTime (downtime window)
    const bt = par.bikeTime || { enabled: false, start: '21:00', end: '07:00' };
    host.querySelector('#bt-sub-row').textContent = bt.enabled ? `${bt.start}–${bt.end}` : 'Off';
    gateRow(host.querySelector('#par-biketime'), () => {
      App.sheet('BikeTime', `
        <div class="list-row" style="padding-left:0"><div class="lr-main"><div class="lr-title">Enable BikeTime</div><div class="lr-sub">Block use during the window below</div></div>
          <label class="switch"><input type="checkbox" id="bt-en" ${bt.enabled?'checked':''}><span class="track"></span><span class="thumb"></span></label></div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <label style="flex:1;font-size:12px;color:var(--text-2)">From<input class="field" id="bt-start" type="time" value="${bt.start}" style="margin-top:4px"></label>
          <label style="flex:1;font-size:12px;color:var(--text-2)">Until<input class="field" id="bt-end" type="time" value="${bt.end}" style="margin-top:4px"></label>
        </div>
        <p style="font-size:12px;color:var(--text-2);margin:10px 4px">During this window the screen shows "Come back soon". ${par.pin ? 'You can bypass with the parental PIN.' : 'Set a parental PIN to allow bypass.'}</p>
        <button class="btn btn--block" id="bt-save">Save</button>`, (root, close) => {
        root.querySelector('#bt-save').onclick = () => {
          Store.set('parental.bikeTime', { enabled: root.querySelector('#bt-en').checked, start: root.querySelector('#bt-start').value || '21:00', end: root.querySelector('#bt-end').value || '07:00' });
          close(); render(host);
        };
      });
    });

    // Music services allow-list
    const svcName = (k) => k === 'apple' ? 'Apple' : 'Spotify';
    const ms = par.musicServices || { spotify: true };
    host.querySelector('#ms-sub').textContent = Object.keys(ms).filter((k) => ms[k] !== false).map(svcName).join(', ') || 'None';
    gateRow(host.querySelector('#par-services'), () => {
      const svcs = [['spotify', 'Spotify']];
      App.sheet('Music Services', svcs.map(([id, name]) => `
        <div class="list-row" style="padding-left:0"><div class="lr-main"><div class="lr-title">${name}</div></div>
          <label class="switch"><input type="checkbox" data-svc="${id}" ${ms[id] !== false ? 'checked' : ''}><span class="track"></span><span class="thumb"></span></label></div>`).join(''),
      (root, close) => {
        root.querySelectorAll('input[data-svc]').forEach((inp) => inp.onchange = () => {
          const cur = Store.get('parental.musicServices') || {};
          Store.set('parental.musicServices', { ...cur, [inp.dataset.svc]: inp.checked });
          host.querySelector('#ms-sub').textContent = Object.keys(Store.get('parental.musicServices')).filter((k) => Store.get('parental.musicServices')[k] !== false).map(svcName).join(', ') || 'None';
        });
      });
    });

    // Group messaging allow-list
    gateRow(host.querySelector('#par-groups'), () => {
      const known = (Friends.knownGroups && Friends.knownGroups()) || [];
      const blocked = new Set(Store.get('parental.msgBlockedGroups') || []);
      App.sheet('Group Messaging', known.length ? known.map((g) => `
        <div class="list-row" style="padding-left:0"><div class="lr-main"><div class="lr-title">${g.name}</div><div class="lr-sub">Allow sending messages</div></div>
          <label class="switch"><input type="checkbox" data-g="${g.id}" ${!blocked.has(g.id) ? 'checked' : ''}><span class="track"></span><span class="thumb"></span></label></div>`).join('')
        : '<p class="empty">No groups yet.</p>',
      (root) => {
        root.querySelectorAll('input[data-g]').forEach((inp) => inp.onchange = () => {
          const set = new Set(Store.get('parental.msgBlockedGroups') || []);
          inp.checked ? set.delete(inp.dataset.g) : set.add(inp.dataset.g);
          Store.set('parental.msgBlockedGroups', [...set]);
        });
      });
    });

    // security & anti-theft
    host.querySelector('#lock-pin').onclick = () => setPinSheet('security.lockPin', 'Lock Passcode', () => render(host));
    host.querySelector('#lock-now-row').onclick = () => Security.lockNow();
    host.querySelector('#sec-alarm').onchange = (e) => {
      const ok = e.target.checked ? Security.arm() : (Security.disarm(), true);
      if (e.target.checked && !ok) e.target.checked = false; // arming failed (no lock pin)
    };
    host.querySelector('#sec-thresh').onchange = (e) => Store.set('security.alarmThresholdM', Math.max(5, +e.target.value || 20));
  }

  // Set location manually (fixes wrong IP/VPN geolocation) or fall back to GPS.
  function locationSheet(after) {
    const man = Store.get('manualLocation');
    App.sheet('Location', `
      <p style="font-size:12px;color:var(--text-2);margin:0 4px 10px">${man ? 'Pinned to <b>' + esc(man.label) + '</b>.' : 'On a VPN or without a GPS dongle, your location can be wrong. Search your city/place to set it.'}</p>
      <input class="field" id="loc-q" placeholder="Search city or place…" autocapitalize="words" />
      <div class="user-results" id="loc-results"></div>
      <button class="btn btn--block btn--ghost" id="loc-gps">Use GPS / auto-locate</button>`, (root, close) => {
      const q = root.querySelector('#loc-q'), results = root.querySelector('#loc-results');
      let t;
      q.oninput = () => {
        clearTimeout(t);
        const term = q.value.trim();
        if (term.length < 3) { results.innerHTML = ''; return; }
        t = setTimeout(async () => {
          let list = [];
          try {
            const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(term)}`, { headers: { 'Accept-Language': I18n.current() } });
            list = await r.json();
          } catch {}
          results.innerHTML = list.length ? list.map((p, i) => `
            <button class="user-result" data-i="${i}"><div class="lr-main"><div class="lr-title" style="font-size:14px">${esc(p.display_name.split(',')[0])}</div><div class="lr-sub">${esc(p.display_name)}</div></div></button>`).join('')
            : '<div class="empty" style="padding:10px;font-size:12px">No matches</div>';
          results.querySelectorAll('.user-result').forEach((b) => b.onclick = () => {
            const p = list[+b.dataset.i];
            Device.setManualLocation(+p.lat, +p.lon, p.display_name.split(',')[0]);
            MapView.recenter(); close(); App.toast('📍 Location set'); after && after();
          });
        }, 300);
      };
      root.querySelector('#loc-gps').onclick = () => { Device.clearManualLocation(); close(); App.toast('📍 Using GPS'); after && after(); };
    });
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

  // Edit one quick-dial slot (used by the dashboard hold-to-edit gesture).
  function editDial(i, after) {
    const d = Store.get('quickDial')[i] || {};
    App.sheet(`Quick Dial — Slot ${i + 1}`, `
      <input class="field" id="qd-name" placeholder="Name" value="${d.name || ''}">
      <input class="field" id="qd-phone" type="tel" placeholder="Phone number" value="${d.phone || ''}">
      <div style="display:flex;gap:8px">
        <button class="btn btn--block" id="qd-save">Save</button>
        ${d.name ? '<button class="btn btn--block btn--danger" id="qd-del" style="flex:0 0 90px">Remove</button>' : ''}
      </div>`, (root, close) => {
      root.querySelector('#qd-save').onclick = () => {
        const name = root.querySelector('#qd-name').value.trim();
        if (!name) return App.toast('Enter a name');
        Store.update((s) => s.quickDial[i] = { name, phone: root.querySelector('#qd-phone').value.trim(), initials: name.slice(0, 1).toUpperCase(), color: ['#ff375f','#0a84ff','#30d158','#bf5af2'][i % 4] });
        close(); Dashboard.refresh(); after && after();
      };
      const del = root.querySelector('#qd-del');
      if (del) del.onclick = () => { Store.update((s) => s.quickDial[i] = null); close(); Dashboard.refresh(); after && after(); };
    });
  }

  function setPinSheet(path = 'parental.pin', title = 'PIN', after) {
    const existing = Store.get(path);
    App.sheet(`Set ${title}`, `
      <input class="field" id="pin1" inputmode="numeric" maxlength="4" placeholder="New 4-digit ${title}">
      <input class="field" id="pin2" inputmode="numeric" maxlength="4" placeholder="Confirm ${title}">
      <div style="display:flex;gap:8px">
        <button class="btn btn--block" id="pingo">Save</button>
        ${existing ? '<button class="btn btn--block btn--ghost" id="pinclr" style="flex:0 0 90px">Remove</button>' : ''}
      </div>`, (root, close) => {
      root.querySelector('#pingo').onclick = () => {
        const a = root.querySelector('#pin1').value, b = root.querySelector('#pin2').value;
        if (!/^\d{4}$/.test(a) || a !== b) return App.toast('PINs must match (4 digits)');
        Store.set(path, a); close(); App.toast(`${title} saved`); after && after();
      };
      const clr = root.querySelector('#pinclr');
      if (clr) clr.onclick = () => { Store.set(path, ''); close(); App.toast(`${title} removed`); after && after(); };
    });
  }

  return { render, editDial, lockParental };
})();
