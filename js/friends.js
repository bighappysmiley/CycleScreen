/* friends.js — friends group, voice notes, emoji reactions, GPS challenges. */
const Friends = (() => {
  let tab = 'friends';

  function render(host) {
    if (Store.get('parental.blockFriends')) {
      host.innerHTML = `<div class="empty">🔒 The Friends app is restricted by Parental Controls.</div>`;
      return;
    }
    host.innerHTML = `
      <div class="friends-tabs">
        <div class="segmented" id="ftabs">
          <button data-t="friends" class="${tab==='friends'?'on':''}">Friends</button>
          <button data-t="chat" class="${tab==='chat'?'on':''}">Group</button>
          <button data-t="challenges" class="${tab==='challenges'?'on':''}">Challenges</button>
        </div>
      </div>
      <div class="app-pad" id="fbody"></div>`;
    host.querySelectorAll('#ftabs button').forEach((b) => b.onclick = () => { tab = b.dataset.t; render(host); });
    const body = host.querySelector('#fbody');
    if (tab === 'friends') renderFriends(body);
    else if (tab === 'chat') renderChat(body);
    else renderChallenges(body);
  }

  function renderFriends(body) {
    const fr = Store.get('friends');
    body.innerHTML = `
      <div class="list">
        ${fr.map((f) => `
          <div class="list-row friend-row" data-id="${f.id}">
            <div class="friend-av-wrap">
              <div class="avatar" style="background:${f.color}">${f.initials}</div>
              <span class="presence ${f.presence}"></span>
            </div>
            <div class="lr-main"><div class="lr-title">${f.name}</div>
              <div class="lr-sub">@${f.username} • ${f.presence === 'riding' ? '🚴 Riding now' : f.presence}</div></div>
            <div class="lr-trail">›</div>
          </div>`).join('')}
      </div>
      <button class="btn btn--block btn--pill" id="addfriend" style="margin-top:14px">＋ Add Friend to Group</button>`;
    body.querySelector('#addfriend').onclick = () => addFriendSheet(body);
  }

  function renderChat(body) {
    const emojis = ['👍','🔥','🚴','💪','😂','❤️','🎉','⛰️'];
    body.innerHTML = `
      <div class="list-section-title">Quick Reactions</div>
      <div class="chip-row">${emojis.map((e) => `<button class="emoji-chip">${e}</button>`).join('')}</div>
      <div class="list-section-title">Voice Message</div>
      <div class="card">
        <div class="voice-row">
          <button class="voice-btn" id="vbtn" aria-label="Record">
            <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <div class="wave" id="wave">${'<i></i>'.repeat(24)}</div>
          <span id="vtime" style="font-variant-numeric:tabular-nums;color:var(--text-2);font-weight:600">0:00</span>
        </div>
      </div>
      <div class="empty" id="chatlog" style="padding:24px 10px">Tap an emoji or hold the mic to send to the group 🚴‍♂️🚴‍♀️</div>`;

    body.querySelectorAll('.emoji-chip').forEach((c) => c.onclick = () => App.toast(`Sent ${c.textContent} to the group`));

    const btn = body.querySelector('#vbtn'), wave = body.querySelector('#wave'), time = body.querySelector('#vtime');
    let rec = false, sec = 0, tk = null;
    const stop = (send) => {
      rec = false; btn.classList.remove('rec'); wave.classList.remove('live');
      clearInterval(tk); if (send && sec > 0) App.toast(`Voice message sent (0:${String(sec).padStart(2,'0')})`); sec = 0; time.textContent = '0:00';
    };
    btn.onclick = () => {
      if (rec) return stop(true);
      rec = true; btn.classList.add('rec'); wave.classList.add('live');
      tk = setInterval(() => { sec++; time.textContent = `0:${String(sec).padStart(2,'0')}`; if (sec >= 30) stop(true); }, 1000);
    };
  }

  function renderChallenges(body) {
    const ch = Store.get('challenges');
    const live = Device.state;
    body.innerHTML = `
      ${ch.map((c) => `
        <div class="challenge-card ${c.type}">
          <h4>${c.title}</h4>
          <div class="meta">${c.meta}</div>
          <div class="row">
            <span style="font-size:12px;opacity:.9">${c.type === 'race' ? '🏁 Live race' : c.type === 'climb' ? '⛰️ Climb' : '📏 Distance goal'}</span>
            <button class="join" data-id="${c.id}">${c.joined ? '✓ Joined' : 'Join'}</button>
          </div>
        </div>`).join('')}
      <div class="list-section-title">Sunset Sprint — Live Leaderboard</div>
      <div class="card app-pad">
        <div class="lead-row"><span class="lead-rank">1</span><div class="avatar" style="width:34px;height:34px;font-size:13px;background:#ff375f">ML</div><div class="lr-main"><div class="lr-title">Maya Levi</div></div><b>${(live.speedKmh+4).toFixed(1)} km/h</b></div>
        <div class="lead-row"><span class="lead-rank">2</span><div class="avatar" style="width:34px;height:34px;font-size:13px">OF</div><div class="lr-main"><div class="lr-title">You</div></div><b>${live.speedKmh.toFixed(1)} km/h</b></div>
        <div class="lead-row"><span class="lead-rank">3</span><div class="avatar" style="width:34px;height:34px;font-size:13px;background:#30d158">EC</div><div class="lr-main"><div class="lr-title">Eitan Cohen</div></div><b>${Math.max(0,live.speedKmh-3).toFixed(1)} km/h</b></div>
      </div>
      <button class="btn btn--block btn--pill" id="newchal" style="margin-top:14px">🏁 Create Challenge (uses GPS)</button>`;
    body.querySelectorAll('.join').forEach((b) => b.onclick = () => {
      Store.update((d) => { const c = d.challenges.find((x) => x.id === b.dataset.id); c.joined = !c.joined; });
      renderChallenges(body);
    });
    body.querySelector('#newchal').onclick = () => newChallengeSheet(body);
  }

  /* ---- sheets ---- */
  function addFriendSheet(body) {
    App.sheet('Add Friend', `
      <input class="field" id="nf-user" placeholder="Friend's username, e.g. @rider" />
      <button class="btn btn--block" id="nf-go">Send Request</button>`, (root, close) => {
      root.querySelector('#nf-go').onclick = () => {
        const u = (root.querySelector('#nf-user').value || '').replace('@','').trim();
        if (!u) return;
        const init = u.slice(0, 2).toUpperCase();
        Store.update((d) => d.friends.push({ id: 'f' + Date.now(), name: u, username: u, initials: init, presence: 'online', color: '#0a84ff' }));
        close(); App.toast(`Request sent to @${u}`); render(body.closest('.app-body') || body.parentElement);
      };
    });
  }

  function newChallengeSheet(body) {
    App.sheet('New Challenge', `
      <input class="field" id="nc-title" placeholder="Challenge name" />
      <div class="segmented" id="nc-type" style="margin-bottom:10px">
        <button data-t="race" class="on">🏁 Race</button>
        <button data-t="distance">📏 Distance</button>
        <button data-t="climb">⛰️ Climb</button>
      </div>
      <input class="field" id="nc-dist" type="number" placeholder="Target distance (km)" value="5" />
      <p style="font-size:12px;color:var(--text-2);margin:2px 4px 12px">Uses your on-device GLONASS GPS for live tracking & ranking.</p>
      <button class="btn btn--block" id="nc-go">Create & Invite Group</button>`, (root, close) => {
      let type = 'race';
      root.querySelectorAll('#nc-type button').forEach((b) => b.onclick = () => { type = b.dataset.t; root.querySelectorAll('#nc-type button').forEach((x) => x.classList.toggle('on', x === b)); });
      root.querySelector('#nc-go').onclick = () => {
        const title = root.querySelector('#nc-title').value.trim() || 'New Challenge';
        const dist = +root.querySelector('#nc-dist').value || 5;
        Store.update((d) => d.challenges.unshift({ id: 'c' + Date.now(), type, title, meta: `${dist} km • just you`, joined: true, distance: dist }));
        close(); App.toast('Challenge created'); tab = 'challenges'; render(body.closest('.app-body') || document.getElementById('app-body'));
      };
    });
  }

  return { render };
})();
