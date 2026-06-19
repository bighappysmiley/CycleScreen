/* cropper.js — simple, solid profile-photo cropper: pan + zoom + circular crop.
 * Cropper.open(file, onDone) shows a modal; onDone(blob) gets a square JPEG of
 * the cropped circle (the avatar masks it to a circle on display).
 */
const Cropper = (() => {
  const S = 260; // on-screen crop stage size (must match .crop-stage in CSS)

  function open(file, onDone) {
    const url = URL.createObjectURL(file);
    const ov = document.createElement('div');
    ov.className = 'crop-ov';
    ov.innerHTML = `
      <div class="crop-card">
        <div class="crop-title">Move &amp; Scale</div>
        <div class="crop-stage" id="crop-stage"><img id="crop-img" alt=""><div class="crop-mask"></div></div>
        <input type="range" id="crop-zoom" min="1" max="4" step="0.01" value="1" />
        <div class="crop-actions">
          <button class="btn btn--ghost btn--pill" id="crop-cancel">Cancel</button>
          <button class="btn btn--pill" id="crop-ok" style="background:var(--accent)">Use Photo</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));

    const img = ov.querySelector('#crop-img');
    const zoomEl = ov.querySelector('#crop-zoom');
    let iw = 0, ih = 0, base = 1, zoom = 1, tx = 0, ty = 0, drag = false, lx = 0, ly = 0;
    const scale = () => base * zoom;

    img.onload = () => {
      iw = img.naturalWidth; ih = img.naturalHeight;
      base = Math.max(S / iw, S / ih);
      zoom = 1; tx = (S - iw * base) / 2; ty = (S - ih * base) / 2;
      apply();
    };
    img.src = url;

    function apply() {
      const w = iw * scale(), h = ih * scale();
      tx = Math.min(0, Math.max(S - w, tx));
      ty = Math.min(0, Math.max(S - h, ty));
      img.style.width = w + 'px'; img.style.height = h + 'px';
      img.style.transform = `translate(${tx}px, ${ty}px)`;
    }

    const pt = (e) => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    const down = (e) => { drag = true; const p = pt(e); lx = p.x; ly = p.y; };
    const move = (e) => { if (!drag) return; const p = pt(e); tx += p.x - lx; ty += p.y - ly; lx = p.x; ly = p.y; apply(); if (e.cancelable) e.preventDefault(); };
    const up = () => { drag = false; };
    const stage = ov.querySelector('#crop-stage');
    stage.addEventListener('mousedown', down); stage.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('mousemove', move); stage.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up); stage.addEventListener('touchend', up);

    zoomEl.oninput = () => {
      const c = S / 2, old = scale(); zoom = +zoomEl.value; const ns = scale();
      tx = c - (c - tx) * (ns / old); ty = c - (c - ty) * (ns / old); // zoom around center
      apply();
    };

    function close() {
      URL.revokeObjectURL(url);
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      ov.classList.remove('show'); setTimeout(() => ov.remove(), 250);
    }
    ov.querySelector('#crop-cancel').onclick = close;
    ov.querySelector('#crop-ok').onclick = () => {
      const OUT = 512, cv = document.createElement('canvas'); cv.width = cv.height = OUT;
      const s = scale();
      cv.getContext('2d').drawImage(img, (-tx) / s, (-ty) / s, S / s, S / s, 0, 0, OUT, OUT);
      cv.toBlob((blob) => { close(); blob && onDone(blob); }, 'image/jpeg', 0.9);
    };
  }

  return { open };
})();
