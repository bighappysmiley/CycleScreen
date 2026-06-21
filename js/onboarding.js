/* onboarding.js — first-run experience: Apple-style language picker + login. */
const Onboarding = (() => {
  let root, onDone, picked = Store.get('language') || 'en';

  function start(done) {
    onDone = done;
    root = document.createElement('div');
    root.className = 'onb';
    document.body.appendChild(root);
    // Ask the language once, ever. If it's already chosen, go straight to sign-in.
    if (Store.get('language')) { I18n.set(picked); Cloud.enabled ? authScreen('signin') : loginScreen(); }
    else languageScreen();
  }

  function finish() {
    root.classList.add('onb--out');
    setTimeout(() => { root.remove(); onDone && onDone(); }, 420);
  }

  function step(html) {
    root.innerHTML = `<div class="onb-card">${html}</div>`;
  }

  /* ---- 1. Language ---- */
  function languageScreen() {
    I18n.set(picked);
    step(`
      <div class="onb-logo">🚴</div>
      <div class="onb-welcome">${I18n.t('welcome')}</div>
      <h1 class="onb-title">CycleScreen</h1>
      <p class="onb-sub">${I18n.t('choose_language')}</p>
      <div class="onb-langs">
        ${I18n.LANGS.map((l) => `
          <button class="onb-lang ${l.code === picked ? 'sel' : ''}" data-c="${l.code}">
            <span class="flag">${l.flag}</span>
            <span class="lg"><b>${l.native}</b><small>${l.label}</small></span>
            <span class="tick">✓</span>
          </button>`).join('')}
      </div>
      <button class="btn btn--block btn--pill onb-cta" id="onb-next">${I18n.t('continue')}</button>`);

    root.querySelectorAll('.onb-lang').forEach((b) => b.onclick = () => {
      picked = b.dataset.c; I18n.set(picked);
      root.querySelectorAll('.onb-lang').forEach((x) => x.classList.toggle('sel', x === b));
      root.querySelector('#onb-next').textContent = I18n.t('continue');
      root.querySelector('.onb-welcome').textContent = I18n.t('welcome');
      root.querySelector('.onb-sub').textContent = I18n.t('choose_language');
    });
    root.querySelector('#onb-next').onclick = () => (Cloud.enabled ? authScreen('signin') : loginScreen());
  }

  /* ---- 2a. Real account (Firebase username + password) ---- */
  function authScreen(mode) {
    const signup = mode === 'signup';
    let photoFile = null;
    step(`
      <div class="onb-brand"><div class="onb-mark">🚴</div><span>CycleScreen</span></div>
      <h1 class="onb-title">${signup ? 'Create account' : 'Welcome back'}</h1>
      <p class="onb-sub">${signup ? 'Your username is unique to you' : 'Sign in to sync your groups'}</p>
      <div class="onb-form">
        ${signup ? `
          <button class="onb-avatar" id="au-avatar" type="button"><span id="au-avatar-in">＋</span></button>
          <input type="file" id="au-photo" accept="image/*" hidden />
          <input class="field" id="au-name" placeholder="${I18n.t('your_name')}" autocomplete="off" />` : ''}
        <div class="onb-user-wrap"><span class="at">@</span><input class="field" id="au-user" placeholder="${I18n.t('username')}" autocomplete="off" autocapitalize="none" style="padding-left:30px"></div>
        <input class="field" id="au-pass" type="password" placeholder="Password" autocomplete="${signup ? 'new-password' : 'current-password'}" />
      </div>
      <div class="onb-err" id="au-err" hidden></div>
      <button class="btn btn--block btn--pill onb-cta" id="au-go">${signup ? 'Create account' : 'Sign in'}</button>
      <button class="onb-back" id="au-toggle">${signup ? 'Have an account? Sign in' : 'New here? Create an account'}</button>`);

    const err = (m) => { const e = root.querySelector('#au-err'); e.hidden = !m; e.textContent = m || ''; };

    if (signup) {
      const av = root.querySelector('#au-avatar'), file = root.querySelector('#au-photo');
      av.onclick = () => file.click();
      file.onchange = () => {
        const f = file.files[0]; file.value = ''; if (!f) return;
        Cropper.open(f, (blob) => {
          photoFile = blob;
          av.classList.add('has'); root.querySelector('#au-avatar-in').innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
        });
      };
    }

    root.querySelector('#au-toggle').onclick = () => authScreen(signup ? 'signin' : 'signup');
    root.querySelector('#au-go').onclick = async () => {
      const username = (root.querySelector('#au-user').value || '').trim().replace(/^@/, '').toLowerCase();
      const password = root.querySelector('#au-pass').value;
      const name = signup ? (root.querySelector('#au-name').value.trim() || username) : username;
      const btn = root.querySelector('#au-go'); btn.disabled = true; btn.textContent = 'Please wait…'; err('');
      try {
        if (signup) {
          await Cloud.signUp({ username, name, password });
          if (photoFile) { try { const url = await Cloud.uploadImage(photoFile); await Cloud.setPhoto(url); Store.set('profile.photo', url); } catch {} }
        } else await Cloud.signIn({ username, password });
        const u = Cloud.user();
        Store.update((d) => { d.profile.name = (u && u.name) || name; d.profile.username = (u && u.username) || username; d.profile.initials = ((u && u.name) || name).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(); if (u && u.photo) d.profile.photo = u.photo; d.onboarded = true; });
        finish();
      } catch (e) { btn.disabled = false; btn.textContent = signup ? 'Create account' : 'Sign in'; err(e.message || 'Failed'); }
    };
  }

  /* ---- 2b. Local profile (no Firebase configured) ---- */
  function loginScreen() {
    step(`
      <div class="onb-logo sm">👤</div>
      <h1 class="onb-title">${I18n.t('sign_in')}</h1>
      <p class="onb-sub">${I18n.t('create_profile')}</p>
      <div class="onb-form">
        <input class="field" id="onb-name" placeholder="${I18n.t('your_name')}" autocomplete="off" />
        <div class="onb-user-wrap">
          <span class="at">@</span>
          <input class="field" id="onb-user" placeholder="${I18n.t('username')}" autocomplete="off" />
        </div>
        <input class="field" id="onb-pass" type="password" inputmode="numeric" maxlength="4" placeholder="${I18n.t('passcode')}" />
      </div>
      <p class="onb-hint">${I18n.t('login_hint')}</p>
      <button class="btn btn--block btn--pill onb-cta" id="onb-go">${I18n.t('get_started')}</button>
      <button class="onb-back" id="onb-back">‹ ${I18n.t('choose_language')}</button>`);

    const nameEl = root.querySelector('#onb-name');
    const userEl = root.querySelector('#onb-user');
    nameEl.oninput = () => { if (!userEl.dataset.touched) userEl.value = nameEl.value.trim().toLowerCase().replace(/\s+/g, '').slice(0, 12); };
    userEl.oninput = () => { userEl.dataset.touched = '1'; };

    root.querySelector('#onb-back').onclick = languageScreen;
    root.querySelector('#onb-go').onclick = () => {
      const name = nameEl.value.trim() || 'Rider';
      const username = (userEl.value.trim() || 'rider').replace(/^@/, '');
      const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const pass = root.querySelector('#onb-pass').value.trim();
      Store.update((d) => {
        d.profile.name = name; d.profile.username = username; d.profile.initials = initials;
        if (/^\d{4}$/.test(pass)) d.security.lockPin = pass; // device lock passcode
        d.onboarded = true;
      });
      finish();
    };
  }

  return { start };
})();
