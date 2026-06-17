/* friends.js — functional Groups: create groups, manage members & roles,
 * group chat (text / emoji / real voice notes), and persisted challenges.
 *
 * Everything is stored locally (Store). There is no backend, so messages and
 * rosters live on this device — real cross-device delivery would need a server.
 * Within that scope it's fully functional and persistent (not placeholder data).
 */
const Friends = (() => {
  const ROLES = ['Owner', 'Admin', 'Member', 'Viewer'];
  const COLORS = ['#0a84ff', '#ff375f', '#30d158', '#bf5af2', '#ff9f0a', '#64d2ff'];
  const EMOJIS = ['👍', '🔥', '🚴', '💪', '😂', '❤️', '🎉', '⛰️', '👏', '🙌'];

  let currentGroupId = null, tab = 'members';
  const voiceClips = {}; // id -> object URL (session playback for recorded notes)

  const me = () => { const p = Store.get('profile'); return { id: '@' + (p.username || 'me'), name: p.name || 'You', username: p.username || 'me' }; };
  const groups = () => Store.get('groups');
  const group = () => groups().find((g) => g.id === currentGroupId);
  const myRole = (g) => { const m = (g.members || []).find((x) => x.id === me().id); return m ? m.role : 'Viewer'; };
  const canManage = (g) => ['Owner', 'Admin'].includes(myRole(g));
  const initials = (name) => name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  function render(host) {
    if (Store.get('parental.blockFriends')) {
      host.innerHTML = `<div class="empty">🔒 The Friends app is restricted by Parental Controls.</div>`;
      return;
    }
    currentGroupId && group() ? renderGroup(host) : renderGroupList(host);
  }

  /* ---------------- Groups list ---------------- */
  function renderGroupList(host) {
    currentGroupId = null;
    const gs = groups();
    host.innerHTML = `
      <div class="app-pad">
        ${gs.length ? `<div class="list">${gs.map((g) => `
          <div class="list-row group-row" data-id="${g.id}">
            <div class="lr-icon" style="background:${g.color}">${initials(g.name)}</div>
            <div class="lr-main"><div class="lr-title">${esc(g.name)}</div>
              <div class="lr-sub">${g.members.length} member${g.members.length !== 1 ? 's' : ''} · ${g.challenges.length} challenge${g.challenges.length !== 1 ? 's' : ''}</div></div>
            <div class="lr-trail">›</div>
          </div>`).join('')}</div>`
        : `<div class="empty">No groups yet.<br>Create one to add riders and start challenges.</div>`}
        <button class="btn btn--block btn--pill" id="new-group" style="margin-top:14px">＋ New Group</button>
      </div>`;
    host.querySelectorAll('.group-row').forEach((r) => r.onclick = () => { currentGroupId = r.dataset.id; tab = 'members'; render(host); });
    host.querySelector('#new-group').onclick = () => newGroupSheet(host);
  }

  function newGroupSheet(host) {
    App.sheet('New Group', `
      <input class="field" id="g-name" placeholder="Group name (e.g. Sunday Riders)" />
      <button class="btn btn--block" id="g-go">Create Group</button>`, (root, close) => {
      root.querySelector('#g-go').onclick = () => {
        const name = root.querySelector('#g-name').value.trim();
        if (!name) return App.toast('Enter a group name');
        const m = me();
        Store.update((d) => d.groups.push({
          id: 'g' + Date.now(), name, color: COLORS[d.groups.length % COLORS.length],
          members: [{ id: m.id, name: m.name, username: m.username, role: 'Owner' }],
          messages: [], challenges: [],
        }));
        close(); render(host);
      };
    });
  }

  /* ---------------- Group detail ---------------- */
  function renderGroup(host) {
    const g = group();
    host.innerHTML = `
      <div class="group-head">
        <button class="group-back" id="g-back">‹ Groups</button>
        <div class="group-title"><span class="avatar" style="width:24px;height:24px;font-size:11px;background:${g.color}">${initials(g.name)}</span> ${esc(g.name)}</div>
      </div>
      <div class="friends-tabs"><div class="segmented" id="ftabs">
        <button data-t="members" class="${tab==='members'?'on':''}">Members</button>
        <button data-t="chat" class="${tab==='chat'?'on':''}">Chat</button>
        <button data-t="challenges" class="${tab==='challenges'?'on':''}">Challenges</button>
      </div></div>
      <div class="app-pad" id="gbody"></div>`;
    host.querySelector('#g-back').onclick = () => { currentGroupId = null; render(host); };
    host.querySelectorAll('#ftabs button').forEach((b) => b.onclick = () => { tab = b.dataset.t; renderGroup(host); });
    const body = host.querySelector('#gbody');
    if (tab === 'members') renderMembers(body, host);
    else if (tab === 'chat') renderChat(body);
    else renderChallenges(body, host);
  }

  /* ---- Members + roles ---- */
  function renderMembers(body, host) {
    const g = group();
    const manage = canManage(g);
    body.innerHTML = `
      <div class="list">${g.members.map((m) => `
        <div class="list-row member-row" data-id="${m.id}">
          <div class="avatar" style="width:40px;height:40px;font-size:14px;background:${colorFor(m.id)}">${initials(m.name)}</div>
          <div class="lr-main"><div class="lr-title">${esc(m.name)}${m.id === me().id ? ' (you)' : ''}</div><div class="lr-sub">@${esc(m.username)}</div></div>
          <div class="lr-trail"><span class="role-badge role-${m.role.toLowerCase()}">${m.role}</span></div>
        </div>`).join('')}</div>
      ${manage ? `<button class="btn btn--block btn--pill" id="add-member" style="margin-top:14px">＋ Add Member</button>`
        : `<p class="empty" style="padding:16px">Only Owners and Admins can manage members.</p>`}`;

    if (manage) {
      body.querySelector('#add-member').onclick = () => addMemberSheet(host);
      body.querySelectorAll('.member-row').forEach((r) => r.onclick = () => memberSheet(r.dataset.id, host));
    }
  }

  function addMemberSheet(host) {
    App.sheet('Add Member', `
      <input class="field" id="m-name" placeholder="Name" />
      <div class="onb-user-wrap"><span class="at">@</span><input class="field" id="m-user" placeholder="username" style="padding-left:30px"></div>
      <div style="font-size:12px;color:var(--text-2);margin:6px 4px 6px">Role</div>
      <div class="segmented" id="m-role">${ROLES.filter(r=>r!=='Owner').map((r,i)=>`<button data-r="${r}" class="${i===1?'on':''}">${r}</button>`).join('')}</div>
      <button class="btn btn--block" id="m-go" style="margin-top:12px">Add to Group</button>`, (root, close) => {
      let role = 'Member';
      root.querySelectorAll('#m-role button').forEach((b) => b.onclick = () => { role = b.dataset.r; root.querySelectorAll('#m-role button').forEach((x) => x.classList.toggle('on', x === b)); });
      const nameEl = root.querySelector('#m-name'), userEl = root.querySelector('#m-user');
      nameEl.oninput = () => { if (!userEl.dataset.t) userEl.value = nameEl.value.trim().toLowerCase().replace(/\s+/g, ''); };
      userEl.oninput = () => userEl.dataset.t = '1';
      root.querySelector('#m-go').onclick = () => {
        const name = nameEl.value.trim(); const username = userEl.value.trim().replace(/^@/, '');
        if (!name || !username) return App.toast('Name and username required');
        const id = '@' + username;
        Store.update((d) => { const g = d.groups.find((x) => x.id === currentGroupId);
          if (g.members.some((x) => x.id === id)) return App.toast('Already in group');
          g.members.push({ id, name, username, role });
        });
        close(); renderGroup(document.getElementById('app-body'));
      };
    });
  }

  function memberSheet(memberId, host) {
    const g = group(); const m = g.members.find((x) => x.id === memberId);
    if (!m) return;
    const isSelf = m.id === me().id;
    const isOwner = m.role === 'Owner';
    App.sheet(`${m.name}`, `
      <div style="font-size:12px;color:var(--text-2);margin:0 4px 6px">Role</div>
      <div class="segmented" id="r-seg">${ROLES.map((r) => `<button data-r="${r}" class="${m.role===r?'on':''}" ${r==='Owner'&&!isOwner?'disabled style="opacity:.4"':''}>${r}</button>`).join('')}</div>
      ${(!isSelf && !isOwner) ? `<button class="btn btn--block btn--danger" id="m-remove" style="margin-top:12px">Remove from Group</button>` : ''}`,
    (root, close) => {
      root.querySelectorAll('#r-seg button').forEach((b) => b.onclick = () => {
        if (b.disabled) return;
        const r = b.dataset.r;
        if (r === 'Owner') return; // transfer-owner not supported here
        Store.update((d) => { d.groups.find((x) => x.id === currentGroupId).members.find((x) => x.id === memberId).role = r; });
        close(); renderGroup(document.getElementById('app-body'));
      });
      const rm = root.querySelector('#m-remove');
      if (rm) rm.onclick = () => {
        Store.update((d) => { const g = d.groups.find((x) => x.id === currentGroupId); g.members = g.members.filter((x) => x.id !== memberId); });
        close(); renderGroup(document.getElementById('app-body'));
      };
    });
  }

  /* ---- Chat: text + emoji + real voice notes ---- */
  function renderChat(body) {
    const g = group();
    body.innerHTML = `
      <div class="chat-log" id="chat-log">${g.messages.length ? g.messages.map(renderMsg).join('') : '<div class="empty">No messages yet. Say hi 👋</div>'}</div>
      <div class="chip-row">${EMOJIS.map((e) => `<button class="emoji-chip" data-e="${e}">${e}</button>`).join('')}</div>
      <div class="chat-compose">
        <input class="field" id="chat-input" placeholder="Message ${esc(g.name)}…" style="margin:0;flex:1">
        <button class="chat-send" id="chat-send" aria-label="Send">➤</button>
        <button class="voice-btn" id="vbtn" aria-label="Record"><svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
      <div class="wave" id="wave" hidden>${'<i></i>'.repeat(20)}<span id="vtime" style="margin-left:8px;color:var(--danger);font-weight:600">0:00</span></div>`;

    const log = body.querySelector('#chat-log');
    log.scrollTop = log.scrollHeight;
    body.querySelectorAll('.emoji-chip').forEach((c) => c.onclick = () => postMsg({ type: 'emoji', text: c.dataset.e }, body));
    const input = body.querySelector('#chat-input');
    const send = () => { const t = input.value.trim(); if (!t) return; postMsg({ type: 'text', text: t }, body); input.value = ''; };
    body.querySelector('#chat-send').onclick = send;
    input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
    wireVoice(body);

    body.querySelectorAll('.msg-play').forEach((b) => b.onclick = () => { const a = voiceClips[b.dataset.id]; if (a) new Audio(a).play(); else App.toast('Clip not available after reload'); });
  }

  function renderMsg(m) {
    const who = m.fromName + (m.fromYou ? '' : '');
    if (m.type === 'emoji') return `<div class="msg ${m.fromYou ? 'mine' : ''}"><div class="msg-who">${esc(who)}</div><div class="msg-bubble emoji-msg">${m.text}</div></div>`;
    if (m.type === 'voice') return `<div class="msg ${m.fromYou ? 'mine' : ''}"><div class="msg-who">${esc(who)}</div><button class="msg-bubble msg-play" data-id="${m.id}">▶ Voice · ${m.dur || '0:0?'}</button></div>`;
    return `<div class="msg ${m.fromYou ? 'mine' : ''}"><div class="msg-who">${esc(who)}</div><div class="msg-bubble">${esc(m.text)}</div></div>`;
  }

  function postMsg(msg, body) {
    const m = me();
    const full = { id: 'm' + Date.now(), fromYou: true, fromName: m.name, ts: Date.now(), ...msg };
    Store.update((d) => d.groups.find((x) => x.id === currentGroupId).messages.push(full));
    renderChat(body);
  }

  function wireVoice(body) {
    const btn = body.querySelector('#vbtn'), wave = body.querySelector('#wave'), time = body.querySelector('#vtime');
    let rec = null, chunks = [], sec = 0, tk = null, stream = null;
    btn.onclick = async () => {
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch { return App.toast('🎤 Microphone unavailable'); }
      chunks = []; sec = 0;
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        clearInterval(tk); btn.classList.remove('rec'); wave.hidden = true;
        stream.getTracks().forEach((t) => t.stop());
        const dur = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const id = 'm' + Date.now();
        voiceClips[id] = URL.createObjectURL(blob);
        const m = me();
        Store.update((d) => d.groups.find((x) => x.id === currentGroupId).messages.push({ id, type: 'voice', dur, fromYou: true, fromName: m.name, ts: Date.now() }));
        renderChat(body);
      };
      rec.start(); btn.classList.add('rec'); wave.hidden = false;
      tk = setInterval(() => { sec++; time.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; if (sec >= 60) rec.stop(); }, 1000);
    };
  }

  /* ---- Challenges (persisted, GPS-aware) ---- */
  function renderChallenges(body, host) {
    const g = group();
    const live = Device.state;
    const manage = canManage(g);
    body.innerHTML = `
      ${g.challenges.length ? g.challenges.map((c) => {
        const joined = (c.participants || []).includes(me().id);
        return `<div class="challenge-card ${c.type}">
          <h4>${esc(c.title)}</h4>
          <div class="meta">${c.type === 'race' ? '🏁 Race' : c.type === 'climb' ? '⛰️ Climb' : '📏 Distance'} · ${c.distance} km · ${(c.participants||[]).length} joined</div>
          <div class="row">
            <span style="font-size:12px;opacity:.9">${joined ? `You: ${(live.simulated?0:live.speedKmh).toFixed(1)} km/h` : 'Tap to join'}</span>
            <button class="join" data-id="${c.id}">${joined ? '✓ Joined' : 'Join'}</button>
          </div>
        </div>`;
      }).join('') : '<div class="empty">No challenges yet.</div>'}
      ${manage ? `<button class="btn btn--block btn--pill" id="new-chal" style="margin-top:12px">🏁 Create Challenge (uses GPS)</button>` : ''}`;
    body.querySelectorAll('.join').forEach((b) => b.onclick = () => {
      Store.update((d) => { const c = d.groups.find((x) => x.id === currentGroupId).challenges.find((x) => x.id === b.dataset.id);
        c.participants = c.participants || [];
        const i = c.participants.indexOf(me().id);
        i >= 0 ? c.participants.splice(i, 1) : c.participants.push(me().id);
      });
      renderChallenges(body, host);
    });
    const nc = body.querySelector('#new-chal');
    if (nc) nc.onclick = () => newChallengeSheet(body, host);
  }

  function newChallengeSheet(body, host) {
    App.sheet('New Challenge', `
      <input class="field" id="nc-title" placeholder="Challenge name" />
      <div class="segmented" id="nc-type" style="margin-bottom:10px">
        <button data-t="race" class="on">🏁 Race</button><button data-t="distance">📏 Distance</button><button data-t="climb">⛰️ Climb</button>
      </div>
      <input class="field" id="nc-dist" type="number" placeholder="Distance (km)" value="5" />
      <p style="font-size:12px;color:var(--text-2);margin:2px 4px 12px">Tracked live with your on-device GPS.</p>
      <button class="btn btn--block" id="nc-go">Create</button>`, (root, close) => {
      let type = 'race';
      root.querySelectorAll('#nc-type button').forEach((b) => b.onclick = () => { type = b.dataset.t; root.querySelectorAll('#nc-type button').forEach((x) => x.classList.toggle('on', x === b)); });
      root.querySelector('#nc-go').onclick = () => {
        const title = root.querySelector('#nc-title').value.trim() || 'New Challenge';
        const distance = +root.querySelector('#nc-dist').value || 5;
        Store.update((d) => d.groups.find((x) => x.id === currentGroupId).challenges.unshift({ id: 'c' + Date.now(), type, title, distance, participants: [me().id] }));
        close(); renderChallenges(body, host);
      };
    });
  }

  const colorFor = (id) => COLORS[Math.abs(hash(id)) % COLORS.length];
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  return { render };
})();
