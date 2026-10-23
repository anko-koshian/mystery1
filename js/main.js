/* Game flow, UI, persistence. */
(function () {
  'use strict';
  const { CREW, FIGURES, CAUSES, SOLUTION, PLACES, CHAPTERS, INTRO, EPILOGUE_PERFECT } = DATA;
  const $ = (id) => document.getElementById(id);
  const crewById = Object.fromEntries(CREW.map((c) => [c.id, c]));
  const causeById = Object.fromEntries(CAUSES.map((c) => [c.id, c]));
  const chapterById = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));
  const FIRST_CHAPTER = CHAPTERS[CHAPTERS.length - 1].id;
  const KANJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  /* ---------- state & persistence ---------- */
  const SAVE_KEY = 'halcyon-inquest-v1';
  function freshState() {
    return { started: false, unlocked: [FIRST_CHAPTER], viewed: [], seen: [], guesses: {}, locked: [], palette: 'parchment', sound: true, finished: false };
  }
  let S = freshState();
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) S = Object.assign(freshState(), JSON.parse(raw));
    } catch (e) { /* storage unavailable: play without saving */ }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }
  const seenSet = () => new Set(S.seen);

  /* ---------- palette ---------- */
  function palette() { return R.PALETTES[S.palette] || R.PALETTES.parchment; }
  function applyPalette() {
    const p = palette();
    const root = document.documentElement.style;
    root.setProperty('--ink', `rgb(${p.dark.join(',')})`);
    root.setProperty('--paper', `rgb(${p.light.join(',')})`);
    root.setProperty('--ink-rgb', p.dark.join(','));
    root.setProperty('--paper-rgb', p.light.join(','));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = `rgb(${p.dark.join(',')})`;
    sketchCache = null;
    mapArt = null;
  }

  /* ---------- screens ---------- */
  let current = 'title';
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + id));
    current = id;
    if (id === 'memory') requestAnimationFrame(() => { sizeMemCanvas(); drawMemory(); });
    if (id === 'map') renderMap();
    if (id === 'title') renderTitle();
  }

  let toastTimer = 0;
  function toast(msg, ms) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }
  function flash() {
    const f = $('flash');
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }

  /* ---------- sketch / faces ---------- */
  let sketchCache = null;
  function sketch() {
    const key = S.seen.slice().sort().join(',');
    if (!sketchCache || sketchCache.key !== key) {
      sketchCache = Object.assign(SCENES.renderSketch(palette(), seenSet()), { key });
    }
    return sketchCache;
  }
  function drawFace(canvas, no) {
    const sk = sketch();
    const hit = sk.hits.find((h) => h.no === no);
    const RES = SCENES.RES;
    const size = 30;
    canvas.width = size * RES; canvas.height = size * RES;
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    const [hx, hy] = hit.box.head;
    c.drawImage(sk.canvas, (hx - size / 2) * RES, (hy - size / 2 + 2) * RES, size * RES, size * RES, 0, 0, size * RES, size * RES);
  }

  /* ---------- fate text ---------- */
  function fateSentence(g, html) {
    const em = (s) => (html ? `<em>${s}</em>` : s);
    const blank = (s) => (html ? `<span class="blank">${s}</span>` : s);
    if (!g || !g.who) return blank('名前の分からない者');
    const name = em(crewById[g.who].name);
    if (!g.cause) return `${name}は、${blank('……')}`;
    const cause = causeById[g.cause];
    if (!cause.killer) return `${name}は、${em(cause.label)}。`;
    const killer = g.by ? em(crewById[g.by].name) : blank('（下手人）');
    return `${name}は、${killer}に${em(cause.label)}。`;
  }
  function isCorrect(no) {
    const g = S.guesses[no], sol = SOLUTION[no];
    if (!g || g.who !== sol.who || g.cause !== sol.cause) return false;
    return !causeById[sol.cause].killer || g.by === sol.by;
  }
  function checkLocks() {
    const pending = FIGURES.map((f) => f.no).filter((n) => !S.locked.includes(n) && isCorrect(n));
    let newly = [];
    while (pending.length >= 3) newly = newly.concat(pending.splice(0, 3));
    // the last stragglers lock once everyone else is settled
    if (pending.length && S.locked.length + newly.length + pending.length === FIGURES.length) newly = newly.concat(pending);
    if (newly.length) {
      S.locked = S.locked.concat(newly);
      save();
      setTimeout(() => {
        SFX.play('lock');
        toast(`✦ ${newly.length}人の運命が確定した ✦\n${newly.map((n) => '#' + n).join('　')}`, 3600);
      }, 250);
    }
  }
  function appearsIn(no) {
    return CHAPTERS.filter((c) => S.viewed.includes(c.id) && c.present.includes(no)).map((c) => `第${KANJI[c.id]}章`);
  }

  /* ---------- title ---------- */
  let mapArt = null;
  function mapImage() { if (!mapArt) mapArt = SCENES.renderMap(palette()); return mapArt; }
  function renderTitle() {
    const c = $('title-art');
    const img = mapImage();
    c.width = img.canvas.width; c.height = img.canvas.height;
    const x = c.getContext('2d');
    x.drawImage(img.canvas, 0, 0);
    $('btn-continue').hidden = !S.started;
  }

  /* ---------- narration ---------- */
  let narr = null;
  function narrate(opts) {
    narr = { lines: opts.lines, i: -1, typing: false, timer: 0, onDone: opts.onDone, sound: opts.sound };
    $('narr-head').textContent = opts.head || '';
    $('narr-skip').hidden = !opts.skippable;
    show('narration');
    nextLine();
  }
  function renderLine(line, full) {
    $('narr-lang').textContent = line.lang || '';
    $('narr-who').textContent = line.who || '';
    const el = $('narr-text');
    clearInterval(narr.timer);
    if (full) { el.textContent = line.t; narr.typing = false; return; }
    let n = 0;
    narr.typing = true;
    el.textContent = '';
    narr.timer = setInterval(() => {
      n += 1;
      el.textContent = line.t.slice(0, n);
      if (n % 3 === 1 && narr.sound) SFX.play('tick');
      if (n >= line.t.length) { clearInterval(narr.timer); narr.typing = false; }
    }, 38);
  }
  function nextLine() {
    if (!narr) return;
    if (narr.typing) { renderLine(narr.lines[narr.i], true); return; }
    narr.i += 1;
    if (narr.i >= narr.lines.length) { const done = narr.onDone; clearInterval(narr.timer); narr = null; done(); return; }
    const line = narr.lines[narr.i];
    if (line.sfx) SFX.play(line.sfx);
    renderLine(line, false);
  }

  /* ---------- map ---------- */
  function renderMap() {
    const img = mapImage();
    const c = $('map-canvas');
    c.width = img.canvas.width; c.height = img.canvas.height;
    c.getContext('2d').drawImage(img.canvas, 0, 0);
    const spots = $('map-spots');
    spots.innerHTML = '';
    Object.entries(PLACES).forEach(([key, pl]) => {
      const chs = CHAPTERS.filter((ch) => ch.place === key && S.unlocked.includes(ch.id));
      if (!chs.length) return;
      const fresh = chs.some((ch) => !S.viewed.includes(ch.id));
      const b = document.createElement('button');
      b.className = 'spot ' + (fresh ? 'new' : 'done');
      b.style.left = pl.x + '%'; b.style.top = pl.y + '%';
      b.innerHTML = `<span class="pin"><i>${fresh ? '!' : chs.length}</i></span><span class="lbl">${pl.name}</span>`;
      b.setAttribute('aria-label', `${pl.name}${fresh ? '（未検分の骸あり）' : ''}`);
      b.addEventListener('click', () => onSpot(key, chs));
      spots.appendChild(b);
    });
    const done = S.locked.length;
    $('map-progress').textContent = `確定した運命 ${done} / ${FIGURES.length}　・　検分した骸 ${S.viewed.length} / ${CHAPTERS.length}`;
    const pendingNew = CHAPTERS.find((ch) => S.unlocked.includes(ch.id) && !S.viewed.includes(ch.id));
    $('map-note').innerHTML = pendingNew
      ? `<b>${PLACES[pendingNew.place].name}</b>に、まだ時計をかざしていない骸がある。`
      : S.viewed.length === CHAPTERS.length
        ? 'すべての骸を検分した。検分帳を仕上げ、「検分を終える」で提出せよ。'
        : '';
  }
  function onSpot(key, chs) {
    SFX.unlock();
    const fresh = chs.find((ch) => !S.viewed.includes(ch.id));
    if (fresh) { enterMemory(fresh.id); return; }
    if (chs.length === 1) { enterMemory(chs[0].id); return; }
    const note = $('map-note');
    note.innerHTML = `<b>${PLACES[key].name}</b>：`;
    chs.slice().sort((a, b) => a.id - b.id).forEach((ch) => {
      const b = document.createElement('button');
      b.className = 'btn small ghost';
      b.style.margin = '4px';
      b.textContent = `第${KANJI[ch.id]}章「${ch.title}」`;
      b.addEventListener('click', () => enterMemory(ch.id));
      note.appendChild(b);
    });
  }

  /* ---------- memory ---------- */
  const mem = { ch: null, scene: null, cam: { x: 0, y: 0, z: 1 }, sel: null, ptrs: new Map(), moved: 0, pinch: null };

  function enterMemory(id, skipAudio) {
    const ch = chapterById[id];
    const startScene = () => {
      flash();
      SFX.play('sting');
      const first = !S.viewed.includes(id);
      if (first) {
        S.viewed.push(id);
        ch.present.forEach((n) => { if (!S.seen.includes(n)) S.seen.push(n); });
        const prev = chapterById[id - 1];
        if (prev && !S.unlocked.includes(prev.id)) S.unlocked.push(prev.id);
        save();
      }
      openScene(ch);
      if (first) {
        const prev = chapterById[id - 1];
        setTimeout(() => toast(prev ? `新たな骸の在りかが分かった：${PLACES[prev.place].name}` : 'これが最初の死だ。', 3200), 900);
      }
    };
    if (skipAudio) { startScene(); return; }
    narrate({
      head: `第${KANJI[ch.id]}章「${ch.title}」`,
      lines: [{ t: '——懐中時計の蓋が、ひとりでに開いた。' }].concat(ch.lines),
      sound: true,
      skippable: S.viewed.includes(id),
      onDone: startScene,
    });
  }

  function openScene(ch) {
    mem.ch = ch;
    mem.scene = SCENES.renderChapter(ch.id, palette());
    mem.sel = null;
    $('mem-card').hidden = true;
    $('mem-chapter').textContent = `第${KANJI[ch.id]}章「${ch.title}」`;
    $('mem-place').textContent = `${PLACES[ch.place].name} — ${ch.date}`;
    $('mem-hint').style.opacity = 1;
    show('memory');
    sizeMemCanvas();
    mem.cam.z = 1;
    const body = mem.scene.hits.find((h) => h.no === ch.body);
    centerOn(body.box.x + body.box.w / 2, body.box.y + body.box.h / 2);
    drawMemory();
  }

  function sizeMemCanvas() {
    const c = $('mem-canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(c.clientWidth * dpr);
    c.height = Math.round(c.clientHeight * dpr);
  }
  function viewScale() {
    const c = $('mem-canvas'), src = mem.scene.canvas;
    return Math.max(c.height / src.height, c.width / src.width) * mem.cam.z;
  }
  function clampCam() {
    const c = $('mem-canvas'), src = mem.scene.canvas;
    const s = viewScale();
    const vw = c.width / s, vh = c.height / s;
    mem.cam.x = vw >= src.width ? (src.width - vw) / 2 : Math.max(0, Math.min(src.width - vw, mem.cam.x));
    mem.cam.y = vh >= src.height ? (src.height - vh) / 2 : Math.max(0, Math.min(src.height - vh, mem.cam.y));
  }
  function centerOn(wx, wy) {
    const c = $('mem-canvas');
    const s = viewScale();
    mem.cam.x = wx * SCENES.RES - c.width / s / 2;
    mem.cam.y = wy * SCENES.RES - c.height / s / 2;
    clampCam();
  }
  function drawMemory() {
    if (!mem.scene || current !== 'memory') return;
    const c = $('mem-canvas');
    const x = c.getContext('2d');
    const src = mem.scene.canvas;
    const p = palette();
    const ink = `rgb(${p.dark.join(',')})`, paper = `rgb(${p.light.join(',')})`;
    clampCam();
    const s = viewScale();
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#000';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(src, mem.cam.x, mem.cam.y, c.width / s, c.height / s, 0, 0, c.width, c.height);
    const RES = SCENES.RES;
    const toScreen = (wx, wy) => [(wx * RES - mem.cam.x) * s, (wy * RES - mem.cam.y) * s];
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    // selection brackets
    if (mem.sel) {
      const h = mem.scene.hits.find((k) => k.no === mem.sel);
      const [x0, y0] = toScreen(h.box.x, h.box.y);
      const [x1, y1] = toScreen(h.box.x + h.box.w, h.box.y + h.box.h);
      const L = Math.min(18 * dpr, (x1 - x0) / 3);
      x.lineWidth = 3 * dpr;
      [[paper, 0], [ink, 0]].forEach(([col], i) => {
        x.strokeStyle = col;
        x.lineWidth = (i ? 2 : 5) * dpr;
        x.beginPath();
        [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([px, py, dx, dy]) => {
          x.moveTo(px + dx * L, py); x.lineTo(px, py); x.lineTo(px, py + dy * L);
        });
        x.stroke();
      });
    }
    // number tags above heads
    x.font = `700 ${12 * dpr}px ${getComputedStyle(document.body).fontFamily}`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    mem.scene.hits.forEach((h) => {
      const [hx, hy] = toScreen(h.box.head[0], h.box.y);
      const locked = S.locked.includes(h.no);
      const label = (locked ? '✦' : '') + h.no;
      const w = x.measureText(label).width + 10 * dpr, hh = 18 * dpr;
      const ty = hy - hh - 2 * dpr;
      x.fillStyle = h.no === mem.sel || locked ? ink : paper;
      x.fillRect(hx - w / 2, ty, w, hh);
      x.strokeStyle = h.no === mem.sel || locked ? paper : ink;
      x.lineWidth = 1.5 * dpr;
      x.strokeRect(hx - w / 2, ty, w, hh);
      x.fillStyle = h.no === mem.sel || locked ? paper : ink;
      x.fillText(label, hx, ty + hh / 2 + dpr);
    });
  }

  function hitAt(sx, sy) {
    const s = viewScale();
    const RES = SCENES.RES;
    const wx = (mem.cam.x + sx / s) / RES, wy = (mem.cam.y + sy / s) / RES;
    let best = null;
    mem.scene.hits.forEach((h) => {
      const b = h.box;
      const tagHit = Math.abs(wx - b.head[0]) < 10 && wy > b.y - 16 && wy < b.y + 2;
      if ((wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) || tagHit) {
        const area = tagHit ? 0 : b.w * b.h;
        if (!best || area < best.area) best = { no: h.no, area };
      }
    });
    return best && best.no;
  }

  function selectFigure(no) {
    mem.sel = no;
    const card = $('mem-card');
    if (!no) { card.hidden = true; drawMemory(); return; }
    card.hidden = false;
    $('mem-hint').style.opacity = 0;
    drawFace($('mem-card-face'), no);
    const isBody = mem.ch.body === no;
    $('mem-card-no').textContent = `#${no}${isBody ? '　— この骸' : ''}${S.locked.includes(no) ? '　✦確定' : ''}`;
    $('mem-card-fate').textContent = S.guesses[no] ? fateSentence(S.guesses[no], false) : '運命はまだ記されていない';
    drawMemory();
  }

  function setupMemoryInput() {
    const c = $('mem-canvas');
    const dpr = () => Math.min(window.devicePixelRatio || 1, 3);
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      mem.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (mem.ptrs.size === 1) mem.moved = 0;
      if (mem.ptrs.size === 2) {
        const [a, b] = [...mem.ptrs.values()];
        mem.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: mem.cam.z };
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!mem.ptrs.has(e.pointerId)) return;
      const prev = mem.ptrs.get(e.pointerId);
      mem.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (mem.ptrs.size === 2 && mem.pinch) {
        const [a, b] = [...mem.ptrs.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomTo(mem.pinch.z * d / mem.pinch.d, (a[0] + b[0]) / 2 * dpr(), (a[1] + b[1]) / 2 * dpr());
        mem.moved += 99;
        return;
      }
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      mem.moved += Math.abs(dx) + Math.abs(dy);
      const s = viewScale();
      mem.cam.x -= dx * dpr() / s;
      mem.cam.y -= dy * dpr() / s;
      if (mem.moved > 8) $('mem-hint').style.opacity = 0;
      drawMemory();
    });
    const end = (e) => {
      if (!mem.ptrs.has(e.pointerId)) return;
      mem.ptrs.delete(e.pointerId);
      if (mem.ptrs.size < 2) mem.pinch = null;
      if (mem.ptrs.size === 0 && mem.moved < 10 && e.type === 'pointerup') {
        const r = c.getBoundingClientRect();
        selectFigure(hitAt((e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr()));
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      zoomTo(mem.cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), (e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr());
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (current !== 'memory') return;
      const step = 40 / viewScale() * dpr();
      if (e.key === 'ArrowLeft') mem.cam.x -= step * 3;
      else if (e.key === 'ArrowRight') mem.cam.x += step * 3;
      else if (e.key === 'ArrowUp') mem.cam.y -= step * 3;
      else if (e.key === 'ArrowDown') mem.cam.y += step * 3;
      else return;
      drawMemory();
    });
  }
  function zoomTo(z, sx, sy) {
    const before = viewScale();
    const wx = mem.cam.x + sx / before, wy = mem.cam.y + sy / before;
    mem.cam.z = Math.max(1, Math.min(3.5, z));
    const after = viewScale();
    mem.cam.x = wx - sx / after;
    mem.cam.y = wy - sy / after;
    drawMemory();
  }

  /* ---------- book ---------- */
  let bookReturn = 'map';
  function openBook(tab) {
    bookReturn = current;
    renderBook();
    if (tab) setTab(tab);
    show('book');
    SFX.play('page');
  }
  function setTab(name) {
    document.querySelectorAll('.tab').forEach((t) => { const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
    document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
  }
  function renderBook() {
    const sk = sketch();
    const sc = $('sketch-canvas');
    sc.width = sk.canvas.width; sc.height = sk.canvas.height;
    sc.getContext('2d').drawImage(sk.canvas, 0, 0);
    const tags = $('sketch-tags');
    tags.innerHTML = '';
    const seen = seenSet();
    sk.hits.slice().sort((a, b) => a.no - b.no).forEach((h) => {
      const b = document.createElement('button');
      const locked = S.locked.includes(h.no);
      b.className = 'tag' + (locked ? ' locked' : '') + (seen.has(h.no) ? '' : ' unseen');
      b.textContent = (locked ? '✦' : '') + h.no;
      b.style.left = (h.box.head[0] / sk.w * 100) + '%';
      b.style.top = ((h.box.y + 9) / sk.h * 100) + '%';
      b.setAttribute('aria-label', `人物 ${h.no}`);
      if (seen.has(h.no)) b.addEventListener('click', () => openEditor(h.no));
      tags.appendChild(b);
    });

    const list = $('fate-list');
    list.innerHTML = '';
    FIGURES.forEach((F) => {
      const li = document.createElement('li');
      const locked = S.locked.includes(F.no);
      const known = seen.has(F.no);
      li.className = 'fate-item' + (locked ? ' locked' : '') + (known ? '' : ' unseen');
      const face = document.createElement('canvas');
      face.className = 'pixel face';
      drawFace(face, F.no);
      const txt = known ? (S.guesses[F.no] ? fateSentence(S.guesses[F.no], false) : '未記入') : 'まだ姿を見ていない';
      const apps = appearsIn(F.no);
      li.innerHTML = `<span class="num">${locked ? '✦' : ''}${F.no}</span>`;
      li.appendChild(face);
      const t = document.createElement('div');
      t.className = 'txt';
      t.innerHTML = `${txt}<small>${apps.length ? '登場：' + apps.join('・') : ''}${locked ? '　確定' : ''}</small>`;
      li.appendChild(t);
      if (known) { li.tabIndex = 0; li.setAttribute('role', 'button'); li.addEventListener('click', () => openEditor(F.no)); li.addEventListener('keydown', (e) => { if (e.key === 'Enter') openEditor(F.no); }); }
      list.appendChild(li);
    });

    $('roster-body').innerHTML = CREW.map((c) => `<tr><td>${c.name}</td><td>${c.role}</td><td>${c.nat}</td></tr>`).join('');

    const cl = $('chapter-list');
    cl.innerHTML = '';
    CHAPTERS.forEach((ch) => {
      const li = document.createElement('li');
      const viewed = S.viewed.includes(ch.id);
      li.className = viewed ? '' : 'locked';
      li.innerHTML = viewed
        ? `<div><b>第${KANJI[ch.id]}章「${ch.title}」</b><small>${PLACES[ch.place].name} — ${ch.date}</small></div>`
        : `<div><b>第${KANJI[ch.id]}章</b><small>まだ見ていない</small></div>`;
      if (viewed) {
        const b = document.createElement('button');
        b.className = 'btn small';
        b.textContent = '見る';
        b.addEventListener('click', () => enterMemory(ch.id, true));
        li.appendChild(b);
      }
      cl.appendChild(li);
    });
    $('book-progress').textContent = `確定 ${S.locked.length}/${FIGURES.length}`;
  }

  /* ---------- editor sheet ---------- */
  let editing = null;
  function fillSelect(sel, opts, value) {
    sel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    sel.value = value || '';
  }
  function openEditor(no) {
    editing = no;
    const g = S.guesses[no] || {};
    const locked = S.locked.includes(no);
    $('sheet-title').textContent = `人物 #${no} の運命`;
    const apps = appearsIn(no);
    $('sheet-seen').textContent = apps.length ? '登場した章：' + apps.join('・') : '';
    drawFace($('sheet-face'), no);
    const taken = Object.entries(S.guesses).filter(([n, v]) => +n !== no && v.who).map(([, v]) => v.who);
    fillSelect($('f-name'), [['', '— 未記入 —']].concat(CREW.map((c) => [c.id, `${c.name}（${c.role}）${taken.includes(c.id) ? ' ※記入済' : ''}`])), g.who);
    fillSelect($('f-cause'), [['', '— 未記入 —']].concat(CAUSES.map((c) => [c.id, c.label])), g.cause);
    fillSelect($('f-killer'), [['', '— 未記入 —']].concat(CREW.map((c) => [c.id, c.name])), g.by);
    ['f-name', 'f-cause', 'f-killer'].forEach((id) => { $(id).disabled = locked; });
    $('sheet-save').hidden = locked; $('sheet-clear').hidden = locked;
    $('sheet-locked').hidden = !locked;
    updateSentence();
    $('sheet').hidden = false;
  }
  function formGuess() {
    const who = $('f-name').value, cause = $('f-cause').value, by = $('f-killer').value;
    const needsKiller = cause && causeById[cause].killer;
    return { who: who || null, cause: cause || null, by: needsKiller ? by || null : null };
  }
  function updateSentence() {
    const g = formGuess();
    $('f-killer-wrap').hidden = !(g.cause && causeById[g.cause].killer);
    $('sheet-sentence').innerHTML = fateSentence(g, true);
  }
  function closeSheet(id) { $(id).hidden = true; }
  function saveEditor() {
    const g = formGuess();
    if (!g.who && !g.cause) delete S.guesses[editing];
    else S.guesses[editing] = g;
    save();
    closeSheet('sheet');
    checkLocks();
    refreshAfterEdit();
  }
  function refreshAfterEdit() {
    if (current === 'book') renderBook();
    if (current === 'memory') selectFigure(mem.sel);
  }

  /* ---------- settings ---------- */
  function openSettings() {
    const row = $('palette-row');
    row.innerHTML = '';
    Object.entries(R.PALETTES).forEach(([key, p]) => {
      const b = document.createElement('button');
      b.className = key === S.palette ? 'on' : '';
      b.style.background = `rgb(${p.light.join(',')})`;
      b.style.color = `rgb(${p.dark.join(',')})`;
      b.innerHTML = `<span class="sw" style="background:rgb(${p.dark.join(',')})"></span>${p.name}`;
      b.addEventListener('click', () => {
        S.palette = key; save(); applyPalette(); openSettings();
        if (current === 'title') renderTitle();
        if (current === 'map') renderMap();
        if (current === 'memory') { mem.scene = SCENES.renderChapter(mem.ch.id, palette()); drawMemory(); }
      });
      row.appendChild(b);
    });
    $('opt-sound').checked = S.sound;
    $('settings').hidden = false;
  }

  /* ---------- result ---------- */
  function finish() {
    const unviewed = CHAPTERS.length - S.viewed.length;
    const blanks = FIGURES.filter((f) => !S.guesses[f.no]).length;
    if ((unviewed || blanks) && !confirm(`${unviewed ? `未検分の骸が${unviewed}体、` : ''}${blanks ? `未記入の運命が${blanks}人分` : ''}ある。\nそれでも検分を終えるか？`)) return;
    const correct = FIGURES.filter((f) => isCorrect(f.no)).length;
    S.finished = true; save();
    const go = () => {
      $('result-score').textContent = `${correct} / ${FIGURES.length}`;
      $('result-text').textContent = correct === FIGURES.length
        ? '十の運命、すべて正しく記された。\n奉行所はこの検分帳を長く手本としたという。'
        : correct >= 7
          ? 'おおむね正しい検分であった。\nだが、いくつかの運命はまだ霧の中にある。'
          : correct >= 4
            ? '奉行所はこの検分帳を受け取ったが、\n誰もその内容を信じてはいないようだ。'
            : 'この検分帳は、真実からほど遠い。\n骸たちは今も船の上で待っている。';
      show('result');
    };
    if (correct === FIGURES.length) narrate({ lines: EPILOGUE_PERFECT.map((t) => ({ t })), onDone: go });
    else go();
  }

  /* ---------- wiring ---------- */
  function startNew() {
    const keep = { palette: S.palette, sound: S.sound };
    S = Object.assign(freshState(), keep, { started: true });
    save();
    narrate({ lines: INTRO.map((t) => ({ t })), skippable: true, onDone: () => { show('map'); toast('骸のある場所をタップして、時計をかざせ'); } });
  }

  function init() {
    load();
    applyPalette();
    SFX.enabled = S.sound;

    $('btn-new').addEventListener('click', () => {
      SFX.unlock();
      if (S.started && !confirm('これまでの検分記録を消して、はじめから始めますか？')) return;
      startNew();
    });
    $('btn-continue').addEventListener('click', () => { SFX.unlock(); show('map'); });
    $('btn-settings').addEventListener('click', openSettings);
    $('map-settings').addEventListener('click', openSettings);
    $('map-book').addEventListener('click', () => openBook('crew'));
    $('map-finish').addEventListener('click', finish);

    $('screen-narration').addEventListener('click', (e) => { if (e.target.id !== 'narr-skip') nextLine(); });
    $('narr-skip').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!narr) return;
      const done = narr.onDone; clearInterval(narr.timer); narr = null; done();
    });
    window.addEventListener('keydown', (e) => {
      if (current === 'narration' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); nextLine(); }
      if (e.key === 'Escape') { ['sheet', 'settings'].forEach((id) => closeSheet(id)); }
    });

    $('mem-back').addEventListener('click', () => show('map'));
    $('mem-book').addEventListener('click', () => openBook('crew'));
    $('mem-card-edit').addEventListener('click', () => openEditor(mem.sel));
    $('mem-zoom').addEventListener('click', () => {
      const c = $('mem-canvas');
      const z = mem.cam.z >= 2.6 ? 1 : mem.cam.z >= 1.6 ? 2.8 : 1.8;
      let sx = c.width / 2, sy = c.height / 2;
      if (mem.sel) {
        const h = mem.scene.hits.find((k) => k.no === mem.sel);
        const s = viewScale();
        sx = (h.box.head[0] * SCENES.RES - mem.cam.x) * s; sy = ((h.box.y + h.box.h / 2) * SCENES.RES - mem.cam.y) * s;
      }
      zoomTo(z, sx, sy);
      $('mem-zoom').textContent = mem.cam.z >= 2.6 ? '－' : '＋';
    });
    $('mem-replay').addEventListener('click', () => {
      const ch = mem.ch;
      narrate({ head: `第${KANJI[ch.id]}章「${ch.title}」`, lines: ch.lines, sound: true, skippable: true, onDone: () => show('memory') });
    });
    setupMemoryInput();

    $('book-close').addEventListener('click', () => show(bookReturn === 'book' ? 'map' : bookReturn));
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));

    ['f-name', 'f-cause', 'f-killer'].forEach((id) => $(id).addEventListener('change', updateSentence));
    $('sheet-save').addEventListener('click', saveEditor);
    $('sheet-clear').addEventListener('click', () => { delete S.guesses[editing]; save(); closeSheet('sheet'); refreshAfterEdit(); });
    document.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => { closeSheet('sheet'); closeSheet('settings'); }));

    $('opt-sound').addEventListener('change', (e) => { S.sound = e.target.checked; SFX.enabled = S.sound; save(); });
    $('opt-reset').addEventListener('click', () => {
      if (!confirm('検分記録をすべて消去しますか？')) return;
      const keep = { palette: S.palette, sound: S.sound };
      S = Object.assign(freshState(), keep);
      save();
      closeSheet('settings');
      show('title');
    });

    $('result-continue').addEventListener('click', () => show('map'));
    $('result-title').addEventListener('click', () => show('title'));

    window.addEventListener('resize', () => {
      if (current === 'memory') { sizeMemCanvas(); drawMemory(); }
    });

    show('title');
  }

  init();
})();
