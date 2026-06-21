/* keyboard.js — full-screen on-screen keyboard for the touchscreen kiosk.
 *
 * The Pi has no physical keyboard, so any text/search/password field (username,
 * password, place search, PINs, names, etc.) pops a large touch keyboard docked
 * at the bottom, with a magnified echo of the field shown at the TOP of the
 * screen so it's never hidden behind the keys. Numeric fields get a number pad.
 * Attaches itself to every eligible input automatically — no per-field wiring.
 */
const OSK = (() => {
  let host, bar, barLabel, barVal, keysWrap;
  let target = null, mode = 'alpha', shift = false, showPass = false;

  const TEXT_TYPES = ['text', 'search', 'email', 'url', 'tel', 'password', 'number', ''];

  const ALPHA = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['shift','z','x','c','v','b','n','m','back'],
    ['123','space','return'],
  ];
  const SYM = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['-','/',':',';','(',')','$','&','@','"'],
    ['symb','.',',','?','!',"'",'back'],
    ['abc','space','return'],
  ];
  const SYMB = [
    ['[',']','{','}','#','%','^','*','+','='],
    ['_','\\','|','~','<','>','€','£','¥','•'],
    ['123','.',',','?','!',"'",'back'],
    ['abc','space','return'],
  ];
  const NUM = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','back']];

  function eligible(el) {
    if (!el || el.dataset && el.dataset.noOsk != null) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag !== 'INPUT') return false;
    return TEXT_TYPES.includes((el.type || '').toLowerCase());
  }
  const isNumeric = (el) => el.inputMode === 'numeric' || el.type === 'number' ||
    (el.type === 'tel' && el.getAttribute('inputmode') !== 'text');

  function build() {
    host = document.createElement('div');
    host.className = 'osk';
    host.innerHTML = `
      <div class="osk-bar" id="osk-bar">
        <span class="osk-bar-label" id="osk-bar-label"></span>
        <span class="osk-bar-val" id="osk-bar-val"></span>
        <button class="osk-bar-eye" id="osk-eye" hidden type="button">show</button>
      </div>
      <div class="osk-keys" id="osk-keys"></div>`;
    document.body.appendChild(host);
    bar = host.querySelector('#osk-bar');
    barLabel = host.querySelector('#osk-bar-label');
    barVal = host.querySelector('#osk-bar-val');
    keysWrap = host.querySelector('#osk-keys');
    host.querySelector('#osk-eye').addEventListener('pointerdown', (e) => {
      e.preventDefault(); showPass = !showPass; host.querySelector('#osk-eye').textContent = showPass ? 'hide' : 'show'; syncBar();
    });
    // tapping the keyboard chrome must never steal focus from the field
    keysWrap.addEventListener('pointerdown', onKeyDown);
  }

  function render() {
    const layout = mode === 'num' ? NUM : mode === 'sym' ? SYM : mode === 'symb' ? SYMB : ALPHA;
    keysWrap.dataset.mode = mode;
    keysWrap.innerHTML = layout.map((row) => `<div class="osk-row">${row.map(keyHtml).join('')}</div>`).join('');
  }
  function keyHtml(k) {
    if (k === '') return `<span class="osk-key osk-spacer"></span>`;
    const wide = { space: 'space', return: 'wide', back: 'wide', shift: 'wide', '123': 'wide', abc: 'wide', symb: 'wide' }[k] || '';
    const label = { shift: '⇧', back: '⌫', space: 'space', return: '⏎', '123': '123', abc: 'ABC', symb: '#+=' }[k];
    const cls = k === 'shift' && shift ? ' on' : '';
    const cap = mode === 'alpha' && shift && k.length === 1 ? k.toUpperCase() : k;
    return `<button type="button" class="osk-key ${wide}${cls}" data-k="${k}">${label || cap}</button>`;
  }

  function onKeyDown(e) {
    const btn = e.target.closest('.osk-key');
    if (!btn || !target) return;
    e.preventDefault(); // keep the field focused + its caret intact
    const k = btn.dataset.k;
    if (k === 'shift') { shift = !shift; render(); return; }
    if (k === '123') { mode = 'sym'; shift = false; render(); return; }
    if (k === 'symb') { mode = 'symb'; render(); return; }
    if (k === 'abc') { mode = 'alpha'; render(); return; }
    if (k === 'back') { backspace(); return; }
    if (k === 'space') { insert(' '); return; }
    if (k === 'return') { enter(); return; }
    let ch = k;
    if (mode === 'alpha' && shift) { ch = k.toUpperCase(); shift = false; render(); }
    insert(ch);
  }

  function insert(s) {
    const el = target, max = el.maxLength;
    if (el.selectionStart != null) {
      const a = el.selectionStart, b = el.selectionEnd;
      let next = el.value.slice(0, a) + s + el.value.slice(b);
      if (max > 0 && next.length > max) next = next.slice(0, max);
      el.value = next;
      const p = Math.min(a + s.length, el.value.length); el.setSelectionRange(p, p);
    } else {
      let next = el.value + s; if (max > 0 && next.length > max) next = next.slice(0, max); el.value = next;
    }
    fire();
  }
  function backspace() {
    const el = target;
    if (el.selectionStart != null) {
      let a = el.selectionStart, b = el.selectionEnd;
      if (a === b) { if (a === 0) return; el.value = el.value.slice(0, a - 1) + el.value.slice(b); a--; }
      else el.value = el.value.slice(0, a) + el.value.slice(b);
      el.setSelectionRange(a, a);
    } else el.value = el.value.slice(0, -1);
    fire();
  }
  function enter() {
    const el = target;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    // advance to the next field in the same card/form if there is one, else hide
    const next = nextField(el);
    if (next) { next.focus(); next.select && next.select(); }
    else close();
  }
  function nextField(el) {
    const scope = el.closest('.onb-card, .sheet, form, .modal, body');
    if (!scope) return null;
    const all = [...scope.querySelectorAll('input, textarea')].filter(eligible).filter((i) => i.offsetParent !== null);
    const i = all.indexOf(el);
    return i > -1 && i < all.length - 1 ? all[i + 1] : null;
  }

  function fire() { target.dispatchEvent(new Event('input', { bubbles: true })); syncBar(); }

  function syncBar() {
    if (!target) return;
    const isPass = target.type === 'password';
    const eye = host.querySelector('#osk-eye'); eye.hidden = !isPass;
    let v = target.value || '';
    if (isPass && !showPass) v = '•'.repeat(v.length);
    barLabel.textContent = target.getAttribute('aria-label') || target.placeholder || '';
    barVal.textContent = v;
    barVal.dir = /[֐-׿؀-ۿ]/.test(target.value) ? 'rtl' : 'ltr';
  }

  function open(el) {
    if (!host) build();
    target = el;
    showPass = false; shift = el.type === 'password' ? false : false;
    mode = isNumeric(el) ? 'num' : 'alpha';
    render(); syncBar();
    document.body.classList.add('osk-open');
    host.classList.add('show');
  }
  function close() {
    if (!host) return;
    host.classList.remove('show');
    document.body.classList.remove('osk-open');
    target = null;
  }

  function init() {
    document.addEventListener('focusin', (e) => { if (eligible(e.target)) open(e.target); });
    // tapping anywhere that isn't an eligible field or the keyboard dismisses it
    document.addEventListener('pointerdown', (e) => {
      if (!host || !host.classList.contains('show')) return;
      if (e.target.closest('.osk')) return;
      if (eligible(e.target.closest('input, textarea') || e.target)) return;
      close();
    }, true);
  }

  return { init, open, close };
})();
