/* calibrate.js — touchscreen recalibration.
 *
 * Walks through tap targets, fits an affine "Coordinate Transformation Matrix"
 * (the 3x3 X / libinput uses), stores it, and hands it to the Pi helper to
 * apply + persist (xinput). Web pages can't reprogram the digitizer directly,
 * so the matrix is applied at the X layer on the Pi.
 */
const Calibrate = (() => {
  // ideal target positions in normalized [0,1] screen coords
  const TARGETS = [[0.12, 0.12], [0.88, 0.12], [0.88, 0.88], [0.12, 0.88], [0.5, 0.5]];

  function start(onDone) {
    const ov = document.createElement('div');
    ov.className = 'calib-ov';
    document.body.appendChild(ov);
    let i = 0; const measured = [];

    const showTarget = () => {
      const [nx, ny] = TARGETS[i];
      ov.innerHTML = `
        <div class="calib-info">Recalibrate — tap the centre of each target<br><b>${i + 1} / ${TARGETS.length}</b></div>
        <div class="calib-target" style="left:${nx * 100}%;top:${ny * 100}%"><i></i></div>
        <button class="calib-cancel" id="calib-cancel">Cancel</button>`;
      ov.querySelector('#calib-cancel').onpointerdown = (e) => { e.stopPropagation(); cleanup(); onDone && onDone(null); };
    };

    const onTap = (e) => {
      // ignore taps on the Cancel button
      if (e.target.closest && e.target.closest('#calib-cancel')) return;
      measured.push([e.clientX / window.innerWidth, e.clientY / window.innerHeight]);
      i++;
      if (i >= TARGETS.length) finish(); else showTarget();
    };
    ov.addEventListener('pointerdown', onTap);

    function finish() {
      // map where taps LANDED (measured) → where they were AIMED (ideal)
      const aff = fitAffine(measured, TARGETS);
      const matrix = [aff[0], aff[1], aff[2], aff[3], aff[4], aff[5], 0, 0, 1].map((n) => +n.toFixed(6));
      Store.set('touchMatrix', matrix);
      cleanup();
      onDone && onDone(matrix);
    }
    function cleanup() { ov.removeEventListener('pointerdown', onTap); ov.remove(); }

    showTarget();
  }

  /* ---- affine least-squares fit: src[x,y] → dst[x,y] ---- */
  function fitAffine(src, dst) {
    const AtA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], Atx = [0, 0, 0], Aty = [0, 0, 0];
    for (let k = 0; k < src.length; k++) {
      const r = [src[k][0], src[k][1], 1];
      for (let a = 0; a < 3; a++) { for (let b = 0; b < 3; b++) AtA[a][b] += r[a] * r[b]; Atx[a] += r[a] * dst[k][0]; Aty[a] += r[a] * dst[k][1]; }
    }
    const abc = solve3(AtA, Atx), def = solve3(AtA, Aty);
    return [...abc, ...def];
  }
  function solve3(A, y) {
    const M = A.map((r, i) => [...r, y[i]]);
    for (let col = 0; col < 3; col++) {
      let piv = col;
      for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      [M[col], M[piv]] = [M[piv], M[col]];
      const d = M[col][col] || 1e-9;
      for (let r = 0; r < 3; r++) { if (r === col) continue; const f = M[r][col] / d; for (let c = col; c < 4; c++) M[r][c] -= f * M[col][c]; }
    }
    return [M[0][3] / (M[0][0] || 1e-9), M[1][3] / (M[1][1] || 1e-9), M[2][3] / (M[2][2] || 1e-9)];
  }

  return { start };
})();
