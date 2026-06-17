/* friends.js — functional Groups, backed by Firebase when signed in (shared,
 * realtime, true unique usernames) or by local storage otherwise.
 *
 * Data access goes through the GD facade so the same UI works in both modes.
 */
const Friends = (() => {
  const ROLES = ['Owner', 'Admin', 'Member', 'Viewer'];
  const EMOJIS = ['👍', '🔥', '🚴', '💪', '😂', '❤️', '🎉', '⛰️', '👏', '🙌'];
  const COLORS = ['#0a84ff', '#ff375f', '#30d158', '#bf5af2', '#ff9f0a', '#64d2ff'];

  let host = null, currentGroupId = null, tab = 'members';
  let detach = [];               // active cloud listeners
  const cloudCache = { groups: [], members: {}, messages: {}, challenges: {} };
  const voiceClips = {};         // local session voice playback

  const cloud = () => Cloud.enabled && Cloud.user();

  /* ---------------- data facade ---------------- */
  const GD = {
    me() {
      if (cloud()) { const u = Cloud.user(); return { id: u.uid, name: u.name, username: u.username }; }
      const p = Store.get('profile'); return { id: '@' + (p.username || 'me'), name: p.name || 'You', username: p.username || 'me' };
    },
    groups() {
      return cloud() ? cloudCache.groups.map((g) => ({ ...g, members: cloudCache.members[g.id] || [], messages: cloudCache.messages[g.id] || [], challenges: cloudCache.challenges[g.id] || [], count: (g.memberUids || []).length }))
        : Store.get('groups').map((g) => ({ ...g, count: g.members.length }));
    },
    group(id) { return GD.groups().find((g) => g.id === id); },
    async createGroup(name) {
      if (cloud()) return Cloud.createGroup(name);
      const m = GD.me();
      Store.update((d) => d.groups.push({ id: 'g' + Date.now(), name, color: COLORS[d.groups.length % COLORS.length], members: [{ id: m.id, name: m.name, username: m.username, role: 'Owner' }], messages: [], challenges: [] }));
      refresh();
    },
    async addMember(gid, username, role) {
      if (cloud()) return Cloud.addMember(gid, username, role);
      const id = '@' + username;
      Store.update((d) => { const g = d.groups.find((x) => x.id === gid); if (!g.members.some((x) => x.id === id)) g.members.push({ id, name: username, username, role }); });
      refresh();
    },
    async setRole(gid, mid, role) {
      if (cloud()) return Cloud.setRole(gid, mid, role);
      Store.update((d) => d.groups.find((x) => x.id === gid).members.find((x) => x.id === mid).role = role); refresh();
    },
    async removeMember(gid, mid) {
      if (cloud()) return Cloud.removeMember(gid, mid);
      Store.update((d) => { const g = d.groups.find((x) => x.id === gid); g.members = g.members.filter((x) => x.id !== mid); }); refresh();
    },
    async postMessage(gid, msg, blob) {
      if (cloud()) {
        if (blob) {
          try { msg = { ...msg, audioUrl: await Cloud.uploadVoice(gid, blob) }; }
          catch (e) { App.toast('🎤 Voice upload failed — set up Cloudinary in config'); return; }
        }
        return Cloud.sendMessage(gid, msg);
      }
      const m = GD.me(); const full = { id: 'm' + Date.now(), fromYou: true, fromName: m.name, ts: Date.now(), ...msg };
      if (blob) voiceClips[full.id] = URL.createObjectURL(blob);
      Store.update((d) => d.groups.find((x) => x.id === gid).messages.push(full)); refresh();
    },
    async createChallenge(gid, c) {
      if (cloud()) return Cloud.createChallenge(gid, c);
      Store.update((d) => d.groups.find((x) => x.id === gid).challenges.unshift({ id: 'c' + Date.now(), participants: [GD.me().id], ...c })); refresh();
    },
    async toggleJoin(gid, cid) {
      if (cloud()) return Cloud.toggleJoin(gid, cid);
      Store.update((d) => { const c = d.groups.find((x) => x.id === gid).challenges.find((x) => x.id === cid); c.participants = c.participants || []; const i = c.participants.indexOf(GD.me().id); i >= 0 ? c.participants.splice(i, 1) : c.participants.push(GD.me().id); }); refresh();
    },
  };

  /* ---- cloud listeners ---- */
  let groupsUnsub = null;
  function startGroupsSync() {
    if (!cloud() || groupsUnsub) return;
    groupsUnsub = Cloud.watchGroups((gs) => { cloudCache.groups = gs; if (host && !currentGroupId) refresh(); });
  }
  function openGroupSync(gid) {
    closeGroupSync();
    const norm = (arr) => arr;
    detach.push(Cloud.watchSub(gid, 'members', (m) => { cloudCache.members[gid] = m.map((x) => ({ id: x.id, ...x })); if (tab === 'members') refresh(); }));
    detach.push(Cloud.watchSub(gid, 'messages', (m) => { cloudCache.messages[gid] = normMsgs(m); if (tab === 'chat') refresh(); }, 'ts'));
    detach.push(Cloud.watchSub(gid, 'challenges', (c) => { cloudCache.challenges[gid] = c; if (tab === 'challenges') refresh(); }));
  }
  function closeGroupSync() { detach.forEach((u) => u && u()); detach = []; }
  function normMsgs(m) { const meId = GD.me().id; return m.map((x) => ({ ...x, fromYou: x.fromUid === meId })); }

  /* ---------------- rendering ---------------- */
  function render(h) {
    host = h;
    if (Store.get('parental.blockFriends')) { host.innerHTML = `<div class="empty">🔒 The Friends app is restricted by Parental Controls.</div>`; return; }
    startGroupsSync();
    currentGroupId && GD.group(currentGroupId) ? renderGroup() : renderGroupList();
  }
  function refresh() { if (host && document.body.contains(host)) render(host); }

  function renderGroupList() {
    closeGroupSync(); currentGroupId = null;
    const gs = GD.groups();
    const banner = cloud() ? '' : `<div class="cloud-note">On-device only — sign in (Settings → Account) to sync groups & true usernames.</div>`;
    host.innerHTML = `<div class="app-pad">${banner}
      ${gs.length ? `<div class="list">${gs.map((g) => `
        <div class="list-row group-row" data-id="${g.id}">
          <div class="lr-icon" style="background:${g.color}">${ini(g.name)}</div>
          <div class="lr-main"><div class="lr-title">${esc(g.name)}</div><div class="lr-sub">${g.count} member${g.count !== 1 ? 's' : ''}</div></div>
          <div class="lr-trail">›</div></div>`).join('')}</div>`
        : `<div class="empty">No groups yet.<br>Create one to add riders and start challenges.</div>`}
      <button class="btn btn--block btn--pill" id="new-group" style="margin-top:14px">＋ New Group</button></div>`;
    host.querySelectorAll('.group-row').forEach((r) => r.onclick = () => { currentGroupId = r.dataset.id; tab = 'members'; if (cloud()) openGroupSync(currentGroupId); render(host); });
    host.querySelector('#new-group').onclick = () => sheetInput('New Group', 'Group name', async (name) => { await GD.createGroup(name); refresh(); });
  }

  function renderGroup() {
    const g = GD.group(currentGroupId);
    host.innerHTML = `
      <div class="group-head"><button class="group-back" id="g-back">‹ Groups</button>
        <div class="group-title"><span class="avatar" style="width:24px;height:24px;font-size:11px;background:${g.color}">${ini(g.name)}</span> ${esc(g.name)}</div></div>
      <div class="friends-tabs"><div class="segmented" id="ftabs">
        <button data-t="members" class="${tab==='members'?'on':''}">Members</button>
        <button data-t="chat" class="${tab==='chat'?'on':''}">Chat</button>
        <button data-t="challenges" class="${tab==='challenges'?'on':''}">Challenges</button></div></div>
      <div class="app-pad" id="gbody"></div>`;
    host.querySelector('#g-back').onclick = () => { closeGroupSync(); currentGroupId = null; render(host); };
    host.querySelectorAll('#ftabs button').forEach((b) => b.onclick = () => { tab = b.dataset.t; renderGroup(); });
    const body = host.querySelector('#gbody');
    if (tab === 'members') renderMembers(body, g);
    else if (tab === 'chat') renderChat(body, g);
    else renderChallenges(body, g);
  }

  const myRole = (g) => { const m = g.members.find((x) => x.id === GD.me().id); return m ? m.role : 'Viewer'; };
  const canManage = (g) => ['Owner', 'Admin'].includes(myRole(g));

  function renderMembers(body, g) {
    const manage = canManage(g);
    body.innerHTML = `<div class="list">${g.members.map((m) => `
        <div class="list-row member-row" data-id="${m.id}">
          <div class="avatar" style="width:40px;height:40px;font-size:14px;background:${colorFor(m.id)}">${m.photo ? `<img src="${esc(m.photo)}" alt="">` : ini(m.name)}</div>
          <div class="lr-main"><div class="lr-title">${esc(m.name)}${m.id === GD.me().id ? ' (you)' : ''}</div><div class="lr-sub">@${esc(m.username)}</div></div>
          <div class="lr-trail"><span class="role-badge role-${m.role.toLowerCase()}">${m.role}</span></div></div>`).join('')}</div>
      ${manage ? `<button class="btn btn--block btn--pill" id="add-member" style="margin-top:14px">＋ Add Member</button>`
        : `<p class="empty" style="padding:16px">Only Owners and Admins can manage members.</p>`}`;
    if (manage) {
      body.querySelector('#add-member').onclick = () => addMemberSheet(g);
      body.querySelectorAll('.member-row').forEach((r) => r.onclick = () => memberSheet(g, r.dataset.id));
    }
  }

  function addMemberSheet(g) {
    App.sheet('Add Member', `
      ${cloud() ? '<p style="font-size:12px;color:var(--text-2);margin:0 4px 10px">Search riders by username.</p>'
                : '<p style="font-size:12px;color:var(--text-2);margin:0 4px 10px">Local mode: adds a roster entry. Sign in to add real users by username.</p>'}
      <div class="onb-user-wrap"><span class="at">@</span><input class="field" id="m-user" placeholder="username" autocapitalize="none" style="padding-left:30px"></div>
      <div class="user-results" id="m-results"></div>
      <div style="font-size:12px;color:var(--text-2);margin:6px 4px 6px">Role</div>
      <div class="segmented" id="m-role">${['Admin','Member','Viewer'].map((r,i)=>`<button data-r="${r}" class="${i===1?'on':''}">${r}</button>`).join('')}</div>
      <button class="btn btn--block" id="m-go" style="margin-top:12px">Add to Group</button>`, (root, close) => {
      let role = 'Member';
      root.querySelectorAll('#m-role button').forEach((b) => b.onclick = () => { role = b.dataset.r; root.querySelectorAll('#m-role button').forEach((x) => x.classList.toggle('on', x === b)); });
      const input = root.querySelector('#m-user'), results = root.querySelector('#m-results');

      if (cloud()) {
        let t;
        const existing = new Set((g.members || []).map((m) => m.username));
        input.oninput = () => {
          clearTimeout(t);
          const q = input.value.trim().replace(/^@/, '').toLowerCase();
          t = setTimeout(async () => {
            if (q.length < 2) { results.innerHTML = ''; return; }
            let users = [];
            try { users = await Cloud.searchUsers(q); } catch {}
            users = users.filter((u) => !existing.has(u.username));
            results.innerHTML = users.length ? users.map((u) => `
              <button class="user-result" data-u="${esc(u.username)}">
                <div class="avatar" style="width:32px;height:32px;font-size:12px;background:${colorFor(u.uid)}">${u.photo ? `<img src="${esc(u.photo)}" alt="">` : ini(u.name || u.username)}</div>
                <div class="lr-main"><div class="lr-title" style="font-size:14px">${esc(u.name || u.username)}</div><div class="lr-sub">@${esc(u.username)}</div></div>
              </button>`).join('') : '<div class="empty" style="padding:10px;font-size:12px">No matching riders</div>';
            results.querySelectorAll('.user-result').forEach((b) => b.onclick = () => { input.value = b.dataset.u; results.innerHTML = ''; });
          }, 250);
        };
      }

      root.querySelector('#m-go').onclick = async () => {
        const username = input.value.trim().replace(/^@/, '').toLowerCase();
        if (!username) return App.toast('Enter a username');
        try { await GD.addMember(g.id, username, role); close(); refresh(); }
        catch (e) { App.toast(e.message || 'Could not add'); }
      };
    });
  }

  function memberSheet(g, mid) {
    const m = g.members.find((x) => x.id === mid); if (!m) return;
    const isSelf = m.id === GD.me().id, isOwner = m.role === 'Owner';
    App.sheet(m.name, `
      <div style="font-size:12px;color:var(--text-2);margin:0 4px 6px">Role</div>
      <div class="segmented" id="r-seg">${ROLES.map((r) => `<button data-r="${r}" class="${m.role===r?'on':''}" ${r==='Owner'?'disabled style="opacity:.4"':''}>${r}</button>`).join('')}</div>
      ${(!isSelf && !isOwner) ? `<button class="btn btn--block btn--danger" id="m-remove" style="margin-top:12px">Remove from Group</button>` : ''}`,
    (root, close) => {
      root.querySelectorAll('#r-seg button').forEach((b) => b.onclick = async () => {
        if (b.disabled || b.dataset.r === 'Owner') return;
        await GD.setRole(g.id, mid, b.dataset.r); close(); refresh();
      });
      const rm = root.querySelector('#m-remove');
      if (rm) rm.onclick = async () => { await GD.removeMember(g.id, mid); close(); refresh(); };
    });
  }

  /* ---- chat ---- */
  function renderChat(body, g) {
    body.innerHTML = `
      <div class="chat-log" id="chat-log">${g.messages.length ? g.messages.map(renderMsg).join('') : '<div class="empty">No messages yet. Say hi 👋</div>'}</div>
      <div class="chip-row">${EMOJIS.map((e) => `<button class="emoji-chip" data-e="${e}">${e}</button>`).join('')}</div>
      <div class="chat-compose">
        <input class="field" id="chat-input" placeholder="Message…" style="margin:0;flex:1">
        <button class="chat-send" id="chat-send">➤</button>
        <button class="voice-btn" id="vbtn"><svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
      <div class="wave" id="wave" hidden>${'<i></i>'.repeat(20)}<span id="vtime" style="margin-left:8px;color:var(--danger);font-weight:600">0:00</span></div>`;
    const log = body.querySelector('#chat-log'); log.scrollTop = log.scrollHeight;
    body.querySelectorAll('.emoji-chip').forEach((c) => c.onclick = () => GD.postMessage(g.id, { type: 'emoji', text: c.dataset.e }));
    const input = body.querySelector('#chat-input');
    const send = () => { const t = input.value.trim(); if (!t) return; input.value = ''; GD.postMessage(g.id, { type: 'text', text: t }); };
    body.querySelector('#chat-send').onclick = send;
    input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
    wireVoice(body, g);
    body.querySelectorAll('.msg-play').forEach((b) => b.onclick = () => {
      const src = b.dataset.url || voiceClips[b.dataset.id];
      if (src) new Audio(src).play(); else App.toast('Clip unavailable');
    });
  }
  function renderMsg(m) {
    const c = m.fromYou ? 'mine' : '';
    if (m.type === 'emoji') return `<div class="msg ${c}"><div class="msg-who">${esc(m.fromName)}</div><div class="msg-bubble emoji-msg">${m.text}</div></div>`;
    if (m.type === 'voice') return `<div class="msg ${c}"><div class="msg-who">${esc(m.fromName)}</div><button class="msg-bubble msg-play" data-id="${m.id}" ${m.audioUrl ? `data-url="${m.audioUrl}"` : ''}>▶ Voice · ${m.dur || ''}</button></div>`;
    return `<div class="msg ${c}"><div class="msg-who">${esc(m.fromName)}</div><div class="msg-bubble">${esc(m.text)}</div></div>`;
  }
  function wireVoice(body, g) {
    const btn = body.querySelector('#vbtn'), wave = body.querySelector('#wave'), time = body.querySelector('#vtime');
    let rec = null, chunks = [], sec = 0, tk = null, stream = null;
    btn.onclick = async () => {
      if (rec && rec.state === 'recording') return rec.stop();
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return App.toast('🎤 Microphone unavailable'); }
      chunks = []; sec = 0; rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        clearInterval(tk); btn.classList.remove('rec'); wave.hidden = true; stream.getTracks().forEach((t) => t.stop());
        const dur = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
        GD.postMessage(g.id, { type: 'voice', dur }, new Blob(chunks, { type: 'audio/webm' }));
      };
      rec.start(); btn.classList.add('rec'); wave.hidden = false;
      tk = setInterval(() => { sec++; time.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; if (sec >= 60) rec.stop(); }, 1000);
    };
  }

  /* ---- challenges ---- */
  function renderChallenges(body, g) {
    const live = Device.state, manage = canManage(g), meId = GD.me().id;
    body.innerHTML = `${g.challenges.length ? g.challenges.map((c) => {
      const joined = (c.participants || []).includes(meId);
      return `<div class="challenge-card ${c.type}"><h4>${esc(c.title)}</h4>
        <div class="meta">${c.type === 'race' ? '🏁 Race' : c.type === 'climb' ? '⛰️ Climb' : '📏 Distance'} · ${c.distance} km · ${(c.participants||[]).length} joined</div>
        <div class="row"><span style="font-size:12px;opacity:.9">${joined ? `You: ${(live.simulated?0:live.speedKmh).toFixed(1)} km/h` : 'Tap to join'}</span>
          <button class="join" data-id="${c.id}">${joined ? '✓ Joined' : 'Join'}</button></div></div>`;
    }).join('') : '<div class="empty">No challenges yet.</div>'}
      ${manage ? `<button class="btn btn--block btn--pill" id="new-chal" style="margin-top:12px">🏁 Create Challenge (uses GPS)</button>` : ''}`;
    body.querySelectorAll('.join').forEach((b) => b.onclick = () => GD.toggleJoin(g.id, b.dataset.id));
    const nc = body.querySelector('#new-chal'); if (nc) nc.onclick = () => newChallengeSheet(g);
  }
  function newChallengeSheet(g) {
    App.sheet('New Challenge', `
      <input class="field" id="nc-title" placeholder="Challenge name" />
      <div class="segmented" id="nc-type" style="margin-bottom:10px"><button data-t="race" class="on">🏁 Race</button><button data-t="distance">📏 Distance</button><button data-t="climb">⛰️ Climb</button></div>
      <input class="field" id="nc-dist" type="number" placeholder="Distance (km)" value="5" />
      <button class="btn btn--block" id="nc-go">Create</button>`, (root, close) => {
      let type = 'race';
      root.querySelectorAll('#nc-type button').forEach((b) => b.onclick = () => { type = b.dataset.t; root.querySelectorAll('#nc-type button').forEach((x) => x.classList.toggle('on', x === b)); });
      root.querySelector('#nc-go').onclick = async () => {
        await GD.createChallenge(g.id, { type, title: root.querySelector('#nc-title').value.trim() || 'New Challenge', distance: +root.querySelector('#nc-dist').value || 5 });
        close(); refresh();
      };
    });
  }

  /* ---- helpers ---- */
  function sheetInput(title, placeholder, onOk) {
    App.sheet(title, `<input class="field" id="si" placeholder="${placeholder}"><button class="btn btn--block" id="si-go">Create</button>`, (root, close) => {
      root.querySelector('#si-go').onclick = () => { const v = root.querySelector('#si').value.trim(); if (!v) return; close(); onOk(v); };
    });
  }
  const ini = (n) => String(n).trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const colorFor = (id) => COLORS[Math.abs(hash(String(id))) % COLORS.length];
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  return { render };
})();
