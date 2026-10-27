/* hq-core.js v8 (contorno real do quadro, calha diagonal, molduras, insets, ordem XY) — leitura guiada de HQ (porte fiel de balloon_shots.py, panels_dark.py, camera_panels.py,
 * camera_cover.py e export_steps.py). Visao computacional classica com OpenCV.js, sem IA.
 * Uso:  const page = HQ.analyze(cv, matBGR)  ->  {w, h, bg:[r,g,b], guiado, tipo, steps:[{cx,cy,z,rect,n}]}
 * Coordenadas na resolucao ORIGINAL da pagina. Tela em pe: ASP = largura/altura = 0.625. */
(function (root) {
  'use strict';
  const ASP = 0.625, WORK_W = 1400;
  // zoom de leitura (ajustavel pelo leitor: 'tamanho da letra'). Padrao original 2.3; quadro inteiro se couber com 87% dele.
  let ZT = 2.3, Z_INTEIRO = 2.0, Z_SEM_BALAO = 2.0, ZMAX = 3.0;
  // quadro que cabe inteiro com ate 20% menos zoom aparece inteiro (como o 'fit-to-screen' do Kindle): evita micro-panoramica que treme
  function setZoom(z) { ZT = z; Z_INTEIRO = z * 0.8; Z_SEM_BALAO = Z_INTEIRO; ZMAX = Math.max(z * 1.3, z + 0.3); }
  let cv = null, SCALE_ALTURA = false;

  /* ---------------- utilidades numericas (iguais ao numpy) ---------------- */
  const trunc = Math.trunc;
  function roundHE(x) { // round() do Python: metade para o par
    const f = Math.floor(x), d = x - f;
    if (d > 0.5) return f + 1; if (d < 0.5) return f;
    return (f % 2 === 0) ? f : f + 1;
  }
  function median(arr) {
    const n = arr.length; if (!n) return NaN;
    const a = Float64Array.from(arr).sort();
    return n % 2 ? a[(n - 1) >> 1] : (a[n / 2 - 1] + a[n / 2]) / 2;
  }
  function percentileSorted(a, q) { // numpy linear
    const n = a.length; if (!n) return NaN;
    const idx = (n - 1) * q / 100, lo = Math.floor(idx), hi = Math.ceil(idx);
    return a[lo] + (a[hi] - a[lo]) * (idx - lo);
  }
  // percentil/mediana pelo histograma (identico ao numpy linear para valores inteiros 0..255)
  function histAt(h, k) { let c = 0; for (let v = 0; v < 256; v++) { c += h[v]; if (c > k) return v; } return 255; }
  function histPct(h, n, q) { const idx = (n - 1) * q / 100, lo = Math.floor(idx), hi = Math.ceil(idx), a = histAt(h, lo), b = histAt(h, hi); return a + (b - a) * (idx - lo); }
  function histMedian(h, n) { return n % 2 ? histAt(h, (n - 1) / 2) : (histAt(h, n / 2 - 1) + histAt(h, n / 2)) / 2; }
  function sortedU8(list) { const a = Float64Array.from(list); a.sort(); return a; }
  function meanStd(vals) {
    let s = 0, s2 = 0; const n = vals.length; if (!n) return [NaN, NaN];
    for (let i = 0; i < n; i++) { const v = vals[i]; s += v; s2 += v * v; }
    const m = s / n; return [m, Math.sqrt(Math.max(0, s2 / n - m * m))];
  }
  function inter(a, b) {
    return Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  }
  function clip(a, b) {
    const x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]), x1 = Math.min(a[0] + a[2], b[0] + b[2]), y1 = Math.min(a[1] + a[3], b[1] + b[3]);
    return [x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0)];
  }
  function union(rs) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rs) { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[0] + r[2]); y1 = Math.max(y1, r[1] + r[3]); }
    return [x0, y0, x1 - x0, y1 - y0];
  }
  function fitZoom(r, W) { return Math.min(ZMAX, W / r[2], W / (r[3] * ASP)) / 1.02; }
  function windowAt(cx, cy, z, W, H) {
    const ww = W / z, wh = ww / ASP;
    cx = ww >= W ? W / 2 : Math.min(Math.max(cx, ww / 2), W - ww / 2);
    cy = wh >= H ? H / 2 : Math.min(Math.max(cy, wh / 2), H - wh / 2);
    return [cx - ww / 2, cy - wh / 2, ww, wh];
  }
  /* ---------- poligonos (contorno real do quadro, como o yj.border_path do Kindle) ---------- */
  function polyArea(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function polyCW(P) { return polyArea(P) < 0 ? P.slice().reverse() : P; } // horario na tela (y para baixo)
  function rectPoly(r) { return [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0] + r[2], r[1] + r[3]], [r[0], r[1] + r[3]]]; }
  function polyBox(P) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1 - x0, y1 - y0]; }
  function clipHalf(P, A, B, keep) { // Sutherland-Hodgman: mantem o lado onde sinal(cruz(B-A,P-A)) == keep
    const side = p => ((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0])) * keep;
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length], sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return out;
  }
  function clipRect(P, r) {
    let o = P;
    o = clipHalf(o, [r[0], r[1]], [r[0] + 1, r[1]], 1); if (o.length < 3) return o;
    o = clipHalf(o, [r[0] + r[2], r[1]], [r[0] + r[2], r[1] + 1], 1); if (o.length < 3) return o;
    o = clipHalf(o, [r[0], r[1] + r[3]], [r[0] - 1, r[1] + r[3]], 1); if (o.length < 3) return o;
    return clipHalf(o, [r[0], r[1]], [r[0], r[1] - 1], 1);
  }
  function clipConvex(S, P) { // recorta S pelo poligono convexo P (horario na tela)
    let o = S; const C = polyCW(P);
    for (let i = 0; i < C.length && o.length >= 3; i++) o = clipHalf(o, C[i], C[(i + 1) % C.length], 1);
    return o;
  }
  function withPoly(r, P) { if (P && P.length >= 3) r.poly = P; return r; }
  function cp(p) { return withPoly(p.slice(), p.poly); }
  function argmaxBy(n, f) { let bi = 0, bv = -Infinity; for (let i = 0; i < n; i++) { const v = f(i); if (v > bv) { bv = v; bi = i; } } return bi; }
  function cmpTuple(a, b) { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; }
  function linspace(a, b, n) { const o = []; for (let i = 0; i < n; i++) o.push(a + (b - a) * i / (n - 1)); return o; }

  /* ---------------- utilidades OpenCV ---------------- */
  function resize(src, w, h, interp) { const d = new cv.Mat(); cv.resize(src, d, new cv.Size(w, h), 0, 0, interp); return d; }
  function toGray(bgr) { const d = new cv.Mat(); cv.cvtColor(bgr, d, cv.COLOR_BGR2GRAY); return d; }
  function toHSV(bgr) { const d = new cv.Mat(); cv.cvtColor(bgr, d, cv.COLOR_BGR2HSV); return d; }
  function maskFrom(w, h, fn) { const m = new cv.Mat(h, w, cv.CV_8UC1); const d = m.data; for (let i = 0; i < w * h; i++) d[i] = fn(i) ? 255 : 0; return m; }
  function morph(src, op, kh, kw) { const k = cv.Mat.ones(kh, kw, cv.CV_8U), d = new cv.Mat(); cv.morphologyEx(src, d, op, k, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue()); k.delete(); return d; }
  function dilate(src, kh, kw) { const k = cv.Mat.ones(kh, kw, cv.CV_8U), d = new cv.Mat(); cv.dilate(src, d, k, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue()); k.delete(); return d; }
  function cc(src, conn) { // -> {n, stats:Int32Array (n*5), labels:Mat}
    const lab = new cv.Mat(), st = new cv.Mat(), ce = new cv.Mat();
    const n = cv.connectedComponentsWithStats(src, lab, st, ce, conn, cv.CV_32S);
    const stats = Int32Array.from(st.data32S); st.delete(); ce.delete();
    return { n, stats, labels: lab };
  }
  function contours(mask) { // RETR_CCOMP, CHAIN_APPROX_SIMPLE
    const cs = new cv.MatVector(), hi = new cv.Mat();
    cv.findContours(mask, cs, hi, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
    const n = cs.size(), H = hi.rows ? Int32Array.from(hi.data32S) : new Int32Array(0); hi.delete();
    const area = new Float64Array(n), rect = new Array(n);
    for (let i = 0; i < n; i++) { const c = cs.get(i); area[i] = cv.contourArea(c); const r = cv.boundingRect(c); rect[i] = [r.x, r.y, r.width, r.height]; c.delete(); }
    return { cs, n, hier: H, area, rect, next: i => H[i * 4], child: i => H[i * 4 + 2], parent: i => H[i * 4 + 3] };
  }
  function hullArea(cs, i) { const c = cs.get(i), h = new cv.Mat(); cv.convexHull(c, h, false, true); const a = cv.contourArea(h); c.delete(); h.delete(); return a; }
  function smallOf(img, work_w) {
    const h0 = img.rows, w0 = img.cols, s = SCALE_ALTURA ? Math.min(1.0, work_w * 1.5375 / h0) : Math.min(1.0, work_w / w0); // 2a passada: pela altura (pagina dupla)
    const small = s < 1 ? resize(img, trunc(w0 * s), trunc(h0 * s), cv.INTER_AREA) : img.clone();
    return { small, s };
  }

  /* ---------------- balao branco + resgate de texto colado ---------------- */
  function detectWhite(img, work_w = WORK_W) {
    const { small, s } = smallOf(img, work_w), h = small.rows, w = small.cols;
    const gray = toGray(small), hsv = toHSV(small); small.delete();
    const G = gray.data, HS = hsv.data;
    let cnt = 0; const bright0 = maskFrom(w, h, i => { const ok = G[i] >= 205 && HS[i * 3 + 1] < 70; if (ok) cnt++; return ok; });
    hsv.delete();
    if (cnt / (w * h) > 0.45) { bright0.delete(); gray.delete(); return []; }
    const bright = morph(bright0, cv.MORPH_OPEN, 2, 2); bright0.delete();
    const C = contours(bright); bright.delete();
    const out = [], rejected = [], page = w * h;
    try {
      for (let i = 0; i < C.n; i++) {
        if (C.parent(i) !== -1) continue;
        const [x, y, bw, bh] = C.rect[i], filled = C.area[i];
        if (filled > 0.09 * page) { rejected.push(i); continue; }
        if (filled < 0.0008 * page) continue;
        if (bw < 0.045 * w || bh < 0.02 * h) continue;
        if (Math.max(bw / bh, bh / bw) > 6) continue;
        const sol = filled / Math.max(1.0, hullArea(C.cs, i));
        if (sol < 0.72) rejected.push(i);
        let holes = 0, ha = 0, nlet = 0; const lr = [];
        for (let ch = C.child(i); ch !== -1; ch = C.next(ch)) {
          const a = C.area[ch];
          if (a >= 2) { holes++; ha += a; const r_ = C.rect[ch]; if (0.005 * h <= r_[3] && r_[3] <= 0.02 * h) { nlet++; lr.push(r_); } }
        }
        let ink = ha / Math.max(1.0, filled), smallOk = false;
        if (nlet >= 1 && nlet === holes && holes <= 12 && sol >= 0.7 && 0.01 <= ink && ink < 0.08 && bw * bh < 0.012 * page) {
          const ys = lr.map(r_ => r_[1] + r_[3] / 2), hs = lr.map(r_ => r_[3]), cx = lr.map(r_ => r_[0] + r_[2] / 2);
          const wide = lr.reduce((t, r_) => t + r_[2], 0) >= 2.2 * Math.max(...hs);
          const central = Math.abs(Math.min(...cx) + (Math.max(...cx) - Math.min(...cx)) / 2 - (x + bw / 2)) <= 0.3 * bw;
          if (wide && central && Math.max(...ys) - Math.min(...ys) <= 0.8 * Math.max(...hs) && Math.max(...hs) <= 1.6 * Math.min(...hs)) { ink = 0.08; smallOk = true; }
        }
        if ((nlet < 2 && !smallOk) || nlet < 0.35 * holes) continue;
        if (sol < 0.5 && !(sol >= 0.4 && nlet >= 4 && nlet >= 0.6 * holes)) continue;
        if ((holes < 2 && !smallOk) || !(0.08 <= ink && ink <= 0.5)) { if (holes >= 8 && !rejected.includes(i)) rejected.push(i); continue; }
        if (0.5 <= sol && sol < 0.72 && !smallOk && !(ink >= 0.15 && holes >= 12) && !(nlet >= 5 && nlet >= 0.7 * holes)) continue;
        const touch = (x <= 1) + (y <= 1) + (x + bw >= w - 1) + (y + bh >= h - 1);
        if (touch >= 2) continue;
        out.push([x / s, y / s, bw / s, bh / s]);
        const ri = rejected.indexOf(i); if (ri >= 0) rejected.splice(ri, 1);
      }
      const res = out.concat(rescueText(C, rejected, out, w, h, s, gray));
      return res.map(b => b.map(v => roundHE(v)));
    } finally { C.cs.delete(); gray.delete(); }
  }

  function rescueText(C, rejected, found, w, h, s, gray) {
    const res = [], G = gray.data;
    for (const i of rejected) {
      const [, , bw0, bh0] = C.rect[i];
      if (bw0 * bh0 < 0.002 * w * h) continue;
      let lets = [], nh = 0;
      for (let ch = C.child(i); ch !== -1; ch = C.next(ch)) {
        const [bx, by, bww, bhh] = C.rect[ch];
        if (C.area[ch] >= 2) nh++;
        if (0.005 * h <= bhh && bhh <= 0.02 * h && bww <= 8 * bhh) lets.push([bx, by, bww, bhh]);
      }
      if (lets.length < 0.3 * nh) continue;
      const fs = found.concat(res).map(f => [f[0] * s, f[1] * s, f[2] * s, f[3] * s]);
      lets = lets.filter(l => !fs.some(f => f[0] <= l[0] + l[2] / 2 && l[0] + l[2] / 2 <= f[0] + f[2] && f[1] <= l[1] + l[3] / 2 && l[1] + l[3] / 2 <= f[1] + f[3]));
      if (lets.length < 6) continue;
      const mh = median(lets.map(l => l[3]));
      lets = lets.filter(l => 0.5 * mh <= l[3] && l[3] <= 1.6 * mh);
      const m0 = cv.Mat.zeros(h, w, cv.CV_8UC1), M = m0.data;
      for (const [bx, by, bww, bhh] of lets) for (let yy = by; yy < Math.min(h, by + bhh); yy++) M.fill(1, yy * w + bx, yy * w + Math.min(w, bx + bww));
      const m = dilate(m0, Math.max(3, trunc(1.1 * mh)), Math.max(3, trunc(1.6 * mh))); m0.delete();
      const R = cc(m, 8); m.delete(); R.labels.delete();
      for (let k = 1; k < R.n; k++) {
        const cx = R.stats[k * 5], cy = R.stats[k * 5 + 1], cw = R.stats[k * 5 + 2], chh = R.stats[k * 5 + 3];
        const inside = lets.filter(l => cx <= l[0] && l[0] + l[2] <= cx + cw && cy <= l[1] && l[1] + l[3] <= cy + chh);
        if (inside.length < 6 || cw < 3 * mh) continue;
        const fill = inside.reduce((t, l) => t + l[2] * l[3], 0) / (cw * chh);
        if (fill < 0.12) continue;
        const pad = 0.9 * mh;
        const box = [Math.max(0, cx - pad) / s, Math.max(0, cy - pad) / s, (cw + 2 * pad) / s, (chh + 2 * pad) / s];
        const vals = [];
        for (const l of inside) for (let yy = l[1]; yy < Math.min(h, l[1] + l[3]); yy++) for (let xx = l[0]; xx < Math.min(w, l[0] + l[2]); xx++) { const v = G[yy * w + xx]; if (v < 200) vals.push(v); }
        if (!vals.length || median(vals) > 90) continue;
        if (found.concat(res).some(f => inter(box, f) > 0.5 * Math.min(box[2] * box[3], f[2] * f[3]))) continue;
        res.push(box);
      }
    }
    return res;
  }

  /* ---------------- caixa de narracao colorida ---------------- */
  function detectCaptions(img, white, work_w = 1000) {
    const h0 = img.rows, w0 = img.cols, s = SCALE_ALTURA ? work_w * 1.5375 / h0 : work_w / w0;
    const sm = resize(img, SCALE_ALTURA ? trunc(w0 * s) : work_w, trunc(h0 * s), cv.INTER_AREA), h = sm.rows, w = sm.cols;
    const hsv = toHSV(sm); sm.delete(); const D = hsv.data;
    let out = [];
    // so analisa as faixas de cor que tem pixels suficientes para formar uma caixa de narracao (acelera muito)
    const hcount = new Uint32Array(180);
    for (let i = 0; i < w * h; i++) if (D[i * 3 + 1] > 110 && D[i * 3 + 2] > 70) hcount[D[i * 3]]++;
    const minPix = 0.55 * (0.08 * w) * (0.015 * h);
    for (let c = 0; c < 180; c += 10) {
      let nb = 0; for (let hu = 0; hu < 180; hu++) { let d = Math.abs(hu - c - 5); d = Math.min(d, 180 - d); if (d <= 9) nb += hcount[hu]; }
      if (nb < minPix) continue;
      const lut = new Uint8Array(180); for (let hu = 0; hu < 180; hu++) { let d = Math.abs(hu - c - 5); d = Math.min(d, 180 - d); lut[hu] = d <= 9 ? 255 : 0; }
      const m = new cv.Mat(h, w, cv.CV_8UC1), MM = m.data;
      for (let i = 0, j = 0, n = w * h; i < n; i++, j += 3) MM[i] = (D[j + 1] > 110 && D[j + 2] > 70) ? lut[D[j]] : 0;
      const C = contours(m); m.delete();
      for (let i = 0; i < C.n; i++) {
        if (C.parent(i) !== -1) continue;
        const [x, y, bw, bh] = C.rect[i];
        if (bw < 0.08 * w || bh < 0.015 * h || bw * bh > 0.08 * w * h) continue;
        const filled = C.area[i];
        if (filled < 0.55 * bw * bh) continue;
        let holes = 0, ha = 0; const hs = [];
        for (let ch = C.child(i); ch !== -1; ch = C.next(ch)) { const a = C.area[ch]; if (a >= 2) { holes++; ha += a; hs.push(C.rect[ch][3]); } }
        if (holes < 12) continue;
        const mh = median(hs);
        if (!(0.005 * h <= mh && mh <= 0.022 * h)) continue;
        if (hs.filter(v => 0.4 * mh <= v && v <= 1.8 * mh).length / hs.length < 0.75) continue;
        if (holes < 0.6 * bw / Math.max(1.0, mh)) continue;
        const ink = ha / Math.max(1.0, bw * bh);
        if (!(0.06 <= ink && ink <= 0.6)) continue;
        out.push([x / s, y / s, bw / s, bh / s]);
      }
      C.cs.delete();
    }
    hsv.delete();
    out = out.map(b => b.map(v => roundHE(v)));
    const ovf = (a, b) => { const ix = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])), iy = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])); return ix * iy / (a[2] * a[3]); };
    out = out.filter(b => !white.some(q => ovf(b, q) > 0.3));
    const res = [];
    for (const b of out.slice().sort((p, q) => q[2] * q[3] - p[2] * p[3]))
      if (!res.some(r => b[0] >= r[0] - 5 && b[1] >= r[1] - 5 && b[0] + b[2] <= r[0] + r[2] + 5 && b[1] + b[3] <= r[1] + r[3] + 5)) res.push(b);
    return res;
  }

  /* ---------------- balao escuro / colorido com letra clara ---------------- */
  function detectFilled(img, kind, work_w = WORK_W) {
    const { small, s } = smallOf(img, work_w), h = small.rows, w = small.cols;
    const gray = toGray(small), G = gray.data;
    let m0;
    if (kind === 'dark') m0 = maskFrom(w, h, i => G[i] <= 60);
    else { const hsv = toHSV(small), D = hsv.data; m0 = maskFrom(w, h, i => D[i * 3 + 1] >= 150 && D[i * 3 + 2] >= 90 && G[i] < 150); hsv.delete(); }
    small.delete();
    const m1 = morph(m0, cv.MORPH_OPEN, 2, 2); m0.delete();
    const C = contours(m1); m1.delete();
    const out = [];
    try {
      for (let i = 0; i < C.n; i++) {
        if (C.parent(i) !== -1) continue;
        const [x, y, bw, bh] = C.rect[i], filled = C.area[i];
        if (!(0.0008 * w * h <= filled && filled <= 0.05 * w * h)) continue;
        if (bw < 0.04 * w || bh < 0.02 * h || Math.max(bw / bh, bh / bw) > 6) continue;
        const sol = filled / Math.max(1.0, hullArea(C.cs, i));
        if (sol < 0.6) continue;
        let holes = 0, nlet = 0, ha = 0; const lets = [];
        for (let ch = C.child(i); ch !== -1; ch = C.next(ch)) {
          const a = C.area[ch];
          if (a >= 2) { holes++; ha += a; const r = C.rect[ch]; if (0.005 * h <= r[3] && r[3] <= 0.02 * h) { nlet++; lets.push(r); } }
        }
        const ink = ha / Math.max(1.0, filled);
        if (nlet < 4 || nlet < 0.5 * holes || !(0.05 <= ink && ink <= 0.55)) continue;
        const mh = median(lets.map(l => l[3]));
        if (lets.filter(l => 0.6 * mh <= l[3] && l[3] <= 1.5 * mh).length < 0.7 * lets.length) continue;
        const mk = cv.Mat.zeros(h, w, cv.CV_8UC1); cv.drawContours(mk, C.cs, i, new cv.Scalar(255), -1);
        const MK = mk.data; let tot = 0, lit = 0;
        for (let yy = y; yy < y + bh; yy++) for (let xx = x; xx < x + bw; xx++) { const p = yy * w + xx; if (MK[p]) { tot++; if (G[p] > 110) lit++; } }
        mk.delete();
        if (!tot || lit / tot < 0.04) continue;
        const touch = (x <= 1) + (y <= 1) + (x + bw >= w - 1) + (y + bh >= h - 1);
        if (touch >= 1) continue;
        out.push([trunc(x / s), trunc(y / s), trunc(bw / s), trunc(bh / s)]);
      }
    } finally { C.cs.delete(); gray.delete(); }
    return out;
  }

  /* ---------------- bloco de texto de qualquer cor ---------------- */
  function detectTextBlocks(img, work_w = WORK_W, invert = null) {
    if (invert === null) {
      const a = detectTextBlocks(img, work_w, false);
      return a.concat(detectTextBlocks(img, work_w, true).filter(d => !a.some(r => inter(d, r) > 0.2 * Math.min(d[2] * d[3], r[2] * r[3]))));
    }
    const { small, s } = smallOf(img, work_w), h = small.rows, w = small.cols;
    const gray = toGray(small); small.delete();
    if (invert) { const D = gray.data; for (let i = 0; i < D.length; i++) D[i] = 255 - D[i]; }
    const b = new cv.Mat(); cv.adaptiveThreshold(gray, b, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 25, 18);
    const R = cc(b, 8); b.delete(); R.labels.delete();
    const lets = [];
    for (let k = 1; k < R.n; k++) {
      const x = R.stats[k * 5], y = R.stats[k * 5 + 1], bw = R.stats[k * 5 + 2], bh = R.stats[k * 5 + 3], a = R.stats[k * 5 + 4];
      if (0.0035 * h <= bh && bh <= 0.015 * h && 0.15 * bh <= bw && bw <= 1.8 * bh && a >= 0.18 * bw * bh) lets.push([x, y, bw, bh]);
    }
    if (lets.length < 8) { gray.delete(); return []; }
    const out = [], mhAll = median(lets.map(l => l[3]));
    const m = cv.Mat.zeros(h, w, cv.CV_8UC1), M = m.data;
    for (const [x, y, bw, bh] of lets) for (let yy = y; yy < Math.min(h, y + bh); yy++) M.fill(255, yy * w + x, yy * w + Math.min(w, x + bw));
    const md = dilate(m, Math.max(3, trunc(0.9 * mhAll)), Math.max(3, trunc(1.3 * mhAll)));
    const RB = cc(md, 8); md.delete(); RB.labels.delete();
    function split(ls, axis, gap) {
      if (!ls.length) return [];
      ls = ls.slice().sort((p, q) => p[axis] - q[axis]);
      const groups = [[ls[0]]]; let end = ls[0][axis] + ls[0][axis + 2];
      for (const l of ls.slice(1)) { if (l[axis] - end > gap) groups.push([l]); else groups[groups.length - 1].push(l); end = Math.max(end, l[axis] + l[axis + 2]); }
      return groups;
    }
    const cand = [];
    for (let k = 1; k < RB.n; k++) {
      const x = RB.stats[k * 5], y = RB.stats[k * 5 + 1], bw = RB.stats[k * 5 + 2], bh = RB.stats[k * 5 + 3];
      const inside0 = lets.filter(l => x <= l[0] && l[0] + l[2] <= x + bw && y <= l[1] && l[1] + l[3] <= y + bh);
      for (const gx of split(inside0, 0, 1.8 * mhAll)) for (const gy of split(gx, 1, 1.4 * mhAll)) cand.push(gy);
    }
    const G = gray.data;
    for (const inside of cand) {
      const x = Math.min(...inside.map(l => l[0])), y = Math.min(...inside.map(l => l[1]));
      const bw = Math.max(...inside.map(l => l[0] + l[2])) - x, bh = Math.max(...inside.map(l => l[1] + l[3])) - y;
      if (inside.length < 8 || bw < 3 * mhAll) continue;
      const mh = median(inside.map(l => l[3]));
      if (inside.filter(l => 0.7 * mh <= l[3] && l[3] <= 1.4 * mh).length < 0.75 * inside.length) continue;
      const cys = inside.map(l => l[1] + l[3]).sort((p, q) => p - q); let lines = 1;
      for (let i = 1; i < cys.length; i++) if (cys[i] - cys[i - 1] > 0.6 * mh) lines++;
      if (inside.length / lines < 4) continue;
      const pad = trunc(0.6 * mh);
      const X0 = Math.max(0, x - pad), Y0 = Math.max(0, y - pad), X1 = Math.min(w, x + bw + pad), Y1 = Math.min(h, y + bh + pad);
      const q = Math.max(2, trunc(0.25 * mh));
      const rx0 = Math.max(0, x - q), ry0 = Math.max(0, y - q), rx1 = Math.min(w, x + bw + q), ry1 = Math.min(h, y + bh + q);
      const sub = m.roi(new cv.Rect(rx0, ry0, rx1 - rx0, ry1 - ry0)), subc = sub.clone(); sub.delete();
      const let_ = dilate(subc, 3, 3); subc.delete(); const L = let_.data, rw = rx1 - rx0;
      const hb = new Uint32Array(256), hi = new Uint32Array(256); let nbg = 0, nin = 0;
      for (let yy = ry0; yy < ry1; yy++) { const o = yy * w, lo = (yy - ry0) * rw - rx0; for (let xx = rx0; xx < rx1; xx++) { const v = G[o + xx]; if (L[lo + xx] === 0) { hb[v]++; nbg++; } else { hi[v]++; nin++; } } }
      let_.delete();
      if (nbg < 50) continue;
      const bgMed = histMedian(hb, nbg);
      if (histPct(hb, nbg, 85) - histPct(hb, nbg, 15) > 30 || bgMed < 120) continue;
      if (!nin || bgMed - histPct(hi, nin, 20) < 60) continue;
      out.push([trunc(X0 / s), trunc(Y0 / s), trunc((X1 - X0) / s), trunc((Y1 - Y0) / s)]);
    }
    m.delete(); gray.delete();
    return out;
  }

  function detectBalloons(img) {   // pagina dupla: 2a passada na escala pela altura (letra pequena demais na normal)
    const res = detectOnce(img);
    if (WORK_W * 1.5375 / img.rows > 1.15 * WORK_W / img.cols) {
      SCALE_ALTURA = true; let extra; try { extra = detectOnce(img); } finally { SCALE_ALTURA = false; }
      for (const d of extra) if (!res.some(r => inter(d, r) > 0.2 * Math.min(d[2] * d[3], r[2] * r[3]))) res.push(d);
    }
    return res;
  }
  function detectOnce(img) {
    const T = root.HQT || null, t0 = Date.now(), tk = k => { if (T) { T[k] = (T[k] || 0) + Date.now() - tk.t; } tk.t = Date.now(); }; tk.t = t0;
    const white = detectWhite(img); tk('branco');
    const res = white.concat(detectCaptions(img, white)); tk('narracao');
    const dk = detectFilled(img, 'dark'); tk('escuro'); const co = detectFilled(img, 'color'); tk('cor');
    const tb = detectTextBlocks(img); tk('texto');
    for (const d of dk) if (!res.some(r => inter(d, r) > 0.3 * Math.min(d[2] * d[3], r[2] * r[3]))) res.push(d);
    for (const d of co) if (!res.some(r => inter(d, r) > 0.3 * Math.min(d[2] * d[3], r[2] * r[3]))) res.push(d);
    for (const d of tb) if (!res.some(r => inter(d, r) > 0.2 * Math.min(d[2] * d[3], r[2] * r[3]))) res.push(d);
    return res;
  }

  /* ---------------- quadros ---------------- */
  function orderRows(ps, keyX) {
    ps.sort((a, b) => a[1] - b[1]); const rows = [];
    for (const p of ps) {
      let placed = false;
      for (const r of rows) {
        const top = Math.min(...r.map(q => q[1])), bot = Math.max(...r.map(q => q[1] + q[3]));
        if (keyX.ge ? Math.min(bot, p[1] + p[3]) - Math.max(top, p[1]) >= 0.5 * Math.min(p[3], bot - top)
                    : Math.min(bot, p[1] + p[3]) - Math.max(top, p[1]) > 0.5 * Math.min(p[3], bot - top)) { r.push(p); placed = true; break; }
      }
      if (!placed) rows.push([p]);
    }
    if (keyX.sortRows) rows.sort((a, b) => Math.min(...a.map(q => q[1])) - Math.min(...b.map(q => q[1])));
    let out = []; for (const r of rows) out = out.concat(r.slice().sort((a, b) => keyX.f(a) - keyX.f(b)));
    return out;
  }

  function panelsDark(img) {
    const H = img.rows, W = img.cols, s = 700 / W, hh = trunc(H * s);
    const sm = resize(img, 700, hh, cv.INTER_LINEAR), g = toGray(sm), G = g.data, S = sm.data, n = 700 * hh;
    const dark = new cv.Mat(hh, 700, cv.CV_8UC1), DK = dark.data;
    for (let i = 0; i < n; i++) DK[i] = G[i] < 28 ? 1 : 0;
    const DKd = Uint8Array.from(DK);   // so o escuro de verdade (sem o fundo da pagina), para a segunda leitura do contorno
    const b = 6, ring = [];
    const push = (x, y) => { const p = (y * 700 + x) * 3; ring.push([S[p], S[p + 1], S[p + 2]]); };
    for (let y = 0; y < b; y++) for (let x = 0; x < 700; x++) push(x, y);
    for (let y = hh - b; y < hh; y++) for (let x = 0; x < 700; x++) push(x, y);
    for (let y = 0; y < hh; y++) for (let x = 0; x < b; x++) push(x, y);
    for (let y = 0; y < hh; y++) for (let x = 700 - b; x < 700; x++) push(x, y);
    const cnt = new Map();
    const keyOf = p => (p[0] >> 4) * 256 + (p[1] >> 4) * 16 + (p[2] >> 4);
    for (const p of ring) { const k = keyOf(p); cnt.set(k, (cnt.get(k) || 0) + 1); }
    let best = -1, bk = 0; for (const [k, v] of cnt) if (v > best || (v === best && k < bk)) { best = v; bk = k; }
    const bgc = [0, 0, 0]; let nb = 0; for (const p of ring) if (keyOf(p) === bk) { bgc[0] += p[0]; bgc[1] += p[1]; bgc[2] += p[2]; nb++; }
    bgc[0] /= nb; bgc[1] /= nb; bgc[2] /= nb;
    const fundoClaro = (bgc[0] + bgc[1] + bgc[2]) / 3 > 150;
    let bsum = 0; const bgm = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const p = i * 3; const d = Math.max(Math.abs(S[p] - bgc[0]), Math.abs(S[p + 1] - bgc[1]), Math.abs(S[p + 2] - bgc[2])); if (d < 28) { bgm[i] = 1; bsum++; } }
    if (bsum / n < 0.5) for (let i = 0; i < n; i++) if (bgm[i]) DK[i] = 1;
    sm.delete(); g.delete();
    const hk = morph(dark, cv.MORPH_OPEN, 1, 60), vk = morph(dark, cv.MORPH_OPEN, 60, 1);
    // v0.69: segunda leitura SO PARA O CONTORNO. Arte preta grossa (cabelo, sombra, folhagem) encostada na borda do quadro virava "calha"
    // e o poligono cortava pedacos da imagem. Aqui as manchas pretas grossas (>= 24 px) saem da calha; o retangulo e a lista de quadros nao mudam.
    let R2 = null;
    if (fundoClaro) {
      const dm = new cv.Mat(hh, 700, cv.CV_8UC1); dm.data.set(DKd);
      const fat0 = morph(dm, cv.MORPH_OPEN, 24, 24), fat = dilate(fat0, 3, 3); dm.delete(); fat0.delete();
      const D2 = new cv.Mat(hh, 700, cv.CV_8UC1), D2d = D2.data, FT = fat.data, D1 = dark.data;
      for (let i = 0; i < n; i++) D2d[i] = FT[i] ? 0 : D1[i];
      fat.delete();
      const hk2 = morph(D2, cv.MORPH_OPEN, 1, 60), vk2 = morph(D2, cv.MORPH_OPEN, 60, 1); D2.delete();
      const or2 = new cv.Mat(); cv.bitwise_or(hk2, vk2, or2); hk2.delete(); vk2.delete();
      const gut2 = dilate(or2, 5, 5); or2.delete();
      const inv2 = new cv.Mat(hh, 700, cv.CV_8UC1); { const I2 = inv2.data, U2 = gut2.data; for (let i = 0; i < n; i++) I2[i] = 1 - U2[i]; }
      gut2.delete(); R2 = cc(inv2, 4); inv2.delete();
    }
    dark.delete();
    const orr = new cv.Mat(); cv.bitwise_or(hk, vk, orr); hk.delete(); vk.delete();
    const gut = dilate(orr, 5, 5); orr.delete();
    const inv = new cv.Mat(hh, 700, cv.CV_8UC1); { const I = inv.data, U = gut.data; for (let i = 0; i < n; i++) I[i] = 1 - U[i]; }
    gut.delete();
    const R = cc(inv, 4); inv.delete();
    let ps = [];
    try {
      for (let i = 1; i < R.n; i++) {
        const x = R.stats[i * 5], y = R.stats[i * 5 + 1], w = R.stats[i * 5 + 2], h = R.stats[i * 5 + 3], a = R.stats[i * 5 + 4];
        // arte de fundo EM VOLTA dos quadros (quadros com borda sobre arte, sem calha): ocupa a pagina toda mas e oca
        if (w > 0.9 * 700 && h > 0.9 * hh && a < 0.7 * w * h) continue;
        if (w > 0.12 * 700 && h > 0.05 * hh && a > 0.02 * hh * 700) {
          let P = compPoly(R.labels, i, x, y, w, h, 700, hh, s);
          if (R2) P = polyMenosCorte(R, R2, i, x, y, w, h, a, P, hh, s);
          ps.push(withPoly([x / s, y / s, w / s, h / s], P));
        }
      }
    } finally { R.labels.delete(); if (R2) R2.labels.delete(); }
    if (ps.length < 2) return [];
    const area = ps.reduce((t, p) => t + p[2] * p[3], 0);
    if (area > 1.15 * W * H || Math.max(...ps.map(p => p[2] * p[3])) > 0.9 * W * H) return [];
    return orderRows(ps, { ge: true, sortRows: true, f: q => q[0] });
  }

  // v0.69: troca o poligono por um que corta MENOS arte, so quando a segunda leitura (sem manchas pretas grossas) concorda com a primeira:
  // mesmo quadro (>= 90% de sobreposicao), sem crescer mais de 8% em largura/altura nem 20% em area, e poligono novo com 0 a 20% mais area.
  function polyMenosCorte(R, R2, i, x, y, w, h, a, Pold, hh, s) {
    if (!Pold) return Pold;   // so troca poligono que ja existia (nunca cria um novo corte)
    try {
      const L1 = R.labels.data32S, L2 = R2.labels.data32S, cnt = new Map();
      let tot = 0;
      for (let yy = 0; yy < h; yy++) { const o = (y + yy) * 700 + x; for (let xx = 0; xx < w; xx++) if (L1[o + xx] === i) { const l = L2[o + xx]; if (l > 0) cnt.set(l, (cnt.get(l) || 0) + 1); tot++; } }
      let j = -1, best = 0; for (const [l, c] of cnt) if (c > best) { best = c; j = l; }
      if (j < 1 || best < 0.9 * a) return Pold;
      const x2 = R2.stats[j * 5], y2 = R2.stats[j * 5 + 1], w2 = R2.stats[j * 5 + 2], h2 = R2.stats[j * 5 + 3], a2 = R2.stats[j * 5 + 4];
      if (w2 > 1.08 * w || h2 > 1.08 * h || a2 > 1.2 * a) return Pold;
      const Pnew = compPoly(R2.labels, j, x2, y2, w2, h2, 700, hh, s);
      const ao = Pold ? Math.abs(polyArea(Pold)) : (w / s) * (h / s), an = Pnew ? Math.abs(polyArea(Pnew)) : (w2 / s) * (h2 / s);
      return (an >= ao && an <= 1.2 * ao) ? Pnew : Pold;
    } catch (e) { return Pold; }
  }

  // contorno do componente i (rotulos CV_32S) -> poligono simplificado na escala original, ou null se for retangulo
  function compPoly(labels, i, x, y, w, h, LW, LH, s) {
    const L = labels.data32S, pad = 2, mw = w + 2 * pad, mh = h + 2 * pad;
    const m = cv.Mat.zeros(mh, mw, cv.CV_8UC1), M = m.data;
    for (let yy = 0; yy < h; yy++) { const o = (y + yy) * LW + x, d = (yy + pad) * mw + pad; for (let xx = 0; xx < w; xx++) if (L[o + xx] === i) M[d + xx] = 255; }
    const cs = new cv.MatVector(), hi = new cv.Mat();
    cv.findContours(m, cs, hi, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE); m.delete(); hi.delete();
    let best = -1, ba = 0; for (let k = 0; k < cs.size(); k++) { const c = cs.get(k), a = cv.contourArea(c); if (a > ba) { ba = a; best = k; } c.delete(); }
    let P = null;
    if (best >= 0) {
      const c = cs.get(best), ap = new cv.Mat(), hull = new cv.Mat();
      cv.convexHull(c, hull, false, true);
      const hullA = cv.contourArea(hull);
      // quadro e (quase) convexo: usa o casco simplificado; forma estranha demais -> fica no retangulo
      if (ba > 0.9 * hullA) {
        cv.approxPolyDP(hull, ap, 0.012 * cv.arcLength(hull, true), true);
        const D = ap.data32S, pts = [];
        for (let k = 0; k < ap.rows; k++) pts.push([D[k * 2] - pad + x, D[k * 2 + 1] - pad + y]);
        if (pts.length >= 3 && pts.length <= 10 && Math.abs(polyArea(pts)) < 0.95 * w * h) {
          // a calha foi dilatada (5x5): devolve ~3px em volta, a partir do centro
          const cx = x + w / 2, cy = y + h / 2, gx = (w + 6) / w, gy = (h + 6) / h;
          P = polyCW(pts.map(([px, py]) => [(cx + (px - cx) * gx) / s, (cy + (py - cy) * gy) / s]));
        }
      }
      c.delete(); ap.delete(); hull.delete();
    }
    cs.delete();
    return P;
  }

  function panelsLines(img) {
    const H = img.rows, W = img.cols, s = 600 / W, hh = trunc(H * s), w = 600;
    const sm = resize(img, 600, hh, cv.INTER_AREA), g = toGray(sm), hsv = toHSV(sm); sm.delete();
    const G = g.data, HS = hsv.data, n = w * hh;
    const gut = cv.Mat.zeros(hh, w, cv.CV_8UC1), GU = gut.data;
    for (const sel of [i => G[i] > 225 && HS[i * 3 + 1] < 40, i => G[i] < 22]) {
      const m = new cv.Mat(hh, w, cv.CV_8UC1), MD = m.data; for (let i = 0; i < n; i++) MD[i] = sel(i) ? 1 : 0;
      const R = cc(m, 8); m.delete();
      const flag = new Uint8Array(R.n);
      for (let i = 1; i < R.n; i++) {
        const ww = R.stats[i * 5 + 2], h2 = R.stats[i * 5 + 3], a = R.stats[i * 5 + 4];
        const long_ = ww > 0.45 * w || h2 > 0.45 * hh, thin = a < 0.35 * ww * h2;
        const frame = (ww > 0.2 * w && h2 > 0.1 * hh) && a < 0.15 * ww * h2;
        if ((long_ && thin) || frame) flag[i] = 1;
      }
      const L = R.labels.data32S; for (let i = 0; i < n; i++) if (flag[L[i]]) GU[i] = 1;
      R.labels.delete();
    }
    hsv.delete();
    { const bl = new cv.Mat(); cv.GaussianBlur(g, bl, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
      const e = new cv.Mat(); cv.Canny(bl, e, 60, 160); bl.delete();
      const ls = new cv.Mat(); cv.HoughLinesP(e, ls, 1, Math.PI / 360, 80, trunc(0.22 * w), 4); e.delete();
      const L = ls.data32S;
      for (let i = 0; i < ls.rows; i++) cv.line(gut, new cv.Point(L[i * 4], L[i * 4 + 1]), new cv.Point(L[i * 4 + 2], L[i * 4 + 3]), new cv.Scalar(1), 2);
      ls.delete(); }
    g.delete();
    let gs = 0; for (let i = 0; i < n; i++) gs += GU[i];
    if (gs / n < 0.01) { gut.delete(); return []; }
    const gd = dilate(gut, 3, 3); gut.delete();
    const inv = new cv.Mat(hh, w, cv.CV_8UC1); { const I = inv.data, U = gd.data; for (let i = 0; i < n; i++) I[i] = 1 - U[i]; }
    gd.delete();
    const R = cc(inv, 4); inv.delete(); R.labels.delete();
    const ps = [];
    for (let i = 1; i < R.n; i++) {
      const x = R.stats[i * 5], y = R.stats[i * 5 + 1], ww = R.stats[i * 5 + 2], h2 = R.stats[i * 5 + 3], a = R.stats[i * 5 + 4];
      if (a > 0.025 * w * hh && ww > 0.15 * w && h2 > 0.05 * hh) ps.push([x / s, y / s, ww / s, h2 / s]);
    }
    if (ps.length < 2) return [];
    return orderRows(ps, { ge: false, sortRows: false, f: q => q[0] + q[2] / 2 });
  }

  function panelsFrames(img) {   // quadros com moldura desenhada por cima de arte (sem calha): linha fina mais escura que a vizinhanca
    const H = img.rows, W = img.cols, s = 700 / W, hh = trunc(H * s), n = 700 * hh;
    const sm = resize(img, 700, hh, cv.INTER_AREA), g = toGray(sm); sm.delete();
    const bh = new cv.Mat(), k7 = cv.Mat.ones(7, 7, cv.CV_8U);
    cv.morphologyEx(g, bh, cv.MORPH_BLACKHAT, k7, new cv.Point(-1, -1), 1, cv.BORDER_REPLICATE, cv.morphologyDefaultBorderValue()); k7.delete();
    const dk = new cv.Mat(hh, 700, cv.CV_8UC1); { const G = g.data, B = bh.data, D = dk.data; for (let i = 0; i < n; i++) D[i] = (B[i] > 25 || G[i] < 30) ? 1 : 0; }
    g.delete(); bh.delete();
    const hk = morph(dk, cv.MORPH_OPEN, 1, 60), vk = morph(dk, cv.MORPH_OPEN, 60, 1); dk.delete();
    const ln = new cv.Mat(); cv.bitwise_or(hk, vk, ln); hk.delete(); vk.delete();
    const gd = dilate(ln, 3, 3); ln.delete();
    const inv = new cv.Mat(hh, 700, cv.CV_8UC1); { const I = inv.data, U = gd.data; for (let i = 0; i < n; i++) I[i] = 1 - U[i]; } gd.delete();
    const R = cc(inv, 4); inv.delete(); R.labels.delete();
    const ps = [];
    for (let i = 1; i < R.n; i++) {
      const x = R.stats[i * 5], y = R.stats[i * 5 + 1], w = R.stats[i * 5 + 2], h = R.stats[i * 5 + 3], a = R.stats[i * 5 + 4];
      if (w > 0.9 * 700 && h > 0.9 * hh) continue;
      if (w > 0.15 * 700 && h > 0.06 * hh && a > 0.03 * 700 * hh && a >= 0.8 * w * h) ps.push([x / s, y / s, w / s, h / s]);
    }
    if (!ps.length || ps.reduce((t, p) => t + p[2] * p[3], 0) < 0.2 * W * H) return [];
    return orderRows(ps, { ge: true, sortRows: true, f: q => q[0] });
  }

  function planPanels(img) { // so a parte de deteccao (modo cobertura nao funde quadros empilhados)
    const H = img.rows, W = img.cols;
    let ps = panelsDark(img), fonte = 'calhas';
    if (!ps.length) {
      ps = panelsLines(img); fonte = 'linhas';
      if (ps.length < 3 || ps.reduce((t, p) => t + p[2] * p[3], 0) < 0.6 * W * H) ps = [];
    }
    if (!ps.length) { ps = panelsFrames(img); fonte = ps.length ? 'molduras' : 'faixas'; }
    return { ps, fonte };
  }

  function nearestPanel(b, ps) {
    let bi = 0, bd = Infinity;
    for (let j = 0; j < ps.length; j++) {
      const p = ps[j], dx = Math.max(p[0] - (b[0] + b[2]), b[0] - (p[0] + p[2]), 0), dy = Math.max(p[1] - (b[1] + b[3]), b[1] - (p[1] + p[3]), 0);
      const d = dx * dx + dy * dy; if (d < bd) { bd = d; bi = j; }
    }
    return bi;
  }

  /* ---------------- calhas escondidas / quadro perdido ---------------- */
  function grayAt700(img) {
    const H = img.rows, W = img.cols, k = 700.0 / W, gh = trunc(H * k);
    const sm = resize(img, 700, gh, cv.INTER_AREA), g = toGray(sm); sm.delete();
    const out = Int16Array.from(g.data); g.delete();
    return { g: out, gw: 700, gh, k };
  }
  function splitGutters(img, ps, G7) {
    const H = img.rows, W = img.cols;
    const { g, gw, gh, k } = G7 || grayAt700(img);
    const bw = Math.max(3, trunc(0.012 * gw)), edge = [];
    for (let y = 0; y < bw; y++) for (let x = 0; x < gw; x++) edge.push(g[y * gw + x]);
    for (let y = gh - bw; y < gh; y++) for (let x = 0; x < gw; x++) edge.push(g[y * gw + x]);
    for (let y = 0; y < gh; y++) for (let x = 0; x < bw; x++) edge.push(g[y * gw + x]);
    for (let y = 0; y < gh; y++) for (let x = gw - bw; x < gw; x++) edge.push(g[y * gw + x]);
    const bg = trunc(median(edge));
    const out = [];
    function rec(r, depth) {
      let x0 = trunc(r[0] * k), y0 = trunc(r[1] * k), x1 = trunc((r[0] + r[2]) * k), y1 = trunc((r[1] + r[3]) * k);
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(gw, x1); y1 = Math.min(gh, y1);
      const rw = x1 - x0, rh = y1 - y0;
      if (depth < 3 && rw > 0 && rh > 0) {
        for (const axis of [0, 1]) {
          const n = axis === 0 ? rh : rw, prof = new Float64Array(n);
          if (axis === 0) { for (let y = 0; y < rh; y++) { let c = 0; for (let x = 0; x < rw; x++) if (Math.abs(g[(y0 + y) * gw + x0 + x] - bg) < 22) c++; prof[y] = c / rw; } }
          else { for (let x = 0; x < rw; x++) { let c = 0; for (let y = 0; y < rh; y++) if (Math.abs(g[(y0 + y) * gw + x0 + x] - bg) < 22) c++; prof[x] = c / rh; } }
          const m = trunc(0.08 * n), good = new Uint8Array(n);
          for (let i = m; i < n - m; i++) good[i] = prof[i] >= 0.82 ? 1 : 0;
          let a = -1; for (let i = 0; i < n; i++) if (good[i]) { a = i; break; }
          if (a >= 0) {
            let b2 = a; while (b2 + 1 < n && good[b2 + 1]) b2++;
            const sub = q => { if (!r.poly) return q; const P = clipRect(r.poly, q); return P.length >= 3 && Math.abs(polyArea(P)) > 0.5 * q[2] * q[3] ? withPoly(polyBox(P), P) : q; };
            if (axis === 0) {
              const top = [r[0], r[1], r[2], a / k], bot = [r[0], r[1] + (b2 + 1) / k, r[2], r[3] - (b2 + 1) / k];
              if (top[3] > 0.06 * H && bot[3] > 0.06 * H) { rec(sub(top), depth + 1); rec(sub(bot), depth + 1); return; }
            } else {
              const lef = [r[0], r[1], a / k, r[3]], rig = [r[0] + (b2 + 1) / k, r[1], r[2] - (b2 + 1) / k, r[3]];
              if (lef[2] > 0.08 * W && rig[2] > 0.08 * W) { rec(sub(lef), depth + 1); rec(sub(rig), depth + 1); return; }
            }
          }
        }
        // calha DIAGONAL: linha reta de borda a borda, toda na cor do fundo, com conteudo dos dois lados
        const dg = diagCut(x0, y0, x1, y1);
        if (dg) {
          const base = r.poly || rectPoly(r), A = [dg[0] / k, dg[1] / k], B = [dg[2] / k, dg[3] / k];
          const P1 = clipHalf(base, A, B, 1), P2 = clipHalf(base, A, B, -1);
          if (P1.length >= 3 && P2.length >= 3) {
            const a1 = Math.abs(polyArea(P1)), a2 = Math.abs(polyArea(P2));
            if (a1 > 0.05 * W * H && a2 > 0.05 * W * H) {
              const q1 = withPoly(polyBox(P1), polyCW(P1)), q2 = withPoly(polyBox(P2), polyCW(P2));
              const first = dg[4] === 0 ? (q1[1] + q1[3] / 2 <= q2[1] + q2[3] / 2) : (q1[0] + q1[2] / 2 <= q2[0] + q2[2] / 2);
              if (first) { rec(q1, depth + 1); rec(q2, depth + 1); } else { rec(q2, depth + 1); rec(q1, depth + 1); }
              return;
            }
          }
        }
      }
      out.push(r);
    }
    const nearBg = (x, y) => { x = x | 0; y = y | 0; if (x < 0 || y < 0 || x >= gw || y >= gh) return false; const v = g[y * gw + x]; return v >= 225 || Math.abs(v - bg) < 22; };
    function lineFrac(ax, ay, bx, by, ox, oy, minF) { // fracao de pixels do fundo ao longo do segmento deslocado (ox,oy)
      const n = Math.max(8, Math.round(Math.hypot(bx - ax, by - ay) / 2)), maxMiss = minF ? (1 - minF) * (n + 1) : Infinity; let c = 0, miss = 0;
      for (let i = 0; i <= n; i++) { const t = i / n; if (nearBg(ax + (bx - ax) * t + ox, ay + (by - ay) * t + oy)) c++; else if (++miss > maxMiss) return 0; }
      return c / (n + 1);
    }
    function diagCut(x0, y0, x1, y1) { // -> [ax,ay,bx,by,eixo] na escala 700, ou null
      const rw = x1 - x0, rh = y1 - y0; if (rw < 60 || rh < 60) return null;
      let best = null;
      for (const axis of [0, 1]) {   // 0: corte "horizontal" inclinado; 1: corte "vertical" inclinado
        const len = axis === 0 ? rh : rw, span = axis === 0 ? rw : rh, m = Math.trunc(0.12 * len), maxd = Math.trunc(0.4 * span);
        for (let u = m; u < len - m; u += 2) for (let d = -maxd; d <= maxd; d += 2) {
          const v = u + d; if (Math.abs(d) < 8 || v < m || v >= len - m) continue;
          const ax = axis === 0 ? x0 : x0 + u, ay = axis === 0 ? y0 + u : y0, bx = axis === 0 ? x1 - 1 : x0 + v, by = axis === 0 ? y0 + v : y1 - 1;
          const ox = axis === 0 ? 0 : 1, oy = axis === 0 ? 1 : 0;
          const c = lineFrac(ax, ay, bx, by, 0, 0, 0.88); if (c < 0.88) continue;
          if (Math.max(lineFrac(ax, ay, bx, by, ox, oy), lineFrac(ax, ay, bx, by, -ox, -oy)) < 0.8) continue;
          // area branca larga (ceu, neve) nao e calha: dos dois lados, a 12px, tem que haver borda/arte
          if (lineFrac(ax, ay, bx, by, 12 * ox, 12 * oy) > 0.55 || lineFrac(ax, ay, bx, by, -12 * ox, -12 * oy) > 0.55) continue;
          const key = c - Math.abs(d) / span * 0.05;
          if (!best || key > best[5]) best = [ax, ay, bx, by, axis, key];
        }
      }
      return best;
    }
    for (const p of ps) rec(p, 0);
    const ar = r => r[2] * r[3], uniq = [];
    for (const r of out.slice().sort((p, q) => ar(q) - ar(p))) {
      const u = uniq.find(u => inter(r, u) >= 0.8 * ar(r));
      if (u) {   // quadro dentro de quadro (inset): fica, se for um quadro de verdade e nao uma copia do maior
        if (u.inner !== undefined || ar(r) > 0.5 * ar(u) || ar(r) < 0.02 * W * H) continue;
        r.inner = u; uniq.push(r); continue;
      }
      uniq.push(r);
    }
    // quadro que o detector perdeu
    const cov0 = new cv.Mat(gh, gw, cv.CV_8UC1), CV0 = cov0.data;
    const covm = new Uint8Array(gw * gh);
    for (const r of uniq) {
      const ya = Math.max(0, trunc(r[1] * k)), yb = Math.min(gh, trunc((r[1] + r[3]) * k) + 1), xa = Math.max(0, trunc(r[0] * k)), xb = Math.min(gw, trunc((r[0] + r[2]) * k) + 1);
      for (let y = ya; y < yb; y++) covm.fill(1, y * gw + xa, y * gw + xb);
    }
    const edgeStd = meanStd(edge)[1], sangra = edgeStd > 30;
    for (let i = 0; i < gw * gh; i++) CV0[i] = ((sangra || Math.abs(g[i] - bg) >= 22) && !covm[i]) ? 1 : 0;
    const ko = sangra ? Math.max(9, trunc(0.075 * gw)) : 9;   // sem fundo uniforme: tira as margens finas em volta das molduras
    let free;
    if (sangra) {   // abertura com borda ZERO: faixa de margem encostada na borda da pagina tambem some
      const kk = cv.Mat.ones(ko, ko, cv.CV_8U), er = new cv.Mat(); free = new cv.Mat();
      cv.erode(cov0, er, kk, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, new cv.Scalar(0));
      cv.dilate(er, free, kk, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, new cv.Scalar(0)); er.delete(); kk.delete();
    } else free = morph(cov0, cv.MORPH_OPEN, ko, ko);
    cov0.delete();
    const R = cc(free, 8); free.delete(); R.labels.delete();
    for (let i = 1; i < R.n; i++) {
      const x = R.stats[i * 5], y = R.stats[i * 5 + 1], w = R.stats[i * 5 + 2], h = R.stats[i * 5 + 3], a = R.stats[i * 5 + 4];
      if (a < (sangra ? 0.04 : 0.015) * gw * gh || w < 0.08 * gw || h < 0.06 * gh || a < 0.45 * w * h) continue;
      const vals = []; let escuro = 0; for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const v = g[yy * gw + xx]; vals.push(v); if (v < 40) escuro++; }
      if (meanStd(vals)[1] < 25) continue;
      if (sangra && escuro > 0.6 * vals.length) continue;   // sobra quase toda preta (silhueta/sombra entre quadros) nao vira parada
      uniq.push([x / k, y / k, w / k, h / k]);
    }
    const top = uniq.filter(r => !r.inner), inners = uniq.filter(r => r.inner);
    let res = [];
    for (const u of xyOrder(top)) {
      const kids = inners.filter(r => r.inner === u).sort((p, q) => (p[1] - q[1]) || (p[0] - q[0]));
      if (!kids.length) { res.push(u); continue; }
      const mid = u[1] + u[3] / 2, before = kids.filter(r => r[1] + r[3] / 2 < mid), after = kids.filter(r => r[1] + r[3] / 2 >= mid);
      res = res.concat(before, [trimResidual(u, kids)], after);
    }
    for (const r of res) delete r.inner;
    return res;
  }
  // ORDEM DE LEITURA por cortes XY (padrao de HQ): faixas de cima para baixo, colunas da esquerda para a direita, recursivo
  function xyOrder(rs) {
    if (rs.length <= 1) return rs.slice();
    for (const axis of [1, 0]) {   // primeiro corte horizontal (faixas), depois vertical (colunas)
      const it = rs.map(r => [r[axis], r[axis] + r[axis + 2], r]).sort((a, b) => a[0] - b[0]);
      const groups = [[it[0]]]; let end = it[0][1];
      for (const e of it.slice(1)) {
        const tol = 0.04 * Math.min(e[1] - e[0], end - groups[groups.length - 1][0][0]);
        if (e[0] >= end - tol) groups.push([e]); else groups[groups.length - 1].push(e);
        end = Math.max(end, e[1]);
      }
      if (groups.length > 1) return [].concat(...groups.map(g => xyOrder(g.map(e => e[2]))));
    }
    // nao da para cortar (quadros encavalados): lado a lado -> pela esquerda; senao -> por cima
    const out = [];
    for (const r of rs.slice().sort((a, b) => (a[1] + a[3] / 2) - (b[1] + b[3] / 2))) {
      let k = out.length;
      while (k > 0) {
        const q = out[k - 1], ov = Math.min(r[1] + r[3], q[1] + q[3]) - Math.max(r[1], q[1]);
        if (ov > 0.5 * Math.min(r[3], q[3]) && r[0] + r[2] / 2 < q[0] + q[2] / 2) k--; else break;
      }
      out.splice(k, 0, r);
    }
    return out;
  }
  // quadro grande com insets: a camera so precisa da parte que sobra (linhas/colunas com >= 50% livre)
  function trimResidual(u, kids) {
    const n = 64, rowF = new Float64Array(n), colF = new Float64Array(n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const px = u[0] + (j + 0.5) * u[2] / n, py = u[1] + (i + 0.5) * u[3] / n;
      if (!kids.some(r => px >= r[0] && px <= r[0] + r[2] && py >= r[1] && py <= r[1] + r[3])) { rowF[i] += 1 / n; colF[j] += 1 / n; }
    }
    let a = 0, b = n - 1, c = 0, d = n - 1;
    while (a < b && rowF[a] < 0.5) a++; while (b > a && rowF[b] < 0.5) b--;
    while (c < d && colF[c] < 0.5) c++; while (d > c && colF[d] < 0.5) d--;
    const r = [u[0] + c * u[2] / n, u[1] + a * u[3] / n, (d - c + 1) * u[2] / n, (b - a + 1) * u[3] / n];
    if (r[2] * r[3] < 0.3 * u[2] * u[3] || r[2] * r[3] > 0.97 * u[2] * u[3]) return u;
    return u.poly ? withPoly(r, clipRect(u.poly, r).length >= 3 ? clipRect(u.poly, r) : null) : r;
  }

  function regionStd(G, W, x, y, w, h) { // desvio padrao de uma regiao do cinza original
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(W, x + w), y1 = Math.min(G.length / W, y + h);
    let s = 0, s2 = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) { const o = yy * W; for (let xx = x0; xx < x1; xx++) { const v = G[o + xx]; s += v; s2 += v * v; n++; } }
    if (!n) return { n: 0, std: 0 };
    const m = s / n; return { n, std: Math.sqrt(Math.max(0, s2 / n - m * m)) };
  }
  function artPieces(img, G7, Gfull) {
    const H = img.rows, W = img.cols; let n = 0;
    for (const p of splitGutters(img, [[0, 0, W, H]], G7)) {
      const [x, y, w, h] = p.map(v => trunc(v)); const r = regionStd(Gfull, W, x, y, w, h);
      if (r.n && r.std > 25 && w * h > 0.08 * W * H) n++;
    }
    return n;
  }

  /* ---------------- plano de camera (modo cobertura) ---------------- */
  function planCover(img, bl, det, G7, Gfull, rtl) {
    const H = img.rows, W = img.cols;
    let ps = det.ps.map(cp), fonte = det.fonte;
    if (fonte !== 'faixas' && ps.length) ps = splitGutters(img, ps, G7);
    if (fonte === 'faixas' || !ps.length) { const m = 0.01 * W; ps = [[m, m, W - 2 * m, H - 2 * m]]; }
    const own = ps.map(() => []);
    for (const b of bl) {
      let k = 0, bestKey = null;
      for (let j = 0; j < ps.length; j++) { const key = [roundHE(inter(b, ps[j]) / (b[2] * b[3]) * 10) / 10, -ps[j][2] * ps[j][3]]; if (bestKey === null || cmpTuple(key, bestKey) > 0) { bestKey = key; k = j; } }
      if (inter(b, ps[k]) === 0) k = nearestPanel(b, ps);
      own[k].push(b);
    }
    const rect = ps.map((p, i) => union([p].concat(own[i].map(b => b.slice(0, 4)))));
    const rows = []; let cur = [0];
    for (let i = 1; i < ps.length; i++) {
      const a = rect[cur[cur.length - 1]], b = rect[i];
      const vo = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])) / Math.max(1, Math.min(a[3], b[3]));
      if (vo > 0.6) cur.push(i); else { rows.push(cur); cur = [i]; }
    }
    rows.push(cur);
    const units = [];
    for (const r of rows) {
      const u = union(r.map(i => rect[i]));
      if (r.length > 1 && u[2] / u[3] <= 1.0 && fitZoom(u, W) >= Z_INTEIRO) units.push([r, u]);
      else for (const i of r) units.push([[i], rect[i]]);
    }
    const cutCount = (win, r, bs) => { const v = clip(win, r); let n = 0; for (const b of bs) { const f = inter(v, b) / (b[2] * b[3]); if (0.03 < f && f < 0.999) n++; } return n; };
    function blank(v) {
      const [x, y, w, h] = v.map(t => roundHE(t));
      if (w < 8 || h < 8) return true;
      const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
      const n = (x1 - x0) * (y1 - y0); if (n <= 0) return true;
      const hist = new Uint32Array(256); let s = 0, s2 = 0;
      for (let yy = y0; yy < y1; yy++) { const o = yy * W; for (let xx = x0; xx < x1; xx++) { const vv = Gfull[o + xx]; hist[vv]++; s += vv; s2 += vv * vv; } }
      const m = s / n, std = Math.sqrt(Math.max(0, s2 / n - m * m));
      // mediana pelo histograma (igual ao numpy para inteiros)
      const medAt = idx => { let c = 0; for (let v = 0; v < 256; v++) { c += hist[v]; if (c > idx) return v; } return 255; };
      const med = n % 2 ? medAt((n - 1) / 2) : (medAt(n / 2 - 1) + medAt(n / 2)) / 2;
      let near = 0; for (let v = 0; v < 256; v++) if (Math.abs(v - med) < 14) near += hist[v];
      return std < 6.0 || near / n > 0.88;
    }
    const PR = [], SRC = [], PP = [], ROWS = {}; let steps = [];
    const visOf = s => clip(s[6] || windowAt(s[0], s[1], s[2], W, H), PR[s[4]]);
    for (const [idxs, r] of units) {
      const bs = [].concat(...idxs.map(i => own[i]));
      const bsAll = bl.filter(b => inter(b, r) > 0);
      PR.push(r); SRC.push(PR.length - 1); const pi = PR.length - 1;
      // recorte da tela: contorno real do quadro (+ baloes dele, que podem vazar) — so se nao for retangulo
      // so o contorno do quadro; se algum balao dele vazar para fora do contorno, fica no retangulo (nao corta balao)
      { const P = idxs.length === 1 ? ps[idxs[0]].poly : null;
        PP.push(P && bs.every(b => { const q = clipConvex(rectPoly(b), P); return q.length >= 3 && Math.abs(polyArea(q)) >= 0.97 * b[2] * b[3]; }) ? P : null); }
      const zf = fitZoom(r, W);
      if (zf >= Z_INTEIRO || (!bs.length && zf >= Z_SEM_BALAO)) {
        if (!bs.length && blank(r)) continue;
        steps.push([r[0] + r[2] / 2, r[1] + r[3] / 2, zf, 'quadro-inteiro', pi, bs.length ? bs.slice().sort((p, q) => p[1] - q[1] || p[0] - q[0]) : null, null]);
        continue;
      }
      const zz = ZT, ww = W / zz, wh = ww / ASP;
      const cols = r[2] <= ww * 1.02 ? 1 : Math.ceil((r[2] - 0.05 * ww) / (0.9 * ww));
      const nrow = r[3] <= wh * 1.02 ? 1 : Math.ceil((r[3] - 0.05 * wh) / (0.9 * wh));
      const centers = (lo, len, win, n) => { if (n === 1) return [lo + len / 2]; const a = lo + win / 2, b = lo + len - win / 2; const o = []; for (let k = 0; k < n; k++) o.push(a + (b - a) * k / (n - 1)); return o; };
      let xs = centers(r[0], r[2], ww, cols); const ys = centers(r[1], r[3], wh, nrow); ROWS[pi] = ys;
      if (rtl) xs = xs.reverse();
      const tiles = [], off = linspace(-0.2, 0.2, 9);
      for (const cy of ys) for (const cx of xs) {
        let best = null;
        for (const dx0 of off) { const dx = dx0 * (cols > 1 ? ww : 0);
          for (const dy0 of off) { const dy = dy0 * (nrow > 1 ? wh : 0);
            const x_ = cols > 1 ? Math.min(Math.max(cx + dx, r[0] + ww / 2), r[0] + r[2] - ww / 2) : cx;
            const y_ = nrow > 1 ? Math.min(Math.max(cy + dy, r[1] + wh / 2), r[1] + r[3] - wh / 2) : cy;
            const win = windowAt(x_, y_, zz, W, H), key = [cutCount(win, r, bsAll), Math.abs(dx) + Math.abs(dy)];
            if (best === null || cmpTuple(key, best[0]) < 0) best = [key, x_, y_, win];
          } }
        tiles.push(best.slice(1));
      }
      const S = 8.0 / Math.max(1.0, W / 100), CW = trunc(W * S) + 2, CH = trunc(H * S) + 2, cov = new Uint8Array(CW * CH), seen = new Set();
      for (const [x_, y_, win] of tiles) {
        const v = clip(win, r);
        if (blank(v)) continue;
        const g = bs.filter(b => inter(v, b) >= 0.999 * b[2] * b[3]);
        const x0 = trunc(v[0] * S), y0 = trunc(v[1] * S), x1 = trunc((v[0] + v[2]) * S), y1 = trunc((v[1] + v[3]) * S);
        const area = Math.max(1, (x1 - x0) * (y1 - y0)); let sum = 0;
        for (let yy = Math.max(0, y0); yy < Math.min(CH, y1); yy++) for (let xx = Math.max(0, x0); xx < Math.min(CW, x1); xx++) sum += cov[yy * CW + xx];
        const novo = 1.0 - sum / area, gnew = g.filter(b => !seen.has(b));
        if (!gnew.length && novo < 0.3) continue;   // sem balao novo: so pula se quase nao mostrar arte nova (nao perde pedaco do quadro)
        for (let yy = Math.max(0, y0); yy < Math.min(CH, y1); yy++) cov.fill(1, yy * CW + Math.max(0, x0), yy * CW + Math.min(CW, x1));
        for (const b of g) seen.add(b);
        steps.push([x_, y_, zz, 'quadro-percurso', pi, g.length ? g.slice().sort((p, q) => p[1] - q[1] || p[0] - q[0]) : null, win]);
      }
      // GARANTIA DE COBERTURA: descartar passo "sem arte nova" e deslocar passo para nao cortar balao podem deixar uma faixa do quadro
      // fora de TODOS os passos. Aqui confere o que sobrou e cobre so arte (nunca fundo liso, nunca o que esta fora do contorno).
      for (let rep = 0; rep < 4; rep++) {
        const gx0 = Math.max(0, trunc(r[0] * S)), gy0 = Math.max(0, trunc(r[1] * S)), gx1 = Math.min(CW, trunc((r[0] + r[2]) * S)), gy1 = Math.min(CH, trunc((r[1] + r[3]) * S));
        if (gx1 <= gx0 || gy1 <= gy0) break;
        const gw = gx1 - gx0, gh = gy1 - gy0, PL = PP[pi];
        const dentro = PL ? (px, py) => { let c = false; for (let a = 0, b = PL.length - 1; a < PL.length; b = a++) { const [xa, ya] = PL[a], [xb, yb] = PL[b]; if ((ya > py) !== (yb > py) && px < (xb - xa) * (py - ya) / (yb - ya) + xa) c = !c; } return c; } : null;
        const I = new Uint32Array((gw + 1) * (gh + 1)); let nT = 0, nU = 0;     // imagem integral das celulas ainda NAO cobertas
        for (let yy = 0; yy < gh; yy++) { let lin = 0; for (let xx = 0; xx < gw; xx++) {
          if (!dentro || dentro((gx0 + xx + 0.5) / S, (gy0 + yy + 0.5) / S)) { nT++; if (!cov[(gy0 + yy) * CW + gx0 + xx]) { lin++; nU++; } }
          I[(yy + 1) * (gw + 1) + xx + 1] = I[yy * (gw + 1) + xx + 1] + lin; } }
        if (!nT || nU / nT < 0.06) break;                 // menos de 6% do quadro fora de qualquer passo: fresta, nao compensa
        const soma = (a0, a1, b0, b1) => { a0 = Math.max(0, a0); b0 = Math.max(0, b0); a1 = Math.min(gw, a1); b1 = Math.min(gh, b1); if (a1 <= a0 || b1 <= b0) return 0; return I[b1 * (gw + 1) + a1] - I[b0 * (gw + 1) + a1] - I[b1 * (gw + 1) + a0] + I[b0 * (gw + 1) + a0]; };
        const pos = (lo, len, win) => { if (len <= win) return [lo + len / 2]; const a = lo + win / 2, b = lo + len - win / 2, o = []; for (let k = 0; k < 9; k++) o.push(a + (b - a) * k / 8); return o; };
        let best = null;
        for (const cy of pos(r[1], r[3], wh)) for (const cx of pos(r[0], r[2], ww)) {
          const win = windowAt(cx, cy, zz, W, H), v = clip(win, r);
          const n = soma(trunc(v[0] * S) - gx0, trunc((v[0] + v[2]) * S) - gx0, trunc(v[1] * S) - gy0, trunc((v[1] + v[3]) * S) - gy0);
          if (!best || n > best[0]) best = [n, cx, cy, win, v];
        }
        const [nB, x_, y_, win, v] = best, vx0 = trunc(v[0] * S), vx1 = trunc((v[0] + v[2]) * S), vy0 = trunc(v[1] * S), vy1 = trunc((v[1] + v[3]) * S);
        if (nB / nT < 0.03) break;                       // o que sobra e fresta: nao compensa um passo a mais
        const fill = () => { for (let yy = Math.max(0, vy0); yy < Math.min(CH, vy1); yy++) cov.fill(1, yy * CW + Math.max(0, vx0), yy * CW + Math.min(CW, vx1)); };
        let ux0 = 1e9, uy0 = 1e9, ux1 = -1, uy1 = -1;    // caixa da arte nova que esse passo mostraria
        for (let yy = Math.max(gy0, vy0); yy < Math.min(gy1, vy1); yy++) for (let xx = Math.max(gx0, vx0); xx < Math.min(gx1, vx1); xx++) {
          if (cov[yy * CW + xx] || (dentro && !dentro((xx + 0.5) / S, (yy + 0.5) / S))) continue;
          if (xx < ux0) ux0 = xx; if (xx > ux1) ux1 = xx; if (yy < uy0) uy0 = yy; if (yy > uy1) uy1 = yy; }
        if (ux1 < 0) break;
        if (blank([ux0 / S, uy0 / S, (ux1 - ux0 + 1) / S, (uy1 - uy0 + 1) / S])) { fill(); continue; }   // so fundo liso: nada a mostrar
        const g = bs.filter(b => inter(v, b) >= 0.999 * b[2] * b[3]);
        steps.push([x_, y_, zz, 'quadro-percurso', pi, g.length ? g.slice().sort((p, q) => p[1] - q[1] || p[0] - q[0]) : null, win]);
        for (const b of g) seen.add(b);
        fill();
      }
      let mine = steps.filter(s => s[4] === pi);
      for (const b of bs) {
        const ok = mine.some(s => inter(clip(s[6] || windowAt(s[0], s[1], s[2], W, H), r), b) >= 0.999 * b[2] * b[3]);
        if (ok) continue;
        const zb = Math.min(zz, fitZoom([b[0] - 0.1 * b[2], b[1] - 0.1 * b[3], 1.2 * b[2], 1.2 * b[3]], W));
        const st = [b[0] + b[2] / 2, b[1] + b[3] / 2, zb, 'balao-garantido', pi, [b], null];
        const k = mine.length ? argmaxBy(steps.length, j => steps[j][4] === pi ? inter(clip(steps[j][6] || windowAt(steps[j][0], steps[j][1], steps[j][2], W, H), r), b) : -1) : steps.length - 1;
        steps.splice(k + 1, 0, st); mine = steps.filter(s => s[4] === pi);
      }
    }
    // limpeza: mesma vista / repetida sem balao novo
    const keep = [], shown = new Set();
    for (const s of steps) {
      const v = visOf(s), novos = (s[5] || []).filter(b => !shown.has(b));
      if (keep.length) {
        const last = keep[keep.length - 1], pv = visOf(last), a = Math.max(1.0, v[2] * v[3]);
        const wv = s[6] || windowAt(s[0], s[1], s[2], W, H), wp = last[6] || windowAt(last[0], last[1], last[2], W, H);
        if (inter(pv, v) >= 0.9 * Math.max(a, pv[2] * pv[3]) || (inter(wv, wp) >= 0.85 * Math.min(wv[2] * wv[3], wp[2] * wp[3]) && inter(pv, v) >= 0.75 * Math.min(a, pv[2] * pv[3]))) {
          const nl = last.slice(), lb = nl[5] || []; const add = (s[5] || []).filter(b => !lb.includes(b));
          nl[5] = lb.concat(add).length ? lb.concat(add) : null; keep[keep.length - 1] = nl;
          for (const b of (s[5] || [])) shown.add(b); continue;
        }
        if (inter(pv, v) >= 0.85 * a && !novos.length) continue;
        if (inter(pv, v) >= 0.85 * Math.max(1.0, pv[2] * pv[3]) && inter(pv, v) >= 0.6 * a && !(last[5] || []).filter(b => inter(v, b) < 0.999 * b[2] * b[3]).length) {
          keep[keep.length - 1] = s; for (const b of (s[5] || [])) shown.add(b); continue;
        }
      }
      keep.push(s); for (const b of (s[5] || [])) shown.add(b);
    }
    steps = keep;
    // garantia final
    const whole = (s, b) => inter(visOf(s), b) >= 0.999 * b[2] * b[3];
    for (const b of bl) {
      if (steps.some(s => whole(s, b))) continue;
      let pi = argmaxBy(PR.length, j => inter(PR[j], b) / (b[2] * b[3]));
      if (inter(PR[pi], b) < 0.999 * b[2] * b[3]) { PR.push(union([PR[pi], b.slice(0, 4)])); SRC.push(SRC[pi]); PP.push(null); pi = PR.length - 1; }
      const zb = Math.min(ZT, fitZoom([b[0] - 0.1 * b[2], b[1] - 0.1 * b[3], 1.2 * b[2], 1.2 * b[3]], W));
      const st = [b[0] + b[2] / 2, b[1] + b[3] / 2, zb, 'balao-garantido', pi, [b], null];
      const cands = []; for (let j = 0; j < steps.length; j++) if (inter(visOf(steps[j]), b) > 0) cands.push(j);
      let k = steps.length - 1;
      if (cands.length) { let bv = -Infinity; for (const j of cands) { const v = inter(visOf(steps[j]), b); if (v > bv) { bv = v; k = j; } } }
      steps.splice(k + 1, 0, st);
    }
    // ORDEM DE LEITURA (trilha): quadro a quadro; dentro do quadro, faixa por faixa de cima para baixo, esquerda->direita
    const band = (W / ZT) / ASP * 0.5;
    // linha do passo dentro do quadro: a linha da grade de passos (ys) mais proxima. Faixas fixas de meia janela juntavam duas linhas
    // quando a grade tem linhas mais coladas que isso (zoom alto / quadro pouco maior que a janela) e a leitura virava coluna por coluna.
    const okey = s => { const u = SRC[s[4]], top = PR[u][1], ys = ROWS[u]; let row;
      if (ys && ys.length > 1) { row = 0; let bd = Infinity; for (let k = 0; k < ys.length; k++) { const d = Math.abs(ys[k] - s[1]); if (d < bd) { bd = d; row = k; } } }
      else row = Math.floor(Math.max(0, s[1] - top) / band);
      return [u, row, rtl ? -s[0] : s[0]]; };
    steps = steps.map((s, i) => [okey(s), i, s]).sort((a, b) => cmpTuple(a[0], b[0]) || a[1] - b[1]).map(x => x[2]);
    return { steps, PR, PP };
  }

  /* ---------------- limpeza final dos passos (v11) ---------------- */
  // remove repetidos, fatias de borda e pedacinhos sem balao; junta pedacos de quadro grande sem texto; mantem a ordem
  function limparPassos(st, W, H, G, bg) {
    if (st.length < 2) return st;
    const A = W * H, near = (a, b, t) => Math.abs(a - b) <= t;
    let r = [];
    for (const s of st) {   // 1) duplicados
      if (r.some(q => near(q.cx, s.cx, 0.01 * W) && near(q.cy, s.cy, 0.01 * H) && near(q.z, s.z, 0.03 * q.z) && q.rect.every((v, i) => near(v, s.rect[i], 0.01 * W)))) {
        const q = r.find(q => near(q.cx, s.cx, 0.01 * W) && near(q.cy, s.cy, 0.01 * H)); q.n = Math.max(q.n, s.n); continue;
      }
      r.push(s);
    }
    const m = 0.03;
    const tiny = s => {
      if (s.n > 0) return false;
      const [x, y, w, h] = s.rect, ar = w * h / A;
      if (ar < 0.035) return true;
      const borda = x < m * W || y < m * H || x + w > (1 - m) * W || y + h > (1 - m) * H;
      return borda && (w < 0.12 * W || h < 0.07 * H);
    };
    const keep = r.filter(s => !tiny(s));          // 2) pedacinhos e fatias
    if (keep.length) r = keep;
    // 2b) falsos cortes dentro de arte continua (sem balao): se a faixa entre dois passos vizinhos nao e calha (cor do fundo), junta
    const stat = (x0, x1, y0, y1) => { x0 = Math.max(0, Math.round(x0)); x1 = Math.min(W, Math.round(x1)); y0 = Math.max(0, Math.round(y0)); y1 = Math.min(H, Math.round(y1)); let n = 0, s1 = 0, s2 = 0; for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x++) { const v = G[y * W + x]; s1 += v; s2 += v * v; n++; } if (!n) return null; const m = s1 / n; return { m, sd: Math.sqrt(Math.max(0, s2 / n - m * m)) }; };
    // calha = faixa uniforme e diferente dos dois lados; arte continua = faixa parecida com os vizinhos e com textura
    const calha = (x0, x1, y0, y1) => {
      const c = stat(x0, x1, y0, y1), l = stat(x0 - 24, x0, y0, y1), rr = stat(x1, x1 + 24, y0, y1);
      if (!c || !l || !rr) return true;
      return c.sd < 6 || Math.abs(c.m - l.m) > 22 || Math.abs(c.m - rr.m) > 22;
    };
    for (let i = 0; i + 1 < r.length;) {
      const a = r[i], b = r[i + 1];
      const ya = Math.max(a.rect[1], b.rect[1]), yb = Math.min(a.rect[1] + a.rect[3], b.rect[1] + b.rect[3]);
      const gap = b.rect[0] - (a.rect[0] + a.rect[2]);
      if (a.n === 0 && b.n === 0 && yb - ya > 0.9 * Math.min(a.rect[3], b.rect[3]) && gap >= -2 && gap < 0.04 * W && !calha(a.rect[0] + a.rect[2], b.rect[0], ya, yb)) {
        const x0 = a.rect[0], y0 = Math.min(a.rect[1], b.rect[1]), x1 = b.rect[0] + b.rect[2], y1 = Math.max(a.rect[1] + a.rect[3], b.rect[1] + b.rect[3]);
        a.rect = [x0, y0, x1 - x0, y1 - y0]; delete a.poly; a.cx = (x0 + x1) / 2; a.cy = (y0 + y1) / 2; a.z = Math.round(Math.max(1.0, fitZoom(a.rect, W)) * 1000) / 1000; r.splice(i + 1, 1);
      } else i++;
    }
    // 3) quadro grande sem texto cortado em varios passos -> um passo so (encaixe do quadro)
    const out = [], done = new Set();
    for (const s of r) {
      const k = s.rect.map(v => Math.round(v / 4)).join(',');
      if (done.has(k)) continue;
      const g = r.filter(q => q.rect.map(v => Math.round(v / 4)).join(',') === k);
      if (g.length > 1 && g.every(q => q.n === 0) && g[0].rect[2] * g[0].rect[3] < 0.9 * A) {
        const [x, y, w, h] = g[0].rect, z = Math.max(1.0, fitZoom([x, y, w, h], W));
        const o = Object.assign({}, g[0], { cx: x + w / 2, cy: y + h / 2, z: Math.round(z * 1000) / 1000 });
        out.push(o); done.add(k);
      } else { out.push(s); }
    }
    return out;
  }

  function halves(W, H, bl) { // pagina dupla: duas metades; a divisa anda para nao cortar balao
    if (W < 1.15 * H) return [[0, W]];
    const mid = W / 2;
    const left = bl.filter(b => b[0] + b[2] / 2 < mid), right = bl.filter(b => b[0] + b[2] / 2 >= mid);
    const a = Math.max(mid, ...left.map(b => b[0] + b[2] + 4)), c = Math.min(mid, ...right.map(b => b[0] - 4));
    return [[0, Math.min(W, a)], [Math.max(0, c), W]];
  }

  /* ---------------- pagina inteira -> paradas (regras do export_steps.py) ---------------- */
  // Ordem de leitura por relacao "A vem antes de B" (mais robusta que cortes em faixas quando os quadros se encavalam):
  //  - bem acima -> vem antes;  - lado a lado -> o da esquerda (ou da direita em mangá);  - encavalados -> o de cima, senao o da esquerda.
  // Os passos de um mesmo quadro ficam juntos e na ordem que ja tinham.
  function reordenarPassos(steps, W, H, rtl) {
    const grupos = []; let ult = null;
    for (const s of steps) { const k = s.rect.map(v => Math.round(v)).join(','); if (ult === k) grupos[grupos.length - 1].st.push(s); else { grupos.push({ r: s.rect, st: [s] }); ult = k; } }
    if (grupos.length < 3) return steps;
    if (grupos.some(g => g.r[2] > 0.92 * W && g.r[3] > 0.92 * H)) return steps;   // quadro unico do tamanho da pagina: nao mexe
    const ov = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
    // -1: a antes de b; 1: b antes de a; 0: indiferente
    const rel = (A, B) => {
      const a = A.r, b = B.r, ha = a[3], hb = b[3], wa = a[2], wb = b[2];
      const vo = ov(a[1], a[1] + ha, b[1], b[1] + hb) / Math.max(1, Math.min(ha, hb));
      const ca = a[0] + wa / 2, cb = b[0] + wb / 2;
      if (vo <= 0.25) return (a[1] + ha / 2) < (b[1] + hb / 2) ? -1 : 1;
      const ho = ov(a[0], a[0] + wa, b[0], b[0] + wb) / Math.max(1, Math.min(wa, wb));
      if (ho <= 0.25) return (ca < cb) !== rtl ? -1 : 1;
      const dt = a[1] - b[1], lim = 0.2 * Math.min(ha, hb);
      if (Math.abs(dt) > lim) return dt < 0 ? -1 : 1;
      return (ca < cb) !== rtl ? -1 : 1;
    };
    const rest = grupos.slice(), out = [];
    while (rest.length) {
      let pick = -1;
      const livres = [];
      for (let i = 0; i < rest.length; i++) { let bloq = false; for (let j = 0; j < rest.length && !bloq; j++) if (j !== i && rel(rest[j], rest[i]) < 0 && rel(rest[i], rest[j]) > 0) bloq = true; if (!bloq) livres.push(i); }
      const cand = livres.length ? livres : rest.map((_, i) => i);
      for (const i of cand) if (pick < 0 || rest[i].r[1] < rest[pick].r[1] - 1e-6 || (Math.abs(rest[i].r[1] - rest[pick].r[1]) < 1e-6 && (rest[i].r[0] < rest[pick].r[0]) !== rtl)) pick = i;
      out.push(...rest[pick].st); rest.splice(pick, 1);
    }
    return out;
  }
  function analyze(cvLib, img, opts) {
    cv = cvLib; opts = opts || {}; setZoom(opts.zoom || 2.3);
    const H = img.rows, W = img.cols, P = img.data;
    const bw = Math.max(4, trunc(0.012 * Math.min(W, H)));
    const ch = [[], [], []];
    const addPx = (x, y) => { const p = (y * W + x) * 3; ch[0].push(P[p]); ch[1].push(P[p + 1]); ch[2].push(P[p + 2]); };
    for (let y = 0; y < bw; y++) for (let x = 0; x < W; x++) addPx(x, y);
    for (let y = H - bw; y < H; y++) for (let x = 0; x < W; x++) addPx(x, y);
    for (let y = 0; y < H; y++) for (let x = 0; x < bw; x++) addPx(x, y);
    for (let y = 0; y < H; y++) for (let x = W - bw; x < W; x++) addPx(x, y);
    const bg = [trunc(median(ch[2])), trunc(median(ch[1])), trunc(median(ch[0]))]; // RGB
    const bl = detectBalloons(img);
    const det = planPanels(img);
    let semQuadros = det.fonte === 'faixas' || (det.ps.length <= 1 && det.fonte !== 'molduras');
    const G7 = grayAt700(img);
    const gm = toGray(img), Gfull = Uint8Array.from(gm.data); gm.delete();
    const multi = artPieces(img, G7, Gfull) >= 2;
    if (semQuadros && multi) semQuadros = false;
    const areaTxt = bl.reduce((t, b) => t + b[2] * b[3], 0) / (W * H);
    const full = { cx: W / 2, cy: H / 2, z: 1.0, rect: [0, 0, W, H], n: 0 };
    if (bl.length && semQuadros && areaTxt < 0.03 && bl.length <= 5) {
      const sts = [Object.assign({}, full)];
      const sorted = bl.slice().sort((a, b) => (roundHE(a[1] / (0.06 * H)) - roundHE(b[1] / (0.06 * H))) || (a[0] - b[0]));
      for (const b of sorted) {
        const z = Math.min(ZT, fitZoom([b[0] - 0.15 * b[2], b[1] - 0.3 * b[3], 1.3 * b[2], 1.6 * b[3]], W));
        sts.push({ cx: b[0] + b[2] / 2, cy: b[1] + b[3] / 2, z: Math.round(Math.max(1.0, z) * 1000) / 1000, rect: [0, 0, W, H], n: 1 });
      }
      sts.push(Object.assign({}, full));
      return { w: W, h: H, bg, guiado: true, tipo: 'imagem-com-texto', steps: sts, baloes: bl };
    }
    // pagina sem texto: so fica inteira se tambem nao tiver quadros (quadros sem balao tambem sao lidos um a um)
    if (!bl.length && !multi && semQuadros) return { w: W, h: H, bg, guiado: false, steps: [full], baloes: bl };
    const out = [];
    for (const [x0, x1] of halves(W, H, bl)) {   // pagina DUPLA: le a pagina da esquerda inteira e depois a da direita
      const X0 = trunc(x0), X1 = trunc(x1), Wc = X1 - X0;
      const whole = X0 === 0 && X1 === W;
      const sub = whole ? img : img.roi(new cv.Rect(X0, 0, Wc, H)).clone();
      const bsub = bl.filter(b => x0 <= b[0] + b[2] / 2 && b[0] + b[2] / 2 < x1).map(b => [b[0] - X0, b[1], b[2], b[3]]);
      let Gs = Gfull;
      if (!whole) { const gm2 = toGray(sub); Gs = Uint8Array.from(gm2.data); gm2.delete(); }
      const { steps, PR, PP } = planCover(sub, bsub, whole ? det : planPanels(sub), whole ? G7 : grayAt700(sub), Gs, !!opts.rtl);
      if (!whole) sub.delete();
      for (const st of steps) {
        const zf = Number(st[2] || 2.0); let rect;
        if (st[4] !== null && st[4] >= 0 && st[4] < PR.length) { const r = PR[st[4]], m = 0.004 * Wc; rect = [r[0] - m, r[1] - m, r[2] + 2 * m, r[3] + 2 * m]; }
        else if (st[6]) rect = st[6].slice(); else rect = [0, 0, Wc, H];
        rect[0] += X0;
        const o = { cx: Math.round((st[0] + X0) * 10) / 10, cy: Math.round(st[1] * 10) / 10, z: Math.round(zf * W / Wc * 1000) / 1000, rect: rect.map(v => Math.round(v * 10) / 10), n: (st[5] || []).length };
        const pp = st[4] !== null && st[4] >= 0 ? PP[st[4]] : null;
        if (pp) o.poly = polyCW(pp).map(([x, y]) => [Math.round((x + X0) * 10) / 10, Math.round(y * 10) / 10]);
        out.push(o);
      }
    }
    let lim = limparPassos(out, W, H, Gfull, bg);
    if (!lim.length) out.length || out.push(full);
    if (lim.length > 2 && halves(W, H, bl).length === 1 && !opts.semReordem) lim = reordenarPassos(lim, W, H, !!opts.rtl);
    return { w: W, h: H, bg, guiado: true, steps: lim.length ? lim : (out.length ? out : [full]), baloes: bl };
  }

  root.HQ = { analyze, detectBalloons: (c, img) => { cv = c; return detectBalloons(img); }, planPanels: (c, img) => { cv = c; return planPanels(img); }, ASP };
})(typeof self !== 'undefined' ? self : globalThis);
