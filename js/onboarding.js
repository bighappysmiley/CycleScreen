/* onboarding.js — first-run experience: Apple-style language picker + login. */
const Onboarding = (() => {
  let root, onDone, picked = Store.get('language') || 'en';

  function start(done) {
    onDone = done;
    root = document.createElement('div');
    root.className = 'onb';
    document.body.appendChild(root);
    languageScreen();
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
    root.querySelector('#onb-next').onclick = loginScreen;
  }

  /* ---- 2. Login / profile ---- */
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
        <input class="field" id="onb-pass" type="password" inputmode="numeric" maxlength="6" placeholder="${I18n.t('passcode')}" />
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
      Store.update((d) => {
        d.profile.name = name; d.profile.username = username; d.profile.initials = initials;
        d.parental.pin = root.querySelector('#onb-pass').value.trim() || d.parental.pin;
        d.onboarded = true;
      });
      finish();
    };
  }

  return { start };
})();
