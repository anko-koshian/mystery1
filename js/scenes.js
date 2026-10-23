/* Scene art: backgrounds and the frozen moment of each chapter. */
(function (global) {
  'use strict';
  const { poly, rect, circle, line, curve, vgrad, glow, shade, planks, blood, droplets, person, rng, ITEMS, D2R } = R;

  const W = 760, H = 300;
  const K = 1.6; // base figure scale
  const RES = 2; // internal pixels per world unit

  function figFactory(ctx, hits) {
    return function fig(no, o) {
      const F = DATA.FIGURES[no - 1];
      const box = person(ctx, Object.assign({}, o, {
        s: (o.s || 1) * F.s * K,
        look: Object.assign({}, F.look, o.look || {}),
      }));
      if (!o.nohit) hits.push({ no, box });
      return box;
    };
  }

  /* ---------- backgrounds ---------- */
  function deck(ctx, time) {
    const storm = time === 'storm';
    const dawn = time === 'dawn';
    // sky
    if (storm) vgrad(ctx, 0, 0, W, 150, [[0, 0.08], [1, 0.28]]);
    else if (dawn) vgrad(ctx, 0, 0, W, 150, [[0, 0.35], [0.8, 0.8], [1, 0.95]]);
    else vgrad(ctx, 0, 0, W, 150, [[0, 0.62], [1, 0.9]]);
    const r = rng(storm ? 41 : 17);
    // clouds
    for (let i = 0; i < 9; i++) {
      const cx = r() * W, cy = 20 + r() * 80, cw = 60 + r() * 90;
      ctx.save(); ctx.globalAlpha = storm ? 0.5 : 0.35;
      circle(ctx, cx, cy, cw * 0.3, storm ? 0.02 : 0.98);
      circle(ctx, cx + cw * 0.25, cy + 5, cw * 0.22, storm ? 0.04 : 0.98);
      circle(ctx, cx - cw * 0.25, cy + 6, cw * 0.2, storm ? 0.04 : 0.98);
      ctx.restore();
    }
    if (dawn) glow(ctx, 520, 140, 120, 0.4);
    // sea
    vgrad(ctx, 0, 132, W, 30, storm ? [[0, 0.18], [1, 0.1]] : [[0, 0.55], [1, 0.38]]);
    for (let i = 0; i < 40; i++) line(ctx, [[r() * W, 136 + r() * 22], [r() * W + 10, 136 + r() * 22]], storm ? 0.4 : 0.85, 0.8);

    // masts and rigging behind
    const mast = (x, w) => {
      rect(ctx, x - w / 2, -10, w, 180, 0.28, 0.05, 1);
      line(ctx, [[x - w / 2 + 2, -10], [x - w / 2 + 2, 170]], 0.5, 1);
      rect(ctx, x - 70, 26, 140, 5, 0.25, 0.05, 1);
      rect(ctx, x - 55, 86, 110, 4, 0.25, 0.05, 1);
      for (let k = -3; k <= 3; k++) if (k) line(ctx, [[x, 30], [x + k * 26, 150]], 0.1, 0.8);
    };
    if (!storm) mast(190, 12);
    mast(630, 10);
    // furled sails
    if (!storm) {
      curve(ctx, 120, 33, 190, 46, 260, 33, 0.85, 5);
      curve(ctx, 560, 33, 630, 46, 700, 33, 0.85, 5);
    }

    // bulwark
    rect(ctx, 0, 140, W, 38, storm ? 0.2 : 0.32, 0.05, 1);
    rect(ctx, 0, 136, W, 6, storm ? 0.4 : 0.6, 0.05, 1);
    for (let x = 30; x < W; x += 70) rect(ctx, x, 142, 5, 36, 0.18);
    // deck floor
    vgrad(ctx, 0, 178, W, H - 178, storm ? [[0, 0.22], [1, 0.32]] : dawn ? [[0, 0.45], [1, 0.6]] : [[0, 0.55], [1, 0.68]]);
    let y = 178, step = 4;
    while (y < H) { line(ctx, [[0, y], [W, y]], storm ? 0.1 : 0.3, 1); y += step; step *= 1.18; }
    const rr = rng(9);
    for (let i = 0; i < 70; i++) { const x = rr() * W, yy = 180 + rr() * 120; line(ctx, [[x, yy], [x, yy + 5]], storm ? 0.1 : 0.32, 1); }
  }

  function barrel(ctx, x, y, s, tone) {
    s = s || 1; tone = tone === undefined ? 0.4 : tone;
    poly(ctx, [[x - 12 * s, y], [x + 12 * s, y], [x + 14 * s, y - 16 * s], [x + 12 * s, y - 32 * s], [x - 12 * s, y - 32 * s], [x - 14 * s, y - 16 * s]], tone, 0.04, 1.2);
    line(ctx, [[x - 13 * s, y - 8 * s], [x + 13 * s, y - 8 * s]], 0.12, 2);
    line(ctx, [[x - 13 * s, y - 24 * s], [x + 13 * s, y - 24 * s]], 0.12, 2);
    line(ctx, [[x - 4 * s, y - 31 * s], [x - 4 * s, y - 1 * s]], tone + 0.25, 1);
  }
  function crate(ctx, x, y, w, h, tone) {
    rect(ctx, x, y, w, h, tone, 0.04, 1.2);
    line(ctx, [[x + 2, y + 2], [x + w - 2, y + h - 2]], 0.15, 2);
    line(ctx, [[x, y + 4], [x + w, y + 4]], 0.15, 1.5);
  }

  function interior(ctx, opts) {
    // generic wooden room
    vgrad(ctx, 0, 0, W, H, [[0, opts.wall], [1, opts.wall * 0.7]]);
    planks(ctx, 0, 30, W, opts.floorY - 30, 12, opts.wall * 0.5, true, 11);
    // ceiling beams
    rect(ctx, 0, 0, W, 30, opts.wall * 0.6, 0.04, 1);
    for (let x = 20; x < W; x += 95) rect(ctx, x, 0, 18, 38, opts.wall * 0.45, 0.04, 1);
    // floor
    vgrad(ctx, 0, opts.floorY, W, H - opts.floorY, [[0, opts.floor * 0.8], [1, opts.floor]]);
    let y = opts.floorY, step = 4;
    while (y < H) { line(ctx, [[0, y], [W, y]], opts.floor * 0.5, 1); y += step; step *= 1.2; }
    // knees / ribs of the hull
    for (let x = 60; x < W; x += 190) curve(ctx, x, 30, x - 14, opts.floorY * 0.6, x, opts.floorY, opts.wall * 0.35, 9);
  }

  function hangingLamp(ctx, x, y) {
    line(ctx, [[x, 0], [x, y]], 0.1, 1);
    ctx.save(); ctx.translate(x, y); ctx.scale(1.6, 1.6); ITEMS.lantern(ctx); ctx.restore();
  }

  function sternWindows(ctx, x, y, night) {
    rect(ctx, x - 6, y - 6, 252, 82, 0.2, 0.04, 2);
    for (let i = 0; i < 4; i++) {
      const wx = x + i * 60;
      if (night) {
        vgrad(ctx, wx, y, 54, 70, [[0, 0.12], [1, 0.3]]);
      } else vgrad(ctx, wx, y, 54, 70, [[0, 0.95], [1, 0.75]]);
      line(ctx, [[wx + 27, y], [wx + 27, y + 70]], 0.12, 2);
      line(ctx, [[wx, y + 35], [wx + 54, y + 35]], 0.12, 2);
      rect(ctx, wx, y, 54, 70, null, 0.08, 2);
    }
    if (night) { circle(ctx, x + 170, y + 18, 9, 0.95); glow(ctx, x + 170, y + 18, 30, 0.35); }
  }

  function table(ctx, x, y, w, cloth) {
    rect(ctx, x, y, w, 7, cloth ? 0.85 : 0.35, 0.04, 1.2);
    if (cloth) poly(ctx, [[x, y + 7], [x + w, y + 7], [x + w + 3, y + 22], [x - 3, y + 22]], 0.8, 0.05, 1);
    rect(ctx, x + 6, y + 7, 6, H - y - 30, 0.25, 0.04, 1);
    rect(ctx, x + w - 12, y + 7, 6, H - y - 30, 0.25, 0.04, 1);
  }

  function rain(ctx, seed) {
    const r = rng(seed);
    for (let i = 0; i < 420; i++) {
      const x = r() * (W + 100) - 50, y = r() * H;
      line(ctx, [[x, y], [x - 4, y + 11]], r() < 0.5 ? 0.95 : 0.75, 0.7);
    }
  }

  function smoke(ctx, x, y, n, seed) {
    const r = rng(seed);
    ctx.save(); ctx.globalAlpha = 0.6;
    for (let i = 0; i < n; i++) circle(ctx, x + r() * 30 - 6 + i * 2, y + r() * 14 - 7 - i, 4 + r() * 6, 0.92);
    ctx.restore();
  }

  function bladeThrough(ctx, x, y, angleDeg, len) {
    // a blade tip emerging from a body
    ctx.save(); ctx.translate(x, y); ctx.rotate(angleDeg * D2R);
    poly(ctx, [[0, -1.6], [len, -0.6], [len + 4, 0], [len, 0.8], [0, 1.6]], 0.98, 0.1, 0.6);
    ctx.restore();
  }

  function itemAt(ctx, type, x, y, angleDeg, sc) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angleDeg * D2R); ctx.scale(sc || K, sc || K); ITEMS[type](ctx); ctx.restore();
  }

  /* ---------- chapters ---------- */
  const SCENES = {
    1(ctx, fig) { // 熱病 — 寝台甲板
      interior(ctx, { wall: 0.36, floor: 0.4, floorY: 240 });
      // sea chests
      crate(ctx, 590, 230, 70, 34, 0.35); crate(ctx, 40, 236, 60, 30, 0.3);
      // Strand's hammock (sleeping)
      line(ctx, [[110, 120], [150, 160]], 0.1, 1); line(ctx, [[290, 118], [255, 160]], 0.1, 1);
      fig(3, { hip: [230, 163], f: -1, rot: -90, dead: false, pose: { rl: [8, 0], ll: [-2, 0], ra: [20, -30], la: [10, -20], head: -8 }, shade: 0.9 });
      poly(ctx, [[145, 166], [262, 166], [240, 184], [200, 190], [165, 182]], 0.62, 0.04, 1.2);
      // Pike's hammock
      line(ctx, [[300, 150], [330, 190]], 0.1, 1); line(ctx, [[470, 150], [440, 190]], 0.1, 1);
      const pike = fig(9, { hip: [400, 196], f: 1, rot: -90, dead: true, pose: { rl: [4, 0], ll: [-4, 6], ra: [-160, 10], la: [-20, -10], head: 10 } });
      poly(ctx, [[326, 201], [448, 201], [425, 220], [385, 226], [345, 218]], 0.7, 0.04, 1.2);
      // Reed with a cup
      fig(7, { x: 300, ground: 278, f: 1, pose: { lean: 12, head: 10, ra: [75, -10], la: [10, -40] }, items: { r: 'cup' } });
      // Will with a bucket
      fig(5, { x: 505, ground: 282, f: -1, pose: { lean: 4, ra: [10, -10], la: [-12, -5], rl: [14, -6], ll: [-16, 0] }, items: { r: 'bucket' } });
      // Heizo seated, praying
      fig(2, { x: 625, ground: 232, f: -1, pose: { lean: 8, head: 12, ra: [70, -110], la: [64, -104], rl: [90, -88], ll: [86, -90] } });
      hangingLamp(ctx, 390, 96);
      glow(ctx, 392, 112, 190, 0.42);
      shade(ctx, 390, 150, 470, 0.7, W, H);
      return pike;
    },

    2(ctx, fig) { // 船倉の銀
      interior(ctx, { wall: 0.24, floor: 0.3, floorY: 236 });
      for (let i = 0; i < 6; i++) crate(ctx, 470 + (i % 3) * 58, 150 + Math.floor(i / 3) * 44 + (i % 2) * 2, 56, 44, 0.28);
      crate(ctx, 640, 196, 60, 44, 0.3);
      barrel(ctx, 40, 262, 1.3, 0.3); barrel(ctx, 80, 270, 1.3, 0.35); barrel(ctx, 620, 280, 1.2, 0.3);
      // Vale kneeling behind the chest with a raised lantern
      const vale = fig(4, { x: 214, ground: 266, f: 1, pose: { lean: 4, head: -4, rl: [10, 0], ll: [-10, 0], la: [150, -20], ra: [70, -40] }, items: { l: 'lantern' } });
      // chest with silver
      poly(ctx, [[130, 286], [230, 286], [228, 254], [132, 254]], 0.3, 0.03, 1.4);
      poly(ctx, [[130, 254], [230, 254], [214, 222], [118, 226]], 0.22, 0.03, 1.4);
      rect(ctx, 130, 266, 100, 4, 0.15);
      const r = rng(5);
      for (let i = 0; i < 34; i++) circle(ctx, 138 + r() * 84, 250 + r() * 6, 2.4, 0.97, 0.3, 0.6);
      for (let i = 0; i < 6; i++) circle(ctx, 240 + r() * 30, 284 + r() * 4, 2.2, 0.97, 0.3, 0.6);
      // Crowe stabbing, Heizo recoiling
      const heizo = fig(2, { hip: [420, 236], f: -1, rot: -10, dead: true, pose: { lean: -18, head: -20, ra: [40, 40], la: [140, 10], rl: [30, -10], ll: [-20, 0] } });
      itemAt(ctx, 'lantern', 462, 262, 70);
      fig(6, { x: 350, ground: 280, f: 1, pose: { lean: 14, head: 6, ra: [92, 4], la: [-30, -30], rl: [35, -15], ll: [-35, 0] }, items: { r: 'knife' } });
      blood(ctx, 418, 284, 16, 3);
      droplets(ctx, 400, 216, 34, -22, 14, 4);
      glow(ctx, vale.lh[0], vale.lh[1] + 12, 190, 0.7);
      glow(ctx, 466, 272, 80, 0.45);
      shade(ctx, 300, 200, 420, 0.85, W, H);
      return heizo;
    },

    3(ctx, fig) { // 反乱 — 上甲板（朝）
      deck(ctx, 'morning');
      // hatch where Moretti hides
      // Reed with hands up
      fig(7, { x: 112, ground: 268, f: 1, pose: { lean: -6, ra: [160, 20], la: [150, 25] } });
      // Will crouched behind a barrel
      fig(5, { x: 40, ground: 282, f: 1, pose: { lean: 34, head: -10, ra: [80, -60], la: [60, -50], rl: [70, -120], ll: [40, -110] } });
      barrel(ctx, 60, 286, 1.25, 0.42);
      // Vale shooting
      const vale = fig(4, { x: 252, ground: 270, f: 1, pose: { lean: 4, ra: [92, 0], la: [-10, -30], rl: [25, -5], ll: [-20, 0] }, items: { r: 'pistol' } });
      smoke(ctx, vale.rh[0] + 20, vale.rh[1] - 2, 8, 2);
      glow(ctx, vale.rh[0] + 18, vale.rh[1], 26, 0.9);
      // O'Connor falling backwards
      const oc = fig(8, { hip: [382, 232], f: -1, rot: -30, dead: true, pose: { lean: -10, head: -20, ra: [155, -20], la: [120, 20], rl: [25, -20], ll: [-12, 0] }, items: { r: 'pin' } });
      droplets(ctx, oc.neck[0], oc.neck[1] + 14, 40, -8, 16, 8);
      blood(ctx, 400, 274, 14, 2);
      // Captain held at knifepoint
      fig(1, { x: 474, ground: 270, f: -1, pose: { lean: -4, head: -10, ra: [-35, -30], la: [-40, -20] } });
      fig(6, { x: 500, ground: 270, f: -1, pose: { lean: 6, ra: [110, 50], la: [60, 40] }, items: { r: 'knife' } });
      fig(3, { x: 548, ground: 268, f: -1, pose: { lean: 2, ra: [70, -40], la: [30, -50] }, items: { r: 'pin' } });
      // Moretti peeking from the hatch
      fig(10, { hip: [655, 272], f: -1, pose: { lean: -2, head: 8, ra: [60, -80], la: [70, -60] } });
      rect(ctx, 615, 252, 90, 16, 0.38, 0.04, 1.4);
      rect(ctx, 600, 268, 120, 32, 0.28, 0.04, 1.4);
      return oc;
    },

    4(ctx, fig) { // 船長室の剣（夜）
      interior(ctx, { wall: 0.3, floor: 0.38, floorY: 238 });
      sternWindows(ctx, 380, 60, true);
      table(ctx, 540, 220, 120, false);
      itemAt(ctx, 'bottle', 590, 214, 180, 1.5);
      // door
      rect(ctx, 80, 70, 64, 172, 0.15, 0.04, 2);
      rect(ctx, 88, 78, 48, 160, 0.42, 0.04, 1);
      fig(5, { x: 172, ground: 276, f: 1, pose: { lean: -2, ra: [55, -40], la: [-10, -10] }, items: { r: 'keys' } });
      // chains on the floor
      for (let i = 0; i < 9; i++) circle(ctx, 240 + i * 7, 288 - (i % 2) * 2, 3, null, 0.85, 1.2);
      const crowe = fig(6, { hip: [396, 232], f: -1, rot: -8, dead: true, pose: { lean: -14, head: -16, la: [130, 20], ra: [30, 60], rl: [30, -12], ll: [-20, 0] } });
      itemAt(ctx, 'knife', 372, 262, -150);
      const cap = fig(1, { x: 322, ground: 276, f: 1, pose: { lean: 16, head: 4, ra: [92, -2], la: [-30, -30], rl: [45, -20], ll: [-40, 0] }, items: { r: 'sword' } });
      bladeThrough(ctx, 404, 214, -6, 14);
      droplets(ctx, 412, 212, 30, -10, 12, 6);
      blood(ctx, 410, 284, 12, 9);
      hangingLamp(ctx, 470, 80);
      glow(ctx, 472, 96, 220, 0.6);
      shade(ctx, 380, 160, 480, 0.75, W, H);
      return crowe;
    },

    5(ctx, fig) { // 夜明けの決闘 — 後甲板
      deck(ctx, 'dawn');
      // ship's wheel
      rect(ctx, 664, 226, 10, 44, 0.25, 0.04, 1);
      circle(ctx, 669, 214, 24, null, 0.15, 4);
      for (let a = 0; a < 8; a++) line(ctx, [[669, 214], [669 + Math.cos(a * 0.785) * 30, 214 + Math.sin(a * 0.785) * 30]], 0.15, 2);
      // Reed with his bag
      fig(7, { x: 160, ground: 268, f: 1, pose: { lean: 8, ra: [20, -30], la: [-10, -20] }, items: { r: 'bag' } });
      const vale = fig(4, { x: 262, ground: 272, f: 1, pose: { lean: 16, head: 4, ra: [92, 0], la: [-40, -40], rl: [45, -20], ll: [-40, 0] }, items: { r: 'cutlass' } });
      const cap = fig(1, { x: 340, ground: 272, f: -1, dead: true, pose: { lean: 24, head: 20, ra: [50, 40], la: [70, 50], rl: [10, -30], ll: [-8, -10] } });
      bladeThrough(ctx, cap.hip[0] + 6, cap.hip[1] - 22, -4, 14);
      itemAt(ctx, 'sword', 392, 246, -110);
      droplets(ctx, 350, 222, 30, 10, 14, 11);
      blood(ctx, 342, 278, 12, 4);
      // Will lunges, Strand holds him back
      fig(3, { x: 520, ground: 272, f: -1, pose: { lean: -10, ra: [90, -20], la: [75, -10], rl: [-10, 0], ll: [20, -10] } });
      fig(5, { x: 470, ground: 280, f: -1, pose: { lean: 30, head: -14, ra: [105, 0], la: [95, 5], rl: [40, -20], ll: [-30, 0] } });
      return cap;
    },

    6(ctx, fig) { // 最後の葡萄酒 — 船長室
      interior(ctx, { wall: 0.3, floor: 0.38, floorY: 238 });
      sternWindows(ctx, 250, 56, true);
      // door with Reed watching
      rect(ctx, 610, 66, 80, 176, 0.12, 0.04, 2);
      fig(7, { x: 652, ground: 268, f: -1, pose: { lean: 8, head: 6, ra: [60, -80], la: [-6, -10] }, items: { r: 'vial' } });
      poly(ctx, [[688, 66], [740, 50], [740, 250], [688, 242]], 0.35, 0.04, 1.4);
      // chair + Vale slumped at the table
      rect(ctx, 316, 160, 8, 90, 0.2, 0.04, 1);
      const vale = fig(4, { x: 352, ground: 276, f: 1, dead: true, pose: { lean: 62, head: 26, ra: [96, -14], la: [20, 10], rl: [88, -86], ll: [84, -90] } });
      rect(ctx, 316, 246, 56, 6, 0.2, 0.04, 1);
      table(ctx, 392, 236, 150, true);
      // plates and a tipped glass
      circle(ctx, 460, 235, 9, 0.95, 0.1, 1);
      itemAt(ctx, 'glass', 382, 272, 70);
      droplets(ctx, 370, 268, 26, 8, 16, 5, 0.95);
      const r = rng(8);
      for (let i = 0; i < 8; i++) poly(ctx, [[372 + r() * 30, 286 + r() * 6], [376 + r() * 30, 288 + r() * 6], [374 + r() * 30, 292]], 0.98, 0.1, 0.4);
      // Moretti with the bottle
      fig(10, { x: 540, ground: 270, f: -1, pose: { lean: -2, head: 6, ra: [45, -40], la: [-10, -20] }, items: { r: 'bottle' } });
      // candles
      rect(ctx, 428, 220, 4, 15, 0.95, 0.1, 0.6);
      glow(ctx, 430, 216, 210, 0.6);
      glow(ctx, 372, 236, 70, 0.3);
      shade(ctx, 430, 180, 470, 0.72, W, H);
      return vale;
    },

    7(ctx, fig) { // 厨房
      interior(ctx, { wall: 0.34, floor: 0.4, floorY: 236 });
      // stove
      rect(ctx, 60, 140, 150, 120, 0.25, 0.03, 2);
      for (let y = 148; y < 256; y += 10) line(ctx, [[60, y], [210, y]], 0.12, 1);
      rect(ctx, 90, 200, 90, 46, 0.95, 0.04, 2);
      for (let i = 0; i < 6; i++) poly(ctx, [[96 + i * 14, 244], [103 + i * 14, 212 - (i % 2) * 8], [110 + i * 14, 244]], 0.65, null);
      rect(ctx, 120, 40, 22, 100, 0.2, 0.04, 1);
      // hanging pots
      for (let i = 0; i < 4; i++) {
        const px = 260 + i * 46;
        line(ctx, [[px, 30], [px, 64 + (i % 2) * 8]], 0.1, 1);
        poly(ctx, [[px - 12, 64 + (i % 2) * 8], [px + 12, 64 + (i % 2) * 8], [px + 9, 82 + (i % 2) * 8], [px - 9, 82 + (i % 2) * 8]], 0.3, 0.04, 1);
      }
      // shelf with jars
      rect(ctx, 440, 120, 140, 5, 0.3, 0.04, 1);
      for (let i = 0; i < 6; i++) rect(ctx, 446 + i * 22, 100, 14, 20, 0.6 + (i % 2) * 0.3, 0.04, 1);
      // Moretti being strangled from behind
      const mo = fig(10, { hip: [372, 238], f: 1, rot: -12, dead: true, pose: { lean: -14, head: -24, ra: [140, -140], la: [125, -120], rl: [60, -60], ll: [30, -70] } });
      const st = fig(3, { x: 318, ground: 280, f: 1, pose: { lean: 12, head: 4, ra: [110, -50], la: [100, -40], rl: [20, -10], ll: [-35, 0] } });
      line(ctx, [st.rh, mo.neck, st.lh], 0.75, 2.2);
      line(ctx, [st.lh, [st.lh[0] - 8, st.lh[1] + 26]], 0.75, 2);
      // a pot knocked over, soup frozen mid-air
      itemAt(ctx, 'bucket', 432, 252, 110, 1.4);
      droplets(ctx, 412, 250, -40, -26, 18, 12, 0.85);
      // Will in the doorway
      rect(ctx, 600, 70, 90, 170, 0.12, 0.04, 2);
      fig(5, { x: 590, ground: 278, f: -1, pose: { lean: 18, ra: [100, 0], la: [80, 10], rl: [30, -15], ll: [-25, 0] } });
      glow(ctx, 135, 220, 230, 0.6);
      shade(ctx, 280, 170, 520, 0.7, W, H);
      return mo;
    },

    8(ctx, fig) { // 嵐 — 上甲板
      deck(ctx, 'storm');
      // lightning
      line(ctx, [[120, 0], [140, 40], [125, 60], [150, 110]], 0.98, 2);
      glow(ctx, 140, 60, 200, 0.45);
      // longboat hanging on davits
      line(ctx, [[600, 140], [600, 70], [640, 64]], 0.15, 4);
      line(ctx, [[720, 140], [720, 70], [756, 64]], 0.15, 4);
      poly(ctx, [[585, 110], [760, 110], [744, 132], [600, 132]], 0.42, 0.03, 1.5);
      line(ctx, [[640, 64], [636, 110]], 0.75, 1); line(ctx, [[756, 64], [752, 110]], 0.75, 1);
      // Strand crushed beneath the fallen mast
      const strand = fig(3, { hip: [372, 270], f: 1, rot: 92, dead: true, pose: { lean: 0, head: 10, ra: [170, 10], la: [150, 20], rl: [10, -30], ll: [-10, -10] } });
      // the fallen mast
      ctx.save(); ctx.translate(380, 266); ctx.rotate(-58 * D2R);
      rect(ctx, -12, -330, 24, 350, 0.3, 0.03, 1.4);
      line(ctx, [[-8, -330], [-8, 20]], 0.5, 1);
      rect(ctx, -80, -240, 160, 6, 0.28, 0.03, 1);
      poly(ctx, [[-76, -234], [76, -234], [52, -196], [10, -150], [-40, -180]], 0.66, 0.05, 1);
      line(ctx, [[-20, -230], [-12, -170]], 0.4, 1);
      ctx.restore();
      const rr = rng(4);
      for (let i = 0; i < 10; i++) poly(ctx, [[390 + rr() * 30, 236 - rr() * 40], [394 + rr() * 30, 232 - rr() * 40], [392 + rr() * 30, 240 - rr() * 30]], 0.85, 0.1, 0.5);
      // torn sail
      // Reed shouting, Will hauling the boat line
      fig(7, { x: 580, ground: 268, f: -1, pose: { lean: -6, head: 10, ra: [130, 10], la: [70, -60] } });
      fig(5, { x: 668, ground: 276, f: 1, pose: { lean: -14, ra: [150, 0], la: [140, 10], rl: [20, 0], ll: [-25, 0] } });
      line(ctx, [[640, 64], [674, 200]], 0.7, 1.2);
      rain(ctx, 21);
      glow(ctx, 380, 250, 80, 0.15);
      return strand;
    },
  };

  const cache = {};
  function renderChapter(id, palette) {
    const key = id + ':' + palette.name;
    if (cache[key]) return cache[key];
    const c = R.makeCanvas(W * RES, H * RES);
    const ctx = c.getContext('2d');
    ctx.scale(RES, RES);
    const hits = [];
    SCENES[id](ctx, figFactory(ctx, hits));
    R.dither(c, palette);
    cache[key] = { canvas: c, hits };
    return cache[key];
  }

  /* ---------- the crew sketch (portrait drawn before departure) ---------- */
  const SKETCH_W = 400, SKETCH_H = 300;
  const SKETCH_POS = [
    // back row (raised)
    [62, 160], [128, 160], [200, 160], [272, 160], [340, 160],
    // front row
    [42, 286], [118, 286], [200, 286], [282, 286], [358, 286],
  ];
  // sketch number → slot
  const SKETCH_SLOT = { 3: 0, 8: 1, 1: 2, 4: 3, 6: 4, 9: 5, 10: 6, 5: 7, 7: 8, 2: 9 };

  function renderSketch(palette, seen) {
    const c = R.makeCanvas(SKETCH_W * RES, SKETCH_H * RES);
    const ctx = c.getContext('2d');
    ctx.scale(RES, RES);
    vgrad(ctx, 0, 0, SKETCH_W, SKETCH_H, [[0, 0.95], [1, 0.82]]);
    const r = rng(3);
    for (let i = 0; i < 120; i++) line(ctx, [[r() * SKETCH_W, r() * SKETCH_H], [r() * SKETCH_W, r() * SKETCH_H]], 0.88, 0.5);
    rect(ctx, 0, 168, SKETCH_W, 8, 0.6, 0.3, 1);
    const hits = [];
    const fig = figFactory(ctx, hits);
    DATA.FIGURES.forEach((F) => {
      const [x, g] = SKETCH_POS[SKETCH_SLOT[F.no]];
      const known = seen.has(F.no);
      const facing = x < SKETCH_W / 2 ? 1 : -1;
      if (known) {
        fig(F.no, { x, ground: g, f: facing, s: 1.05 / K * 1.6, pose: { lean: 0, ra: [10, -14], la: [-10, -10], rl: [4, 0], ll: [-4, 0] } });
      } else {
        const blank = { hat: null, hair: null, beard: null, mustache: false, glasses: false, eyepatch: false, apron: false, scarf: false, stripes: false, whistle: false, coat: 0.86, longCoat: false, robe: undefined, vest: undefined, shirt: 0.86, pants: 0.86, skin: 0.9 };
        fig(F.no, { x, ground: g, f: facing, s: 1.05 / K * 1.6, look: blank, pose: { lean: 0, ra: [10, -14], la: [-10, -10], rl: [4, 0], ll: [-4, 0] } });
      }
    });
    R.dither(c, palette, 1.3);
    // number tags are drawn as HTML so they stay crisp
    return { canvas: c, hits, w: SKETCH_W, h: SKETCH_H };
  }

  /* ---------- ship cross-section map ---------- */
  function renderMap(palette) {
    const MW = 400, MH = 260;
    const c = R.makeCanvas(MW, MH);
    const ctx = c.getContext('2d');
    vgrad(ctx, 0, 0, MW, 120, [[0, 0.7], [1, 0.92]]);
    vgrad(ctx, 0, 120, MW, MH - 120, [[0, 0.35], [1, 0.12]]);
    const r = rng(77);
    for (let i = 0; i < 60; i++) line(ctx, [[r() * MW, 124 + r() * 130], [r() * MW + 14, 124 + r() * 130]], 0.5, 0.8);
    // hull
    const hull = [[30, 78], [372, 64], [362, 120], [330, 200], [260, 222], [120, 222], [62, 196], [40, 140]];
    poly(ctx, hull, 0.55, 0.03, 2);
    ctx.save(); ctx.beginPath(); hull.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
    planks(ctx, 0, 60, MW, 170, 6, 0.42, false, 5);
    // decks
    line(ctx, [[30, 92], [372, 80]], 0.05, 3);
    line(ctx, [[40, 140], [362, 136]], 0.05, 2.5);
    line(ctx, [[62, 178], [342, 178]], 0.05, 2.5);
    // rooms
    rect(ctx, 290, 84, 70, 52, 0.75, 0.05, 1.5); // cabin
    rect(ctx, 52, 96, 72, 42, 0.68, 0.05, 1.5); // galley
    ctx.restore();
    // quarterdeck raised
    poly(ctx, [[270, 66], [376, 58], [372, 80], [270, 84]], 0.5, 0.03, 1.5);
    // masts
    [[130, 0.0], [210, 0.0], [300, 0.0]].forEach(([x]) => { rect(ctx, x - 3, 0, 6, 86, 0.2, 0.03, 1); line(ctx, [[x - 34, 18], [x + 34, 18]], 0.2, 3); line(ctx, [[x - 26, 46], [x + 26, 46]], 0.2, 3); });
    line(ctx, [[30, 78], [0, 64]], 0.2, 3);
    R.dither(c, palette, 1.2);
    return { canvas: c, w: MW, h: MH };
  }

  global.SCENES = { W, H, RES, renderChapter, renderSketch, renderMap, SKETCH_POS, SKETCH_SLOT };
})(window);
