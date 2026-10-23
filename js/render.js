/* 1-bit dither renderer + procedural drawing primitives.
 * Everything is drawn in grayscale on an offscreen canvas, then
 * thresholded through an 8x8 Bayer matrix into two palette colors. */
(function (global) {
  'use strict';

  const BAYER8 = [
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21,
  ];

  const PALETTES = {
    parchment: { name: '羊皮紙', dark: [38, 33, 26], light: [232, 222, 196] },
    mac: { name: 'マッキントッシュ', dark: [51, 51, 25], light: [229, 255, 255] },
    amber: { name: '琥珀', dark: [30, 16, 4], light: [255, 176, 64] },
    sea: { name: '深海', dark: [12, 24, 36], light: [150, 220, 210] },
  };

  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const gray = (v, a) => {
    const c = Math.round(clamp(v, 0, 1) * 255);
    return a === undefined ? `rgb(${c},${c},${c})` : `rgba(${c},${c},${c},${a})`;
  };

  // Deterministic PRNG so scenes render identically every time.
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return (s >>> 0) / 4294967296;
    };
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function dither(canvas, palette, contrast) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const k = contrast || 1.15;
    const [dr, dg, db] = palette.dark;
    const [lr, lg, lb] = palette.light;
    for (let y = 0; y < h; y++) {
      const row = (y & 7) * 8;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let v = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
        v = (v - 0.5) * k + 0.5;
        const t = (BAYER8[row + (x & 7)] + 0.5) / 64;
        if (v > t) { d[i] = lr; d[i + 1] = lg; d[i + 2] = lb; }
        else { d[i] = dr; d[i + 1] = dg; d[i + 2] = db; }
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  /* ---------- basic shape helpers ---------- */
  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill !== null && fill !== undefined) { ctx.fillStyle = typeof fill === 'number' ? gray(fill) : fill; ctx.fill(); }
    if (stroke !== null && stroke !== undefined) { ctx.strokeStyle = typeof stroke === 'number' ? gray(stroke) : stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function rect(ctx, x, y, w, h, fill, stroke, lw) {
    poly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, stroke, lw);
  }
  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    if (fill !== null && fill !== undefined) { ctx.fillStyle = typeof fill === 'number' ? gray(fill) : fill; ctx.fill(); }
    if (stroke !== null && stroke !== undefined) { ctx.strokeStyle = typeof stroke === 'number' ? gray(stroke) : stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function line(ctx, pts, tone, lw, cap) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = typeof tone === 'number' ? gray(tone) : tone;
    ctx.lineWidth = lw || 1;
    ctx.lineCap = cap || 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  function curve(ctx, x0, y0, cx, cy, x1, y1, tone, lw) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.strokeStyle = gray(tone);
    ctx.lineWidth = lw || 1;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  function vgrad(ctx, x, y, w, h, stops) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    stops.forEach(([p, v]) => g.addColorStop(p, gray(v)));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  // Additive light: brightens everything in a radius (lantern, window, flash).
  function glow(ctx, x, y, r, strength) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, gray(1, strength));
    g.addColorStop(0.35, gray(1, strength * 0.45));
    g.addColorStop(1, gray(1, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  // Multiplicative shadow (vignette / darkness).
  function shade(ctx, x, y, r, strength, w, h) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, gray(0, 0));
    g.addColorStop(1, gray(0, strength));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  function planks(ctx, x, y, w, h, step, tone, vertical, seed) {
    const r = rng(seed || 7);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (vertical) {
      for (let px = x; px < x + w; px += step) {
        line(ctx, [[px, y], [px, y + h]], tone, 1);
        const k = y + r() * h;
        line(ctx, [[px, k], [px + step, k]], tone, 1);
      }
    } else {
      for (let py = y; py < y + h; py += step) {
        line(ctx, [[x, py], [x + w, py]], tone, 1);
        for (let n = 0; n < 3; n++) {
          const k = x + r() * w;
          line(ctx, [[k, py], [k, py + step]], tone, 1);
        }
      }
    }
    ctx.restore();
  }
  function blood(ctx, x, y, r, seed) {
    const rr = rng(seed || 3);
    for (let i = 0; i < 9; i++) {
      const a = rr() * Math.PI * 2, d = rr() * r;
      circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.45, 1 + rr() * r * 0.35, 0.05);
    }
  }
  // Frozen droplets suspended in the air.
  function droplets(ctx, x, y, dx, dy, n, seed, tone) {
    const rr = rng(seed || 5);
    for (let i = 0; i < n; i++) {
      const t = rr();
      circle(ctx, x + dx * t + (rr() - 0.5) * 6, y + dy * t + (rr() - 0.5) * 6, 0.6 + rr() * 1.1, tone === undefined ? 0.04 : tone);
    }
  }

  /* ---------- items (drawn pointing along +y from the grip) ---------- */
  const ITEMS = {
    pistol(ctx) {
      poly(ctx, [[-1.5, -1], [1.5, -1], [1.5, 3], [-1.5, 3]], 0.15, 0.02, 0.6);
      poly(ctx, [[-1.2, 2], [1.2, 2], [1.0, 13], [-1.0, 13]], 0.25, 0.02, 0.6);
    },
    knife(ctx) {
      rect(ctx, -1.2, -1, 2.4, 4, 0.15);
      poly(ctx, [[-1.3, 3], [1.3, 3], [0.4, 12], [-0.3, 11]], 0.95, 0.1, 0.5);
    },
    sword(ctx) {
      rect(ctx, -1, -2, 2, 4, 0.15);
      line(ctx, [[-3.5, 2], [3.5, 2]], 0.2, 1.4);
      poly(ctx, [[-1.1, 2.5], [1.1, 2.5], [0.6, 30], [0, 32], [-0.6, 30]], 0.97, 0.15, 0.5);
    },
    cutlass(ctx) {
      rect(ctx, -1, -2, 2, 4, 0.15);
      ctx.beginPath(); ctx.arc(0, 1, 3.4, Math.PI * 0.1, Math.PI * 0.9, true); ctx.strokeStyle = gray(0.2); ctx.lineWidth = 1; ctx.stroke();
      poly(ctx, [[-1.3, 2.5], [1.6, 2.5], [2.8, 18], [1.5, 26], [-0.5, 18]], 0.97, 0.15, 0.5);
    },
    lantern(ctx) {
      line(ctx, [[0, 0], [0, 3]], 0.1, 0.8);
      rect(ctx, -3, 3, 6, 8, 0.98, 0.1, 1);
      line(ctx, [[0, 3], [0, 11]], 0.2, 0.6);
      rect(ctx, -3.5, 10.5, 7, 1.5, 0.15);
    },
    cup(ctx) { poly(ctx, [[-2, 0], [2, 0], [1.6, 4], [-1.6, 4]], 0.85, 0.1, 0.6); },
    glass(ctx) {
      poly(ctx, [[-2, -3], [2, -3], [0.4, 1], [-0.4, 1]], 0.9, 0.1, 0.5);
      line(ctx, [[0, 1], [0, 4]], 0.2, 0.6); line(ctx, [[-1.5, 4], [1.5, 4]], 0.2, 0.6);
    },
    bucket(ctx) {
      curve(ctx, -4, 6, 0, -2, 4, 6, 0.1, 0.8);
      poly(ctx, [[-4.5, 5], [4.5, 5], [3.5, 13], [-3.5, 13]], 0.55, 0.05, 1);
    },
    bottle(ctx) {
      rect(ctx, -0.8, -3, 1.6, 4, 0.2);
      poly(ctx, [[-2, 1], [2, 1], [2, 11], [-2, 11]], 0.2, 0.05, 0.6);
      line(ctx, [[0.8, 2], [0.8, 9]], 0.7, 0.6);
    },
    vial(ctx) { rect(ctx, -1, 0, 2, 5, 0.9, 0.1, 0.5); rect(ctx, -0.8, -1, 1.6, 1, 0.3); },
    keys(ctx) {
      circle(ctx, 0, 2, 2.2, null, 0.85, 1);
      line(ctx, [[0, 4], [-0.5, 9]], 0.9, 0.8); line(ctx, [[0.5, 4], [1.6, 8.5]], 0.9, 0.8);
    },
    rope(ctx) { curve(ctx, 0, 0, 6, 8, 0, 16, 0.6, 1.4); },
    pin(ctx) { poly(ctx, [[-1.2, -2], [1.2, -2], [2, 12], [-2, 12]], 0.45, 0.05, 0.6); },
    tray(ctx) { line(ctx, [[-6, 0], [6, 0]], 0.75, 1.5); },
    bag(ctx) { poly(ctx, [[-4, 0], [4, 0], [5, 8], [-5, 8]], 0.18, 0.02, 0.6); curve(ctx, -2, 0, 0, -3, 2, 0, 0.1, 0.8); },
  };

  /* ---------- people ---------- */
  const DEF_POSE = { lean: 0, head: 0, ra: [8, -12], la: [-8, -10], rl: [4, 0], ll: [-5, 0] };
  const L = { torso: 19, upper: 9.5, fore: 9, thigh: 12.5, shin: 12.5, headR: 5.4 };
  const dir = (a, len) => [Math.sin(a * D2R) * len, Math.cos(a * D2R) * len];

  function joints(p) {
    const lean = p.lean || 0;
    const [nx, ny] = dir(180 - lean, L.torso); // neck relative to hip
    const neck = [nx, ny];
    const sh = [nx * 0.9, ny * 0.9];
    const headC = (() => { const [hx, hy] = dir(180 - lean - (p.head || 0), L.headR + 1.5); return [neck[0] + hx, neck[1] + hy]; })();
    const arm = (a) => {
      const e = dir(a[0] + lean, L.upper);
      const elbow = [sh[0] + e[0], sh[1] + e[1]];
      const h = dir(a[0] + a[1] + lean, L.fore);
      return { elbow, hand: [elbow[0] + h[0], elbow[1] + h[1]], foreA: a[0] + a[1] + lean };
    };
    const leg = (a) => {
      const k = dir(a[0], L.thigh);
      const f = dir(a[0] + a[1], L.shin);
      return { knee: k, foot: [k[0] + f[0], k[1] + f[1]], shinA: a[0] + a[1] };
    };
    return { neck, sh, headC, ra: arm(p.ra), la: arm(p.la), rl: leg(p.rl), ll: leg(p.ll), lean };
  }

  function limb(ctx, pts, w, tone, ol) {
    line(ctx, pts, ol, w + 2.2);
    line(ctx, pts, tone, w);
  }

  function drawFoot(ctx, knee, foot, tone, ol, shinA) {
    ctx.save();
    ctx.translate(foot[0], foot[1]);
    ctx.rotate(-shinA * D2R);
    poly(ctx, [[-1.8, -1], [5, -0.5], [5, 2], [-2, 2]], tone, ol, 1);
    ctx.restore();
  }

  function drawHead(ctx, c, look, T, deadEyes) {
    const [x, y] = c;
    const r = L.headR;
    const skin = T(look.skin === undefined ? 0.78 : look.skin);
    const ol = T(0.04, true);
    // hair behind head
    if (look.hair === 'shaggy') poly(ctx, [[x - 6, y - 3], [x + 2, y - 6.5], [x + 5, y - 3], [x - 2, y + 2], [x - 6.5, y + 5]], T(0.12), ol, 1);
    if (look.hair === 'curly') circle(ctx, x - 1.5, y - 1.5, r + 1, T(0.1), ol, 1);
    if (look.hair === 'chonmage') poly(ctx, [[x - 6, y - 1], [x - 3, y - 5], [x - 5.5, y + 4]], T(0.08), ol, 1);
    circle(ctx, x, y, r, skin, ol, 1);
    // nose
    poly(ctx, [[x + r - 0.8, y - 1.2], [x + r + 1.6, y + 1], [x + r - 0.4, y + 1.5]], skin, ol, 0.8);
    // eye
    if (deadEyes) { line(ctx, [[x + 1.6, y - 1.6], [x + 3.4, y]], T(0.04, true), 0.8); line(ctx, [[x + 3.4, y - 1.6], [x + 1.6, y]], T(0.04, true), 0.8); }
    else circle(ctx, x + 2.6, y - 0.8, 0.8, T(0.02, true));
    // ear
    circle(ctx, x - 1, y, 1.2, skin, ol, 0.7);

    switch (look.hair) {
      case 'bald': poly(ctx, [[x - 5.2, y - 1], [x - 2, y - 2], [x - 1, y + 2.5], [x - 4.5, y + 3]], T(0.65), null); break;
      case 'messy': poly(ctx, [[x - 6, y - 1], [x - 4, y - 6], [x, y - 6.8], [x + 4, y - 5], [x + 5.5, y - 2.5], [x + 2, y - 3.5], [x - 1, y - 3], [x - 3, y + 1]], T(0.55), ol, 0.8); break;
      case 'dark': poly(ctx, [[x - 5.5, y], [x - 4, y - 5], [x + 1, y - 6], [x + 5, y - 3], [x + 1, y - 3.5], [x - 2, y + 2]], T(0.12), ol, 0.8); break;
      case 'shaggy': poly(ctx, [[x - 5, y - 2], [x - 2, y - 6.5], [x + 3, y - 5.6], [x + 5.6, y - 2], [x + 2, y - 4], [x - 1, y + 2]], T(0.12), ol, 0.8); break;
      case 'curly': for (let i = 0; i < 5; i++) circle(ctx, x - 4 + i * 2, y - 4.5 - (i % 2), 1.8, T(0.1)); break;
      case 'chonmage':
        poly(ctx, [[x - 5.4, y - 0.5], [x - 5, y - 3.2], [x - 3, y - 2.8], [x - 2, y + 1.5]], T(0.08), null);
        line(ctx, [[x - 2.5, y - 5.5], [x + 3.2, y - 6.6]], T(0.08), 1.8);
        break;
    }
    // facial hair
    if (look.beard === 'full') poly(ctx, [[x - 1.5, y + 0.5], [x + 5.6, y + 1.4], [x + 4.5, y + 5.5], [x + 1, y + 7.5], [x - 2.5, y + 4.5]], T(0.12), ol, 0.8);
    if (look.beard === 'short') poly(ctx, [[x - 1, y + 2], [x + 5, y + 2.5], [x + 3.5, y + 5.4], [x - 0.5, y + 5]], T(0.55), ol, 0.6);
    if (look.beard === 'sideburns') poly(ctx, [[x - 2.2, y - 2], [x + 0.2, y - 2], [x + 1.2, y + 4.2], [x - 1.8, y + 3.8]], T(0.25), null);
    if (look.mustache) line(ctx, [[x + 2.6, y + 2.2], [x + 5.8, y + 2.0]], T(0.08), 1.4);
    if (look.glasses) { circle(ctx, x + 3, y - 0.8, 1.7, null, T(0.04, true), 0.8); line(ctx, [[x + 1.3, y - 1], [x - 1, y - 1.5]], T(0.04, true), 0.6); }
    if (look.eyepatch) {
      line(ctx, [[x - 4.8, y - 3.5], [x + 4.6, y + 0.5]], T(0.04, true), 0.8);
      circle(ctx, x + 2.7, y - 0.8, 1.8, T(0.04, true));
    }
    // hats
    switch (look.hat) {
      case 'bicorne':
        poly(ctx, [[x - 8, y - 2.5], [x - 5, y - 9], [x, y - 11.5], [x + 5, y - 9], [x + 8, y - 2.5], [x, y - 5]], T(0.1), ol, 1);
        circle(ctx, x + 0.5, y - 7.5, 1.1, T(0.85));
        break;
      case 'peaked':
        poly(ctx, [[x - 5.5, y - 3], [x - 5, y - 8], [x + 4.5, y - 8], [x + 5, y - 3.5]], T(0.15), ol, 1);
        line(ctx, [[x - 5.5, y - 5.5], [x + 5, y - 5.5]], T(0.85), 0.8);
        poly(ctx, [[x + 3.5, y - 3.8], [x + 9, y - 2.8], [x + 4, y - 2.4]], T(0.05), null);
        break;
      case 'knit':
        poly(ctx, [[x - 5.6, y - 1.5], [x - 5, y - 6], [x - 1, y - 9.5], [x + 3, y - 8], [x + 5.6, y - 3], [x + 5.6, y - 1.5]], T(0.35), ol, 1);
        line(ctx, [[x - 5.6, y - 2.8], [x + 5.6, y - 2.8]], T(0.6), 1.2);
        break;
      case 'flat':
        poly(ctx, [[x - 6, y - 3], [x - 4, y - 7.5], [x + 4, y - 7], [x + 6, y - 4], [x + 8, y - 3.2], [x + 5, y - 2.6]], T(0.3), ol, 1);
        break;
      case 'bandana':
        poly(ctx, [[x - 5.5, y - 1.5], [x - 4.5, y - 6], [x + 1, y - 7], [x + 5.5, y - 3], [x + 5.5, y - 2]], T(0.92), ol, 1);
        poly(ctx, [[x - 5, y - 3], [x - 9, y + 1], [x - 7.5, y + 2.5], [x - 4.6, y - 1]], T(0.92), ol, 0.8);
        for (let i = 0; i < 3; i++) circle(ctx, x - 2 + i * 2.8, y - 4.4, 0.6, T(0.2));
        break;
    }
  }

  /* Draw a person. Returns world bounding box {x,y,w,h} for hit testing.
   * o: { x, ground | hip:[x,y], s, f (facing 1/-1), rot (deg), pose, look, items:{r,l}, shade, dead } */
  function person(ctx, o) {
    const s = o.s || 1;
    const f = o.f || 1;
    const rot = (o.rot || 0) * D2R;
    const p = Object.assign({}, DEF_POSE, o.pose || {});
    const look = o.look || {};
    const sh = o.shade === undefined ? 1 : o.shade;
    // T: apply scene light to a tone; outlines (keep=true) stay dark.
    const T = (v, keep) => (keep ? v : clamp(v * sh, 0, 1));
    const J = joints(p);
    const ol = 0.03;

    let hip;
    if (o.hip) hip = o.hip;
    else {
      const maxY = Math.max(J.rl.foot[1], J.ll.foot[1], look.robe ? 23 : 0) + 2;
      hip = [o.x, o.ground - maxY * s];
    }

    ctx.save();
    ctx.translate(hip[0], hip[1]);
    ctx.scale(f * s, s);
    ctx.rotate(rot);

    const coat = look.coat !== undefined ? look.coat : null;
    const shirt = T(look.shirt === undefined ? 0.8 : look.shirt);
    const sleeve = T(coat !== null ? coat : look.sleeve !== undefined ? look.sleeve : look.shirt === undefined ? 0.8 : look.shirt);
    const pants = T(look.pants === undefined ? 0.45 : look.pants);
    const skin = T(look.skin === undefined ? 0.78 : look.skin);
    const robe = look.robe !== undefined ? T(look.robe) : null;
    const armW = robe !== null ? 5.5 : 4.2;

    const drawArm = (a, side) => {
      limb(ctx, [J.sh, a.elbow, a.hand], armW, robe !== null ? robe : sleeve, ol);
      circle(ctx, a.hand[0], a.hand[1], 1.9, skin, ol, 0.8);
      const it = o.items && o.items[side];
      if (it && ITEMS[it]) {
        ctx.save();
        ctx.translate(a.hand[0], a.hand[1]);
        ctx.rotate(-a.foreA * D2R);
        ITEMS[it](ctx);
        ctx.restore();
      }
    };
    const drawLeg = (g) => {
      limb(ctx, [[0, 0], g.knee, g.foot], 5.4, pants, ol);
      drawFoot(ctx, g.knee, g.foot, T(0.08), ol, g.shinA);
    };

    // back limbs
    drawArm(J.la, 'l');
    drawLeg(J.ll);

    // coat tails behind the body
    if (coat !== null && look.longCoat) {
      ctx.save();
      ctx.rotate(-J.lean * D2R * 0.5);
      poly(ctx, [[-5.5, -10], [3, -10], [4, 14], [-9, 15]], T(coat), ol, 1);
      ctx.restore();
    }
    drawLeg(J.rl);

    // torso
    ctx.save();
    ctx.rotate(J.lean * D2R);
    const torsoTone = coat !== null ? T(coat) : look.vest !== undefined ? T(look.vest) : shirt;
    poly(ctx, [[-5, 1], [5, 1], [6, -L.torso + 2], [-5, -L.torso + 1]], torsoTone, ol, 1);
    if (coat !== null) {
      poly(ctx, [[2.5, -L.torso + 2], [6, -L.torso + 2], [5.6, -5], [3, -4]], shirt, null);
      for (let i = 0; i < 3; i++) circle(ctx, 4.6, -L.torso + 6 + i * 4, 0.7, T(0.9));
    }
    if (look.vest !== undefined && coat === null) {
      poly(ctx, [[3.5, -L.torso + 2], [6, -L.torso + 2], [6, -L.torso + 7]], shirt, null);
    }
    if (look.stripes) for (let i = 0; i < 4; i++) line(ctx, [[-4.6, -3 - i * 4], [5.4, -3 - i * 4]], T(0.25), 1.2);
    if (look.apron) poly(ctx, [[1, -L.torso + 5], [6.5, -L.torso + 5], [7.5, 13], [0, 13]], T(0.95), ol, 1);
    if (look.scarf) poly(ctx, [[-4, -L.torso + 1], [6, -L.torso + 1], [6, -L.torso + 4], [-4, -L.torso + 4]], T(0.3), ol, 0.8);
    if (look.belt !== false && robe === null && !look.apron) line(ctx, [[-5, -1], [5.5, -1]], T(0.1), 1.6);
    if (look.whistle) { line(ctx, [[2, -L.torso + 2], [5, -9]], T(0.9), 0.6); rect(ctx, 4, -9.5, 2.6, 1.4, T(0.95)); }
    ctx.restore();

    if (robe !== null) {
      poly(ctx, [[-6, -2], [6.5, -2], [8, 23], [-8, 23]], robe, ol, 1);
      line(ctx, [[0, -2], [3.5, 23]], T(0.15), 0.8);
      line(ctx, [[-6, 0], [6.5, 0]], T(0.2), 2.4);
    }

    drawHead(ctx, J.headC, look, T, o.dead);
    drawArm(J.ra, 'r');
    ctx.restore();

    // world-space bounding box from joints
    const pts = [[0, 0], J.headC, J.neck, J.ra.hand, J.la.hand, J.rl.foot, J.ll.foot, J.ra.elbow, J.la.elbow, J.rl.knee, J.ll.knee];
    const cr = Math.cos(rot), sr = Math.sin(rot);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach(([px, py]) => {
      const rx = px * cr - py * sr, ry = px * sr + py * cr;
      const wx = hip[0] + rx * f * s, wy = hip[1] + ry * s;
      x0 = Math.min(x0, wx); y0 = Math.min(y0, wy); x1 = Math.max(x1, wx); y1 = Math.max(y1, wy);
    });
    const pad = 7 * s;
    const W = ([px, py]) => {
      const rx = px * cr - py * sr, ry = px * sr + py * cr;
      return [hip[0] + rx * f * s, hip[1] + ry * s];
    };
    return {
      x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2,
      rh: W(J.ra.hand), lh: W(J.la.hand), head: W(J.headC), neck: W(J.neck), hip: hip.slice(),
    };
  }

  global.R = {
    PALETTES, D2R, clamp, gray, rng, makeCanvas, dither,
    poly, rect, circle, line, curve, vgrad, glow, shade, planks, blood, droplets,
    person, ITEMS,
  };
})(window);
