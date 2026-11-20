/* Harebourg Trainer — interface (dépend de js/engine.js -> window.HB) */
(function () {
  'use strict';

  const HB = window.HB;
  const NS = 'http://www.w3.org/2000/svg';
  const HW = 32; // demi-largeur d'une case (px viewBox)
  const HH = 16; // demi-hauteur
  const PILLAR = 18;

  // ---------- utilitaires ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const chance = (p) => Math.random() < p;
  const scr = (c) => ({ x: (c.x - c.y) * HW, y: (c.x + c.y) * HH });
  const { key, eq, add } = HB;
  let CELLS = HB.allCells();
  // Forme de la carte : paysage (15 x 21) ou portrait (9 x 27) pour les écrans verticaux.
  const portraitMQ = window.matchMedia('(max-aspect-ratio: 4/5)');
  const SHAPES = { land: { D: 7, S: 20 }, port: { D: 4, S: 26 } };
  let shape = '';
  const REAL = window.HB_COMTE_MAP || null;
  const REAL_OBST = REAL ? new Map(REAL.obst.map(([x, y]) => [x + ',' + y, 'pilier'])) : new Map();
  const isReal = () => !!REAL && opts.map !== 'aleatoire';
  function applyShape() {
    document.body.classList.toggle('real-portrait', isReal() && portraitMQ.matches);
    const next = isReal() ? 'real' : portraitMQ.matches ? 'port' : 'land';
    if (next === shape) return false;
    shape = next;
    let vb;
    if (next === 'real') {
      Object.assign(HB.MAP, { D: 14, S: 39, cells: new Set(REAL.walk.concat(REAL.obst).map(([x, y]) => x + ',' + y)) });
      vb = REAL.viewBox.join(' ');
    } else {
      Object.assign(HB.MAP, SHAPES[next], { cells: null });
      const w = HB.MAP.D * HW + HW + 2;
      vb = `${-w} -46 ${2 * w} ${HB.MAP.S * HH + HH + 2 + 46}`;
    }
    CELLS = HB.allCells();
    document.querySelectorAll('.board').forEach((b) => b.setAttribute('viewBox', vb));
    return true;
  }
  const deskMQ = window.matchMedia('(min-aspect-ratio: 29/20) and (min-width: 600px)');
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const secs = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function diamond(c, inset = 0, lift = 0) {
    const p = scr(c);
    const w = HW - inset;
    const h = HH - inset / 2;
    const y = p.y - lift;
    return `${p.x},${y - h} ${p.x + w},${y} ${p.x},${y + h} ${p.x - w},${y}`;
  }

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {
        /* stockage indisponible : on ignore */
      }
    },
  };

  // ---------- assets ----------
  const MONSTERS = [
    { name: 'Cycloïde', img: 'assets/cycloide.png' },
    { name: 'Granduk', img: 'assets/granduk.png' },
    { name: 'Sinistrofu', img: 'assets/sinistrofu.png' },
    { name: 'Strigide', img: 'assets/strigide.png' },
  ];
  const ALLY_HEADS = [
    { name: 'Iop', img: 'assets/head-iop.png' },
    { name: 'Pandawa', img: 'assets/head-pandawa.png' },
    { name: 'Sram', img: 'assets/head-sram.png' },
    { name: 'Eniripsa', img: 'assets/head-eniripsa.png' },
  ];
  const SELF = { name: 'Toi', img: 'assets/head-xelor.png' };
  const SUMMON = { name: 'Invoc', img: 'assets/invocation.png' };
  const COMTE = { name: 'Comte', img: 'assets/comte-harebourg.png' };

  // ---------- rendu du plateau ----------
  /*
   * onCell(c)      : clic / tap sur une case de la carte (plateau déverrouillé)
   * onLockedTap()  : clic / tap quand le plateau est verrouillé (sert de « Suivant »)
   */
  function createBoard(svg, onCell, onLockedTap) {
    svg.innerHTML = '';
    const gCells = el('g', { class: 'cells' }, svg);
    const gMarks = el('g', {}, svg);
    const gHover = el('g', {}, svg);
    const gEnts = el('g', {}, svg);
    const gOver = el('g', {}, svg);
    let locked = false;
    let hoverKey = null;
    let touch = null; // { id, cell, moved }
    let lastTouchUp = 0;
    const entEls = new Map();

    // Conversion écran -> case (inverse de scr), exacte sur les losanges.
    function cellAt(e) {
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      const u = pt.x / HW + pt.y / HH; // = 2x
      const v = pt.y / HH - pt.x / HW; // = 2y
      const c = { x: Math.round(u / 2), y: Math.round(v / 2) };
      return HB.onMap(c) ? c : null;
    }
    function cellOf(e) {
      const t = e.target.closest && e.target.closest('[data-x]');
      if (t) return { x: +t.dataset.x, y: +t.dataset.y };
      return cellAt(e);
    }
    function setHover(c, press) {
      const k = c ? key(c) : null;
      if (k === hoverKey && !press) return;
      gHover.innerHTML = '';
      hoverKey = k;
      if (!c || locked) return;
      el('polygon', { class: 'hover-ring' + (press ? ' press' : ''), points: diamond(c, 1) }, gHover);
    }

    svg.addEventListener('click', (e) => {
      if (performance.now() - lastTouchUp < 600) return; // déjà traité au pointerup tactile
      if (locked) return onLockedTap && onLockedTap();
      const c = cellOf(e);
      if (c) onCell(c);
    });
    svg.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        if (touch && touch.id === e.pointerId) {
          const c = cellAt(e);
          touch.moved = true;
          touch.cell = c;
          setHover(c, true);
        }
        return;
      }
      if (!locked) setHover(cellOf(e));
    });
    svg.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'touch') setHover(null);
    });
    svg.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || locked) return;
      const c = cellOf(e);
      touch = { id: e.pointerId, cell: c, moved: false };
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* rien */
      }
      setHover(c, true);
    });
    svg.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'touch') return;
      lastTouchUp = performance.now();
      const t = touch;
      touch = null;
      setHover(null);
      if (locked) return onLockedTap && onLockedTap();
      if (t && t.cell) onCell(t.cell);
    });
    // un tap traité au pointerup ne doit pas produire de « clic fantôme » (sur le dock qui a bougé)
    svg.addEventListener('touchend', (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
        svg.addEventListener('pointercancel', () => {
      touch = null;
      setHover(null);
    });

    function entityNode(e) {
      const asset = e.asset;
      const big = e.type === 'comte' || e.type === 'monster';
      const p = scr(e);
      const g = el('g', { class: 'ent ' + e.type });
      g.style.transform = `translate(${p.x}px, ${p.y}px)`;
      if (e.type === 'comte') el('ellipse', { class: 'ring', cx: 0, cy: 0, rx: 26, ry: 13 }, g);
      el('ellipse', { class: 'base', cx: 0, cy: 0, rx: 21, ry: 10.5 }, g);
      if (big) {
        const s = e.type === 'comte' ? 70 : 54;
        el('image', { href: asset.img, x: -s / 2, y: -s + 8, width: s, height: s }, g);
      } else if (e.type === 'summon') {
        el('image', { href: asset.img, x: -15, y: -30, width: 30, height: 30 }, g);
      } else {
        el('circle', { cx: 0, cy: -16, r: 16, fill: 'rgba(0,0,0,.25)' }, g);
        el('image', { href: asset.img, x: -15, y: -31, width: 30, height: 30 }, g);
      }
      if (e.label) {
        const t = el('text', { class: 'ent-label', x: 0, y: 4, 'text-anchor': 'middle' }, g);
        t.textContent = e.label;
      }
      return g;
    }

    function pillarNode(c) {
      const p = scr(c);
      const g = el('g', { 'data-x': c.x, 'data-y': c.y, class: 'pillar' });
      el('polygon', { class: 'pillar-side', points: `${p.x - HW},${p.y} ${p.x},${p.y + HH} ${p.x},${p.y + HH - PILLAR} ${p.x - HW},${p.y - PILLAR}` }, g);
      el('polygon', { class: 'pillar-side', points: `${p.x},${p.y + HH} ${p.x + HW},${p.y} ${p.x + HW},${p.y - PILLAR} ${p.x},${p.y + HH - PILLAR}`, style: 'filter:brightness(.8)' }, g);
      el('polygon', { class: 'pillar-top', points: diamond(c, 0, PILLAR) }, g);
      return g;
    }

    function headAt(q, ux, uy, cls, s = 9) {
      const pts = [
        [q.x, q.y],
        [q.x - ux * s - uy * s * 0.6, q.y - uy * s + ux * s * 0.6],
        [q.x - ux * s + uy * s * 0.6, q.y - uy * s - ux * s * 0.6],
      ];
      return el('polygon', { class: cls, points: pts.map((x) => x.join(',')).join(' ') }, gOver);
    }

    return {
      render(board) {
        gCells.innerHTML = '';
        gMarks.innerHTML = '';
        gEnts.innerHTML = '';
        gOver.innerHTML = '';
        gHover.innerHTML = '';
        hoverKey = null;
        entEls.clear();
        const real = isReal();
        if (real) {
          const im = REAL.img;
          el('image', { href: im.href, x: im.x, y: im.y, width: im.w, height: im.h, class: 'map-bg', preserveAspectRatio: 'none' }, gCells);
        }
        for (const c of CELLS) {
          const b = board.blocked.get(key(c));
          const cls = 'cell' + (real ? ' real' + (b ? ' obst' : '') : (c.x % 2 === 0 ? ' alt' : '') + (b === 'trou' ? ' trou' : ''));
          el('polygon', { class: cls, points: diamond(c), 'data-x': c.x, 'data-y': c.y }, gCells);
        }
        const drawables = [];
        for (const [k, v] of board.blocked) {
          if (v !== 'pilier' || real) continue;
          const [x, y] = k.split(',').map(Number);
          drawables.push({ depth: x + y, node: pillarNode({ x, y }) });
        }
        for (const e of board.entities) {
          const n = entityNode(e);
          entEls.set(e.id, n);
          drawables.push({ depth: e.x + e.y + 0.1, node: n });
        }
        drawables.sort((a, b) => a.depth - b.depth).forEach((d) => gEnts.appendChild(d.node));
      },
      clearMarks() {
        gMarks.innerHTML = '';
        gOver.innerHTML = '';
      },
      mark(c, cls) {
        if (!HB.onMap(c)) return;
        el('polygon', { class: 'mark ' + cls, points: diamond(c, 3) }, gMarks);
      },
      // petit viseur sur la case de lancer (Marquer)
      crosshair(c) {
        if (!HB.onMap(c)) return;
        const p = scr(c);
        el('ellipse', { class: 'crosshair', cx: p.x, cy: p.y, rx: 9, ry: 4.5 }, gMarks);
        el('path', { class: 'crosshair', d: `M${p.x - 14},${p.y}h8M${p.x + 6},${p.y}h8M${p.x},${p.y - 8}v4M${p.x},${p.y + 4}v4` }, gMarks);
      },
      arrow(a, b, cls) {
        const p = scr(a);
        const q = scr(b);
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const ex = q.x - ux * 6;
        const ey = q.y - uy * 6;
        const anim = cls === 'aim' ? 'fade-in' : 'draw';
        el('line', { class: `arrow ${cls} ${anim}`, pathLength: 1, x1: p.x + ux * 10, y1: p.y + uy * 10, x2: ex, y2: ey }, gOver);
        headAt(q, ux, uy, 'head fade-in ' + cls);
      },
      // arc de rotation (confusion k) autour de `center`, partant de la direction de `from`
      arc(center, from, k) {
        k = HB.mod4(k);
        if (!k) return;
        const p = scr(center);
        const v = HB.sub(from || add(center, { x: -1, y: 0 }), center);
        let a0 = Math.atan2(v.x + v.y, v.x - v.y);
        if (!v.x && !v.y) a0 = -Math.PI / 2;
        const sweep = (k === 3 ? -1 : k) * (Math.PI / 2);
        const RX = 36;
        const RY = 18;
        const N = 24;
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const t = a0 + (sweep * i) / N;
          pts.push([p.x + RX * Math.cos(t), p.y + RY * Math.sin(t)]);
        }
        const end = pts[N];
        const prev = pts[N - 3];
        const dx = end[0] - prev[0];
        const dy = end[1] - prev[1];
        const l = Math.hypot(dx, dy) || 1;
        el('path', { class: `rot k${k} draw`, pathLength: 1, d: 'M' + pts.slice(0, N - 1).map((x) => x.map((n) => n.toFixed(1)).join(',')).join('L') }, gOver);
        headAt({ x: end[0], y: end[1] }, dx / l, dy / l, `rot-head fade-in k${k}`, 10);
      },
      // badge ✔ / ✘ / ÉC au-dessus d'une case
      badge(c, kind) {
        if (!c || !HB.onMap(c)) return;
        const p = scr(c);
        const g = el('g', { class: 'badge ' + kind }, gOver);
        el('circle', { cx: p.x, cy: p.y - 20, r: 11 }, g);
        const t = el('text', { x: p.x, y: p.y - 20 }, g);
        t.textContent = kind === 'ok' ? '✔' : kind === 'ko' ? '✘' : 'ÉC';
      },
      cross(c) {
        const p = scr(c);
        el('line', { class: 'cross', x1: p.x - 9, y1: p.y - 9, x2: p.x + 9, y2: p.y + 9 }, gOver);
        el('line', { class: 'cross', x1: p.x - 9, y1: p.y + 9, x2: p.x + 9, y2: p.y - 9 }, gOver);
      },
      moveEntity(id, c) {
        const n = entEls.get(id);
        if (!n) return;
        const p = scr(c);
        n.style.transform = `translate(${p.x}px, ${p.y}px)`;
      },
      kill(id) {
        const n = entEls.get(id);
        if (n) n.classList.add('dead');
      },
      vulnerable(id) {
        const n = entEls.get(id);
        if (n) n.classList.add('vuln');
      },
      lock(v) {
        locked = v;
        svg.classList.toggle('locked', v);
        if (v) setHover(null);
      },
    };
  }

  // ---------- génération commune ----------
  function genBlocked(holes, pillars) {
    if (isReal()) return new Map(REAL_OBST);
    const m = new Map();
    while (m.size < holes + pillars) {
      const c = pick(CELLS);
      const k = key(c);
      if (m.has(k)) continue;
      m.set(k, m.size < holes ? 'trou' : 'pilier');
    }
    return m;
  }
  function isFree(board, c) {
    return HB.onMap(c) && !board.blocked.has(key(c)) && !HB.entityAt(board, c);
  }
  function freeCell(board, extraOk) {
    for (let i = 0; i < 500; i++) {
      const c = pick(CELLS);
      if (isFree(board, c) && (!extraOk || extraOk(c))) return c;
    }
    return null;
  }
  // le sprite du Comte est haut : on évite la case du coin supérieur (rognée)
  const notTopCorner = (c) => c.x + c.y > 0;
  let uid = 0;
  function addEnt(board, type, c, asset, label) {
    const e = { id: type + ++uid, type, x: c.x, y: c.y, asset, label };
    board.entities.push(e);
    return e;
  }
  function addDecoys(board, { allies = 0, monsters = 0, summons = 0, avoid = [] }) {
    const ok = (c) => !avoid.some((a) => eq(a, c));
    const heads = ALLY_HEADS.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < allies; i++) {
      const c = freeCell(board, ok);
      if (c) addEnt(board, 'ally', c, heads[i % heads.length]);
    }
    for (let i = 0; i < monsters; i++) {
      const c = freeCell(board, ok);
      if (c) addEnt(board, 'monster', c, pick(MONSTERS));
    }
    for (let i = 0; i < summons; i++) {
      const c = freeCell(board, ok);
      if (c) addEnt(board, 'summon', c, SUMMON);
    }
  }
  function genOffset(align, maxD) {
    if (align === 'ligne') {
      const n = rand(1, maxD);
      return pick([{ x: n, y: 0 }, { x: -n, y: 0 }, { x: 0, y: n }, { x: 0, y: -n }]);
    }
    if (align === 'diagonale') {
      const n = rand(1, Math.max(1, Math.floor(maxD / 2)));
      return { x: pick([n, -n]), y: pick([n, -n]) };
    }
    let v;
    do {
      v = { x: rand(-maxD, maxD), y: rand(-maxD, maxD) };
    } while ((v.x === 0 && v.y === 0) || Math.abs(v.x) + Math.abs(v.y) > maxD);
    return v;
  }
  function genHp() {
    if (chance(0.35)) return pick([100, 90, 91, 89, 76, 75, 74, 46, 45, 44, 31, 30, 29, 2, 1]);
    return rand(1, 100);
  }
  function genMelee(enabled) {
    if (!enabled) return 0;
    return pick([0, 0, 0, 0, 1, 1, 1, 2, 2, 3]);
  }
  function blockedName(board, c) {
    if (!HB.onMap(c)) return 'hors de la carte';
    const b = board.blocked.get(key(c));
    return b === 'trou' ? 'une case noire' : 'un obstacle';
  }
  const INV_HINT = [
    'clique directement la cible (aucune confusion)',
    'clique la cible tournée de 90° <b>anti-horaire</b> autour de toi',
    'clique la case <b>symétrique</b> de la cible par rapport à toi',
    'clique la cible tournée de 90° <b>horaire</b> autour de toi',
  ];
  const KS = ['aucune', '↻ 90°', '180°', '↺ 90°'];
  function chip(k) {
    return `<span class="chip k${k}">${HB.CONF_LABELS[k]}</span>`;
  }
  // Explication d'une confusion : ligne courte + détail html.
  function confExplain(q) {
    const t = HB.tranche(q.hp);
    let html = `<p>Vitalité ${q.hp} % (tranche ${t.max} → ${t.min} %) → ${chip(q.base)}.</p>`;
    let short = `${q.hp} % → ${KS[q.base]}`;
    if (q.m > 0) {
      html += `<p>${q.m} ligne${q.m > 1 ? 's' : ''} de dégâts au càc → −${q.m * 90}° (anti-horaire) → confusion effective ${chip(q.k)}.</p>`;
      short += ` · ⚔${q.m} → ${KS[q.k]}`;
    }
    return { short, html };
  }
  function meleeChip(node, m, enabled) {
    node.hidden = !enabled || !m;
    node.textContent = '⚔ ' + m;
    node.title = `${m} ligne${m > 1 ? 's' : ''} déjà au càc ce tour`;
  }

  // ---------- feedback ----------
  let fbOpen = !!store.get('hb.fbOpen', false);
  function showFeedback(node, prompt, ok, ms, short, html) {
    const time = ok && ms != null ? ` <small>· ${secs(ms)}</small>` : '';
    node.innerHTML =
      `<div class="verdict ${ok ? 'ok' : 'ko'}">${ok ? '✔ Juste' : '✘ Faux'}${time}</div>` +
      (short ? `<div class="short">${short}</div>` : '') +
      (html ? `<details class="fb-more"${fbOpen ? ' open' : ''}><summary>Pourquoi ? <kbd>P</kbd></summary><div class="fb-body">${html}</div></details>` : '');
    const d = $('details', node);
    if (d) {
      d.addEventListener('toggle', () => {
        fbOpen = d.open;
        store.set('hb.fbOpen', fbOpen);
      });
    }
    prompt.hidden = true;
  }
  function clearFeedback(node, prompt) {
    node.innerHTML = '';
    prompt.hidden = false;
  }
  function flash(ok) {
    const f = $('.flash');
    f.classList.remove('ok', 'ko');
    void f.offsetWidth;
    f.classList.add(ok ? 'ok' : 'ko');
  }

  // ---------- stats ----------
  const STATS_KEY = 'hbt-stats-v1';
  const stats = store.get(STATS_KEY, {});
  function bucket(name) {
    if (!stats[name]) stats[name] = { n: 0, ok: 0, streak: 0, best: 0, time: 0, by: {} };
    return stats[name];
  }
  function record(name, ok, ms, sub) {
    const b = bucket(name);
    b.n++;
    if (ok) b.ok++;
    b.streak = ok ? b.streak + 1 : 0;
    b.best = Math.max(b.best, b.streak);
    b.time += ms;
    if (sub) {
      const s = (b.by[sub] = b.by[sub] || { n: 0, ok: 0 });
      s.n++;
      if (ok) s.ok++;
    }
    store.set(STATS_KEY, stats);
  }
  function weakest(b) {
    const subs = Object.entries(b.by).filter(([, s]) => s.n >= 3);
    if (!subs.length) return null;
    subs.sort((a, b2) => a[1].ok / a[1].n - b2[1].ok / b2[1].n);
    const [w, s] = subs[0];
    return s.ok < s.n ? [w, s] : null;
  }
  function renderStats(container, name, subLabel) {
    const b = bucket(name);
    const pct = b.n ? Math.round((100 * b.ok) / b.n) + ' %' : '—';
    const avg = b.n ? (b.time / b.n / 1000).toFixed(1) + ' s' : '—';
    let weak = '';
    const ws = weakest(b);
    if (ws) {
      const [w, s] = ws;
      weak = `<div class="weak">Point faible : <b>${subLabel(w)}</b> (${Math.round((100 * s.ok) / s.n)} % sur ${s.n})</div>`;
    }
    container.innerHTML =
      `<div class="stat"><b>${pct}</b><small>Réussite</small></div>` +
      `<div class="stat"><b>${b.streak}</b><small>Série</small></div>` +
      `<div class="stat"><b>${b.best}</b><small>Record</small></div>` +
      `<div class="stat"><b>${avg}</b><small>Temps moy.</small></div>` +
      weak;
  }
  // Ligne compacte « 84 % · série 7 » (+ point si un point faible existe).
  let lastMini = { name: '', streak: 0 };
  function miniStats(b, name) {
    const node = $('#btn-stats');
    const pct = b.n ? Math.round((100 * b.ok) / b.n) + ' %' : '—';
    const grew = name === lastMini.name && b.streak > lastMini.streak;
    lastMini = { name, streak: b.streak };
    node.innerHTML =
      pct +
      (b.streak >= 2 ? ` · <span class="streak${grew ? ' pop' : ''}">série ${b.streak}</span>` : '') +
      (weakest(b) ? '<span class="weak-dot" title="Point faible détecté"></span>' : '');
    node.setAttribute('aria-label', `Statistiques : réussite ${pct}${b.streak >= 2 ? ', série ' + b.streak : ''}`);
  }

  // ---------- options ----------
  const DEFAULTS = { map: 'comte', cMode: 'taper', cAlign: 'libre', cMelee: 'on', cImpossible: 'on', dMode: 'predire', autoNext: 'on', showTimer: 'off', theme: 'auto' };
  const opts = Object.assign({}, DEFAULTS, store.get('hbt-opts', {}));
  function applyTheme() {
    if (opts.theme === 'light' || opts.theme === 'dark') document.documentElement.setAttribute('data-theme', opts.theme);
    else document.documentElement.removeAttribute('data-theme');
  }
  function applyTimer() {
    $('#c-timer').hidden = opts.showTimer !== 'on';
  }
  function markDirty() {
    const dirty = ['map', 'cAlign', 'cMelee', 'cImpossible', 'autoNext', 'showTimer', 'theme'].some((k) => opts[k] !== DEFAULTS[k]);
    $('#btn-opts').classList.toggle('dirty', dirty);
  }
  $$('.seg[data-opt]').forEach((seg) => {
    const name = seg.dataset.opt;
    $$('button', seg).forEach((b) => {
      b.classList.toggle('on', b.dataset.v === opts[name]);
      b.setAttribute('aria-pressed', String(b.dataset.v === opts[name]));
      b.addEventListener('click', () => {
        opts[name] = b.dataset.v;
        store.set('hbt-opts', opts);
        $$('button', seg).forEach((x) => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        });
        markDirty();
        if (name === 'theme') applyTheme();
        else if (name === 'showTimer') applyTimer();
        else if (name === 'autoNext') Auto.cancel();
        else if (name === 'map') {
          applyShape();
          Conf.next();
          Delock.next();
        }
        else if (name === 'dMode') Delock.next();
        else Conf.next();
        if (name === 'cMode' || name === 'dMode') syncModeSelect();
      });
    });
  });

  // ---------- chrono (pausable) ----------
  function makeTimer(node) {
    let start = 0;
    let raf = 0;
    let pausedAt = 0;
    let running = false;
    const tick = () => {
      node.textContent = secs(performance.now() - start);
      raf = requestAnimationFrame(tick);
    };
    return {
      start() {
        cancelAnimationFrame(raf);
        start = performance.now();
        pausedAt = 0;
        running = true;
        tick();
      },
      stop() {
        cancelAnimationFrame(raf);
        const now = pausedAt || performance.now();
        const ms = now - start;
        running = false;
        pausedAt = 0;
        node.textContent = secs(ms);
        return ms;
      },
      pause() {
        if (!running || pausedAt) return;
        pausedAt = performance.now();
        cancelAnimationFrame(raf);
      },
      resume() {
        if (!running || !pausedAt) return;
        start += performance.now() - pausedAt;
        pausedAt = 0;
        tick();
      },
    };
  }

  // ---------- enchaînement automatique ----------
  const Auto = {
    t: 0,
    bar: $('.autobar'),
    start(ms, fn) {
      this.cancel();
      if (opts.autoNext !== 'on') return;
      this.bar.hidden = false;
      const i = this.bar.firstElementChild;
      i.style.setProperty('--d', ms + 'ms');
      i.style.animation = 'none';
      void i.offsetWidth;
      i.style.animation = '';
      this.t = setTimeout(() => {
        this.cancel();
        fn();
      }, ms);
    },
    cancel() {
      clearTimeout(this.t);
      this.t = 0;
      this.bar.hidden = true;
    },
  };
  document.addEventListener('keydown', () => Auto.cancel(), true);
  document.addEventListener('pointerdown', () => Auto.cancel(), true);

  function setNextReady(btn, ready) {
    btn.classList.toggle('ready', ready);
  }

  // =====================================================================
  // ENTRAÎNEMENT 1 : CONFUSIONS
  // =====================================================================
  const Conf = (() => {
    const ui = {
      svg: $('#c-board'),
      quiz: $('#c-quiz'),
      hp: $('#c-hp'),
      hpLabel: $('#c-hp-label'),
      melee: $('#c-melee'),
      prompt: $('#c-prompt'),
      impossible: $('#c-impossible'),
      next: $('#c-next'),
      feedback: $('#c-feedback'),
      stats: $('#c-stats'),
      hero: $('.quiz-hero'),
      heroHp: $('.hero-hp'),
      heroMelee: $('.hero-melee'),
    };
    const timer = makeTimer($('#c-timer'));
    const board = createBoard(ui.svg, onCell, () => q && q.answered && performance.now() - q.doneAt > 300 && next());
    const CENTER = { x: 5, y: 5 };
    let q = null;
    const trancheLabel = (i) => {
      const t = HB.TRANCHES[+i];
      return t ? `${t.max} → ${t.min} %` : i;
    };

    function genTaper(meleeOn) {
      const wantImpossible = opts.cImpossible === 'on' && chance(0.15);
      let last = null;
      for (let tries = 0; tries < 400; tries++) {
        const b = { blocked: genBlocked(rand(3, 6), rand(3, 6)), entities: [] };
        const me = freeCell(b);
        const tgt = add(me, genOffset(opts.cAlign, 6));
        if (!isFree(b, tgt)) continue;
        const hp = genHp();
        const m = genMelee(meleeOn);
        const base = HB.confusionFromHp(hp);
        const k = HB.effectiveConfusion(base, m);
        const aim = HB.aimCell(me, tgt, k);
        const possible = !HB.isBlocked(b, aim);
        if (!possible && opts.cImpossible !== 'on') continue;
        addEnt(b, 'self', me, SELF, 'Toi');
        const target = chance(0.3) && notTopCorner(tgt) ? addEnt(b, 'comte', tgt, COMTE) : addEnt(b, 'monster', tgt, pick(MONSTERS));
        addDecoys(b, { allies: rand(1, 2), monsters: rand(1, 2), avoid: [aim] });
        last = { type: 'taper', board: b, me, tgt, target, hp, m, base, k, aim, possible };
        if (possible !== wantImpossible) continue;
        return last;
      }
      return last;
    }

    function genMarquer(meleeOn) {
      for (let tries = 0; tries < 400; tries++) {
        const b = { blocked: genBlocked(rand(3, 6), rand(3, 6)), entities: [] };
        const me = freeCell(b);
        const click = add(me, genOffset(opts.cAlign, 6));
        if (HB.isBlocked(b, click)) continue;
        const hp = genHp();
        const m = genMelee(meleeOn);
        const base = HB.confusionFromHp(hp);
        const k = HB.effectiveConfusion(base, m);
        const land = HB.landing(me, click, k);
        if (HB.isBlocked(b, land) || eq(land, me)) continue;
        addEnt(b, 'self', me, SELF, 'Toi');
        if (chance(0.5) && !HB.entityAt(b, land)) addEnt(b, 'monster', land, pick(MONSTERS));
        addDecoys(b, { allies: rand(0, 2), monsters: rand(1, 3), avoid: [click] });
        return { type: 'marquer', board: b, me, click, land, hp, m, base, k };
      }
      return null;
    }

    function genQuiz(meleeOn) {
      const hp = genHp();
      const m = genMelee(meleeOn);
      const base = HB.confusionFromHp(hp);
      const b = { blocked: new Map(), entities: [] };
      addEnt(b, 'self', CENTER, SELF, 'Toi');
      return { type: 'quiz', hp, m, base, k: HB.effectiveConfusion(base, m), board: b, me: CENTER };
    }

    function next() {
      Auto.cancel();
      const meleeOn = opts.cMelee === 'on';
      let type = opts.cMode;
      if (type === 'mixte') type = pick(['taper', 'taper', 'taper', 'marquer', 'marquer', 'quiz']);
      q = type === 'taper' ? genTaper(meleeOn) : type === 'marquer' ? genMarquer(meleeOn) : genQuiz(meleeOn);
      q.answered = false;

      board.render(q.board);
      board.clearMarks();
      board.lock(type === 'quiz');
      document.body.classList.toggle('mode-quiz', type === 'quiz');
      ui.quiz.hidden = type !== 'quiz';
      ui.hero.hidden = type !== 'quiz';
      $$('button', ui.quiz).forEach((b) => {
        b.disabled = false;
        b.classList.remove('good', 'bad');
      });
      ui.hp.textContent = q.hp + ' %';
      ui.heroHp.textContent = q.hp + ' %';
      ui.hpLabel.textContent = `Vitalité ${q.hp} %` + (meleeOn && q.m ? `, ${q.m} ligne${q.m > 1 ? 's' : ''} au càc` : '');
      meleeChip(ui.melee, q.m, meleeOn);
      meleeChip(ui.heroMelee, q.m, meleeOn);
      clearFeedback(ui.feedback, ui.prompt);
      setNextReady(ui.next, false);
      ui.impossible.hidden = type !== 'taper' || opts.cImpossible !== 'on';
      ui.impossible.disabled = false;

      if (type === 'taper') {
        board.mark(q.tgt, 'zone pulse');
        ui.prompt.textContent = q.target.type === 'comte' ? 'Vise le Comte' : `Vise le ${q.target.asset.name}`;
      } else if (type === 'marquer') {
        board.mark(q.click, 'click');
        board.crosshair(q.click);
        ui.prompt.textContent = 'Où arrive ton sort ?';
      } else {
        ui.prompt.textContent = 'Quelle confusion ?';
      }
      timer.start();
      updateMini();
    }

    function finish(ok, fb) {
      q.answered = true;
      q.doneAt = performance.now();
      const ms = timer.stop();
      board.lock(true);
      ui.impossible.disabled = true;
      record('conf-' + q.type, ok, ms, String(HB.TRANCHES.indexOf(HB.tranche(q.hp))));
      flash(ok);
      showFeedback(ui.feedback, ui.prompt, ok, ms, fb.short, fb.html);
      setNextReady(ui.next, true);
      renderStats(ui.stats, 'conf-' + q.type, trancheLabel);
      updateMini();
      if (ok) Auto.start(800 + 250, next);
    }

    function answerTaper(c, sayImpossible) {
      const ok = sayImpossible ? !q.possible : q.possible && eq(c, q.aim);
      const ex = confExplain(q);
      let html = ex.html;
      let short = ex.short;
      board.clearMarks();
      board.mark(q.tgt, 'zone');
      if (q.possible) {
        board.mark(q.aim, ok ? 'good' : 'aim');
        board.arrow(q.me, q.aim, 'aim');
        board.arrow(q.me, q.tgt, 'ok');
        board.badge(q.aim, 'ok');
        html += `<p>Pour toucher la cible, ${INV_HINT[q.k]} : <b>case bleue</b>.</p>`;
      } else {
        html += `<p>La case à viser est ${blockedName(q.board, q.aim)} : le sort ferait un <b>échec critique</b>. Bonne réponse : « Impossible ».</p>`;
        short += ' · visée bloquée → Impossible';
        if (HB.onMap(q.aim)) {
          board.mark(q.aim, 'bad');
          board.cross(q.aim);
          board.badge(q.aim, 'ec');
        }
      }
      board.arc(q.me, q.aim, q.k);
      if (!sayImpossible && !ok) {
        board.mark(c, 'bad');
        board.badge(c, 'ko');
        const shot = HB.landing(q.me, c, q.k);
        board.arrow(q.me, shot, 'shot');
        if (HB.isBlocked(q.board, shot)) {
          html += `<p>Ton clic serait parti vers ${blockedName(q.board, shot)} → échec critique.</p>`;
        } else {
          const hit = HB.entityAt(q.board, shot);
          html += `<p>Ton sort serait arrivé sur la case rouge${hit ? ` (sur ${hit.type === 'self' ? 'toi' : hit.type === 'ally' ? 'un allié' : hit.asset.name})` : ' (dans le vide)'}.</p>`;
          board.cross(shot);
        }
      }
      if (q.m === 0 && HB.dist(q.me, q.tgt) === 1) {
        html += '<p class="muted">Cible au càc : ce coup suit la confusion actuelle, mais chaque ligne de dégâts fera ensuite tourner ta confusion de −90°.</p>';
      }
      finish(ok, { short, html });
    }

    function answerMarquer(c) {
      const ok = eq(c, q.land);
      const ex = confExplain(q);
      let html = ex.html;
      board.clearMarks();
      board.mark(q.click, 'click');
      board.mark(q.land, 'good');
      board.badge(q.land, 'ok');
      if (!ok) {
        board.mark(c, 'bad');
        board.badge(c, 'ko');
      }
      board.arrow(q.me, q.click, 'aim');
      board.arrow(q.me, q.land, 'ok');
      board.arc(q.me, q.click, q.k);
      const dir = ['ne bouge pas', 'tourne de 90° horaire', 'part à l’opposé (180°)', 'tourne de 90° anti-horaire'][q.k];
      html += `<p>Le sort ${dir} autour de toi : il arrive sur la <b>case verte</b>.</p>`;
      finish(ok, { short: ex.short, html });
    }

    function onCell(c) {
      if (!q || q.answered) return;
      if (q.type === 'taper') answerTaper(c, false);
      else if (q.type === 'marquer') answerMarquer(c);
    }

    function answerQuiz(k) {
      if (!q || q.answered || q.type !== 'quiz') return;
      const ok = k === q.k;
      $$('button', ui.quiz).forEach((b) => {
        b.disabled = true;
        if (+b.dataset.k === q.k) b.classList.add('good');
        else if (+b.dataset.k === k) b.classList.add('bad');
      });
      ui.hero.hidden = true;
      board.arc(q.me, null, q.k);
      finish(ok, confExplain(q));
    }

    function impossible() {
      if (q && !q.answered && q.type === 'taper' && !ui.impossible.hidden) answerTaper(null, true);
    }

    function updateMini() {
      const name = 'conf-' + (q ? q.type : 'taper');
      if (current === 'confusion') miniStats(bucket(name), name);
    }

    $$('button', ui.quiz).forEach((b) => b.addEventListener('click', () => answerQuiz(+b.dataset.k)));
    ui.impossible.addEventListener('click', impossible);
    ui.next.addEventListener('click', next);

    return {
      next,
      timer,
      updateMini,
      typeLabel: () => ({ taper: 'Taper', marquer: 'Marquer', quiz: 'Lire la confusion' }[q ? q.type : 'taper']),
      renderStats: () => renderStats(ui.stats, 'conf-' + (q ? q.type : 'taper'), trancheLabel),
      resetStats() {
        ['conf-taper', 'conf-marquer', 'conf-quiz'].forEach((n) => delete stats[n]);
        store.set(STATS_KEY, stats);
        renderStats(ui.stats, 'conf-' + (q ? q.type : 'taper'), trancheLabel);
        updateMini();
      },
      key(e) {
        if (!q) return;
        if (q.answered && (e.code === 'Space' || e.key === 'Enter')) {
          e.preventDefault();
          next();
        } else if (!q.answered && q.type === 'quiz' && /^[1-4]$/.test(e.key)) {
          answerQuiz(+e.key - 1);
        } else if (e.key === 'i' || e.key === 'I') {
          impossible();
        }
      },
      init() {
        next();
        renderStats(ui.stats, 'conf-' + q.type, trancheLabel);
      },
    };
  })();

  // =====================================================================
  // ENTRAÎNEMENT 2 : DELOCK
  // =====================================================================
  const OUTCOME_LABEL = {
    'comte-tp': 'le Comte est téléporté (toujours invulnérable)',
    'self-tp': 'tu es téléporté de l’autre côté du Comte',
    delock: 'delock : échange de place, le Comte devient vulnérable',
    'delock-summon': 'delock sur une invocation : les alliés à ≤ 3 cases du Comte meurent',
    wipe: 'case d’arrivée bloquée : toute l’équipe meurt',
  };
  const OUTCOME_SHORT = {
    'comte-tp': 'case libre : simple TP',
    'self-tp': 'pas de delock',
    delock: 'échange',
    'delock-summon': 'échange invoc : alliés proches morts',
    wipe: 'case bloquée : équipe morte',
  };
  const outcomeOf = (r) => r.kind;

  const Delock = (() => {
    const ui = {
      svg: $('#d-board'),
      turn: $('#d-turn b'),
      parity: $('#d-parity'),
      state: $('#d-state'),
      hpRow: $('#d-hp-row'),
      hp: $('#d-hp'),
      melee: $('#d-melee'),
      prompt: $('#d-prompt'),
      outcomes: $('#d-outcomes'),
      offmap: $('#d-offmap'),
      impossible: $('#d-impossible'),
      next: $('#d-next'),
      feedback: $('#d-feedback'),
      stats: $('#d-stats'),
    };
    const timer = makeTimer(document.createElement('span'));
    const board = createBoard(ui.svg, onCell, () => q && q.answered && performance.now() - q.doneAt > 300 && next());
    let q = null;
    const kindLabel = (k) =>
      ({ 'comte-tp': 'Comte téléporté', 'self-tp': 'toi téléporté', delock: 'delock', 'delock-summon': 'delock invocation', wipe: 'wipe', placer: 'placement', confusion: 'frappe confuse', complet: 'delock complet' }[k] || k);
    const parityText = (t) => (t % 2 === 0 ? 'pair' : 'impair');
    const later = (fn, ms) => {
      const cur = q;
      setTimeout(() => q === cur && fn(), reduceMQ.matches ? Math.min(ms, 60) : ms);
    };

    function baseBoard() {
      return { blocked: genBlocked(rand(3, 6), rand(4, 7)), entities: [] };
    }

    function genPredire() {
      for (let tries = 0; tries < 800; tries++) {
        const turn = rand(1, 8);
        const even = turn % 2 === 0;
        const desired = even ? pick(['comte-tp', 'delock', 'delock', 'delock-summon', 'wipe']) : pick(['self-tp', 'self-tp', 'wipe']);
        const b = baseBoard();
        const C = freeCell(b, notTopCorner);
        const A = add(C, genOffset('libre', 5));
        if (!isFree(b, A) || eq(A, C)) continue;
        const comte = addEnt(b, 'comte', C, COMTE);
        addEnt(b, 'self', A, SELF, 'Toi');
        const dest = even ? HB.symmetric(A, C) : HB.symmetric(C, A);
        if (desired === 'wipe') {
          if (!HB.isBlocked(b, dest)) {
            if (isReal() || !HB.onMap(dest) || HB.entityAt(b, dest) || chance(0.35)) continue;
            b.blocked.set(key(dest), pick(['trou', 'pilier']));
          }
        } else {
          if (!isFree(b, dest)) continue;
          if (even && !notTopCorner(dest)) continue; // le Comte finirait sur le coin rogné
          if (desired === 'delock') {
            if (chance(0.65)) addEnt(b, 'ally', dest, pick(ALLY_HEADS));
            else addEnt(b, 'monster', dest, pick(MONSTERS));
          } else if (desired === 'delock-summon') {
            addEnt(b, 'summon', dest, SUMMON);
            if (chance(0.7)) {
              const near = freeCell(b, (c) => HB.dist(c, comte) <= 3);
              if (near) addEnt(b, 'ally', near, pick(ALLY_HEADS));
            }
          }
        }
        addDecoys(b, { allies: rand(1, 2), monsters: rand(1, 3), summons: rand(0, 1), avoid: [dest] });
        const r = HB.resolveHitComte(b, turn, b.entities[1].id);
        if (outcomeOf(r) !== desired) continue;
        return { type: 'predire', board: b, turn, r, step: 'mark', selfId: b.entities[1].id, comte };
      }
      return null;
    }

    function genPlacer(withConfusion) {
      for (let tries = 0; tries < 800; tries++) {
        const turn = pick([2, 4, 6, 8]);
        const b = baseBoard();
        const C = freeCell(b, (c) => {
          const d = c.x - c.y;
          const s = c.x + c.y;
          return Math.abs(d) <= HB.MAP.D - 2 && s >= 3 && s <= HB.MAP.S - 3;
        });
        const comte = addEnt(b, 'comte', C, COMTE);
        const v = genOffset('libre', 3);
        const A = add(C, v);
        const P = add(A, v);
        if (!isFree(b, A) || !isFree(b, P)) continue;
        if (chance(0.6)) addEnt(b, 'ally', P, pick(ALLY_HEADS));
        else addEnt(b, 'monster', P, pick(MONSTERS));
        if (chance(0.6)) {
          // piège : une invocation placée à un écart pair du Comte
          const w = genOffset('libre', 3);
          const S = add(C, add(w, w));
          if (isFree(b, S) && isFree(b, add(C, w))) addEnt(b, 'summon', S, SUMMON);
        }
        addDecoys(b, { allies: rand(1, 2), monsters: rand(1, 2), avoid: [A] });
        const startSelf = freeCell(b, (c) => HB.dist(c, comte) >= 3 && HB.dist(c, A) >= 2);
        if (!startSelf) continue;
        const self = addEnt(b, 'self', startSelf, SELF, 'Toi');
        const valid = HB.delockCells(b);
        if (!valid.length || valid.some((d) => eq(d.cell, startSelf))) continue;
        return { type: withConfusion ? 'complet' : 'placer', board: b, turn, comte, selfId: self.id, valid, step: 'place' };
      }
      return null;
    }

    function setHeader() {
      ui.turn.textContent = q.turn;
      ui.parity.textContent = parityText(q.turn);
      ui.parity.title = q.turn % 2 === 0 ? 'Tour pair : le Comte bouge' : 'Tour impair : tu bouges';
      ui.state.textContent = 'Comte invulnérable';
      ui.hpRow.hidden = true;
    }

    function next() {
      Auto.cancel();
      let type = opts.dMode;
      if (type === 'mixte') type = pick(['predire', 'predire', 'placer', 'complet']);
      q = type === 'predire' ? genPredire() : genPlacer(type === 'complet');
      q.answered = false;
      board.render(q.board);
      board.clearMarks();
      board.lock(false);
      setHeader();
      clearFeedback(ui.feedback, ui.prompt);
      setNextReady(ui.next, false);
      ui.outcomes.hidden = true;
      $$('button', ui.outcomes).forEach((b) => {
        b.disabled = false;
        b.classList.remove('good', 'bad');
      });
      ui.impossible.hidden = true;
      ui.offmap.hidden = type !== 'predire';
      ui.offmap.disabled = false;
      q.ok = true;
      q.notes = '';
      q.shortNotes = '';
      if (type === 'predire') {
        ui.parity.hidden = true;
        ui.prompt.textContent = 'Où arrive la TP ?';
      } else {
        ui.parity.hidden = false;
        ui.prompt.textContent = 'Place-toi pour delock';
      }
      timer.start();
      updateMini();
    }

    // --- Prédire ---
    function predireMark(c, offmapPressed) {
      const r = q.r;
      const destOn = HB.onMap(r.dest);
      const ok = offmapPressed ? !destOn : destOn && eq(c, r.dest);
      q.ok = ok;
      ui.offmap.disabled = true;
      ui.offmap.hidden = true;
      board.lock(true);
      const even = q.turn % 2 === 0;
      ui.parity.hidden = false;
      if (destOn) {
        board.mark(r.dest, ok ? 'good' : 'aim');
        board.badge(r.dest, 'ok');
      }
      if (!ok && c) {
        board.mark(c, 'bad');
        board.badge(c, 'ko');
      }
      const self = q.board.entities.find((e) => e.id === q.selfId);
      if (even) board.arrow(self, r.dest, 'aim');
      else board.arrow(q.comte, r.dest, 'aim');
      q.notes =
        `<p>${ok ? '✔' : '✘'} Case d'arrivée : ${even
          ? 'tour <b>pair</b> → le <b>Comte</b> passe de l’autre côté de <b>toi</b> (symétrie par rapport à toi)'
          : 'tour <b>impair</b> → <b>tu</b> passes de l’autre côté du <b>Comte</b> (symétrie par rapport au Comte)'}${destOn ? '' : ' — ici, hors de la carte'}.</p>`;
      q.shortNotes = even ? 'Pair : le Comte saute par-dessus toi' : 'Impair : tu sautes par-dessus le Comte';
      q.step = 'outcome';
      ui.prompt.innerHTML = `<span class="pre ${ok ? 'ok' : 'ko'}">${ok ? '✔ Case juste' : '✘ Case fausse'}${destOn ? '' : ' · hors carte'}</span>Que se passe-t-il ?`;
      ui.outcomes.hidden = false;
    }

    function predireOutcome(o) {
      if (!q || q.step !== 'outcome') return;
      q.step = 'done';
      const r = q.r;
      const ok2 = o === r.kind;
      $$('button', ui.outcomes).forEach((b) => {
        b.disabled = true;
        if (b.dataset.o === r.kind) b.classList.add('good');
        else if (b.dataset.o === o) b.classList.add('bad');
      });
      const html = q.notes + `<p>${ok2 ? '✔' : '✘'} Résultat : ${OUTCOME_LABEL[r.kind]}.</p>` + explainResult(r).html;
      const dur = animate(r, q.selfId);
      finish(q.ok && ok2, { short: `${q.shortNotes} → ${OUTCOME_SHORT[r.kind]}`, html }, r.kind, dur);
    }

    function explainResult(r) {
      switch (r.kind) {
        case 'delock':
          return r.bonus
            ? { short: 'échange avec un allié (+100 dommages)', html: '<p>L’allié échangé gagne <b>+100 dommages</b> pendant 1 tour : c’est lui qui doit taper fort.</p>' }
            : { short: 'échange avec un monstre', html: '<p>Échange avec un monstre : ça marche aussi, le Comte perd son invulnérabilité.</p>' };
        case 'delock-summon':
          return { short: 'invocation : alliés à ≤ 3 cases morts', html: `<p>Échange avec une <b>invocation alliée</b> : tous les alliés à ≤ 3 cases de la position initiale du Comte meurent${r.killed.length ? ` (${r.killed.length} ici, zone orange)` : ' (aucun ici, zone orange)'}.</p>` };
        case 'wipe':
          return { short: 'case bloquée : équipe morte', html: `<p>La case d'arrivée est ${r.offMap ? 'hors de la carte' : r.cause === 'trou' ? 'une case noire' : 'un obstacle'} : la rotation est impossible, le combat est perdu.</p>` };
        case 'comte-tp':
          return { short: 'case libre : simple TP', html: '<p>Case libre : le Comte change juste de place. Pour delock, il faut une entité sur la case d’arrivée.</p>' };
        case 'self-tp':
          return { short: 'tour impair : pas de delock', html: '<p>Aux tours impairs, on ne peut pas delock : chaque coup te renvoie de l’autre côté du Comte.</p>' };
        default:
          return { short: '', html: '' };
      }
    }

    // Joue l'animation du résultat ; renvoie sa durée (ms) pour caler le verdict.
    function animate(r, attackerId) {
      const comte = q.board.entities.find((e) => e.type === 'comte');
      if (r.kind === 'wipe') {
        board.cross(r.dest);
        if (HB.onMap(r.dest)) board.badge(r.dest, 'ko');
        later(() => q.board.entities.filter((e) => e.type !== 'comte' && e.type !== 'monster').forEach((e) => board.kill(e.id)), 350);
        return 650;
      }
      if (r.kind === 'self-tp') {
        board.moveEntity(attackerId, r.dest);
        return 450;
      }
      if (r.kind === 'comte-tp') {
        board.moveEntity(comte.id, r.dest);
        return 450;
      }
      // delock : échange
      for (const c of HB.allCells()) if (r.kind === 'delock-summon' && HB.dist(c, comte) <= 3) board.mark(c, 'zone');
      board.moveEntity(comte.id, r.dest);
      board.moveEntity(r.swapWith.id, comte);
      board.vulnerable(comte.id);
      ui.state.textContent = 'Comte vulnérable';
      if (r.kind === 'delock-summon') later(() => r.killed.forEach((e) => board.kill(e.id)), 450);
      return r.kind === 'delock-summon' ? 750 : 450;
    }

    // --- Placer ---
    function placerAnswer(c) {
      const isValid = q.valid.find((d) => eq(d.cell, c));
      q.ok = !!isValid;
      board.lock(true);
      q.valid.forEach((d) => board.mark(d.cell, 'option'));
      board.mark(c, isValid ? 'good' : 'bad');
      board.badge(c, isValid ? 'ok' : 'ko');
      let html = `<p>${isValid ? '✔' : '✘'} Placement : la bonne case est le <b>milieu</b> entre le Comte et le partenaire d'échange (écart pair sur les deux axes). Cases valides en pointillés verts.</p>`;
      const self = q.board.entities.find((e) => e.id === q.selfId);
      let r = null;
      let spot = isValid ? isValid.cell : null;
      if (!isValid) {
        if (!isFree(q.board, c) && !eq(c, self)) {
          html += '<p>Cette case est occupée ou bloquée : tu ne peux pas t’y placer.</p>';
        } else {
          const sim = { blocked: q.board.blocked, entities: q.board.entities.map((e) => (e.id === q.selfId ? Object.assign({}, e, { x: c.x, y: c.y }) : e)) };
          const rr = HB.resolveHitComte(sim, q.turn, q.selfId);
          html += `<p>Depuis cette case : ${OUTCOME_LABEL[rr.kind]}.</p>`;
          if (rr.kind === 'wipe' && HB.onMap(rr.dest)) board.cross(rr.dest);
          else if (HB.onMap(rr.dest)) board.mark(rr.dest, 'aim');
        }
        const best = q.valid.find((d) => d.partner.type === 'ally') || q.valid[0];
        spot = best.cell;
        board.badge(spot, 'ok');
      }
      const best = q.valid.find((d) => eq(d.cell, spot));
      const partner = best.partner.type === 'ally' ? 'allié' : 'monstre';
      html += best.partner.type === 'ally'
        ? '<p>Préfère l’échange avec un <b>allié</b> : il gagne +100 dommages pour 1 tour.</p>'
        : '<p>Ici l’échange se fait avec un monstre.</p>';
      if (q.board.entities.some((e) => e.type === 'summon')) html += '<p class="muted">Piège : ne te place jamais pour échanger avec une invocation alliée.</p>';
      board.moveEntity(q.selfId, spot);
      self.x = spot.x;
      self.y = spot.y;
      r = HB.resolveHitComte(q.board, q.turn, q.selfId);
      q.notes = html;
      q.shortNotes = isValid ? `Milieu Comte ↔ ${partner} : échange` : `Place-toi au milieu Comte ↔ ${partner}`;
      if (q.type === 'placer') {
        board.arrow(spot, r.dest, 'ok');
        later(() => animate(r, q.selfId), 500);
        finish(q.ok, { short: q.shortNotes, html }, 'placer', 500 + 450);
      } else {
        startConfusionStep(spot, r);
      }
    }

    // --- Delock complet : étape confusion ---
    function startConfusionStep(spot, r) {
      const hp = genHp();
      const adj = HB.dist(spot, q.comte) === 1;
      const m = pick([0, 0, 0, 1, 1, 2]);
      const base = HB.confusionFromHp(hp);
      const k = HB.effectiveConfusion(base, m);
      const aim = HB.aimCell(spot, q.comte, k);
      const possible = !HB.isBlocked(q.board, aim);
      Object.assign(q, { step: 'aim', hp, m, base, k, aim, possible, spot, r, adj });
      ui.hpRow.hidden = false;
      ui.hp.textContent = hp + ' %';
      meleeChip(ui.melee, m, true);
      ui.state.textContent = `Comte invulnérable. Vitalité ${hp} %` + (m ? `, ${m} ligne${m > 1 ? 's' : ''} au càc` : '');
      ui.prompt.innerHTML = `<span class="pre ${q.ok ? 'ok' : 'ko'}">${q.ok ? '✔ Bien placé' : '✘ Mal placé (corrigé)'}</span>Vise le Comte`;
      ui.impossible.hidden = false;
      ui.impossible.disabled = false;
      later(() => {
        board.clearMarks();
        board.mark(q.comte, 'zone pulse');
        board.lock(false);
      }, 550);
    }

    function aimAnswer(c, sayImpossible) {
      q.step = 'done';
      board.lock(true);
      ui.impossible.disabled = true;
      const ok = sayImpossible ? !q.possible : q.possible && eq(c, q.aim);
      const ex = confExplain(q);
      let html = q.notes + `<p>${ok ? '✔' : '✘'} Frappe :</p>` + ex.html;
      let short = (q.ok ? '' : 'Placement raté · ') + ex.short;
      if (q.possible) {
        board.mark(q.aim, ok ? 'good' : 'aim');
        board.arrow(q.spot, q.aim, 'aim');
        board.badge(q.aim, 'ok');
        html += `<p>Pour toucher le Comte, ${INV_HINT[q.k]}.</p>`;
      } else {
        html += `<p>La case à viser est ${blockedName(q.board, q.aim)} → échec critique : il fallait répondre « Impossible » (et se replacer).</p>`;
        short += ' · visée bloquée → Impossible';
        if (HB.onMap(q.aim)) {
          board.cross(q.aim);
          board.badge(q.aim, 'ec');
        }
      }
      board.arc(q.spot, q.aim, q.k);
      if (!sayImpossible && !ok) {
        board.mark(c, 'bad');
        board.badge(c, 'ko');
        board.arrow(q.spot, HB.landing(q.spot, c, q.k), 'shot');
      }
      if (q.adj) html += '<p class="muted">Tu frappes au càc : après ce coup, ta confusion tournera de −90° par ligne de dégâts.</p>';
      if (ok) later(() => animate(q.r, q.selfId), 400);
      finish(q.ok && ok, { short, html }, 'complet', ok ? 400 + 450 : 250);
    }

    function finish(ok, fb, sub, delay) {
      q.answered = true;
      q.doneAt = performance.now();
      const ms = timer.stop();
      board.lock(true);
      ui.offmap.disabled = true;
      record('delock-' + q.type, ok, ms, sub);
      setNextReady(ui.next, true);
      renderStats(ui.stats, 'delock-' + q.type, kindLabel);
      updateMini();
      // le verdict arrive après l'animation du plateau
      later(() => {
        flash(ok);
        showFeedback(ui.feedback, ui.prompt, ok, ms, fb.short, fb.html);
        if (ok) Auto.start(1400, next);
      }, delay || 0);
    }

    function onCell(c) {
      if (!q || q.answered) return;
      if (q.type === 'predire' && q.step === 'mark') predireMark(c, false);
      else if ((q.type === 'placer' || q.type === 'complet') && q.step === 'place') placerAnswer(c);
      else if (q.type === 'complet' && q.step === 'aim') aimAnswer(c, false);
    }

    function offmap() {
      if (q && q.type === 'predire' && q.step === 'mark') predireMark(null, true);
    }
    function impossible() {
      if (q && q.step === 'aim' && !ui.impossible.hidden && !ui.impossible.disabled) aimAnswer(null, true);
    }
    function updateMini() {
      const name = 'delock-' + (q ? q.type : 'predire');
      if (current === 'delock') miniStats(bucket(name), name);
    }

    $$('button', ui.outcomes).forEach((b) => b.addEventListener('click', () => predireOutcome(b.dataset.o)));
    ui.offmap.addEventListener('click', offmap);
    ui.impossible.addEventListener('click', impossible);
    ui.next.addEventListener('click', next);

    return {
      next,
      timer,
      updateMini,
      typeLabel: () => ({ predire: 'Prédire la frappe', placer: 'Se placer', complet: 'Delock complet' }[q ? q.type : 'predire']),
      renderStats: () => renderStats(ui.stats, 'delock-' + (q ? q.type : 'predire'), kindLabel),
      resetStats() {
        ['delock-predire', 'delock-placer', 'delock-complet'].forEach((n) => delete stats[n]);
        store.set(STATS_KEY, stats);
        renderStats(ui.stats, 'delock-' + (q ? q.type : 'predire'), kindLabel);
        updateMini();
      },
      key(e) {
        if (!q) return;
        if (q.answered && (e.code === 'Space' || e.key === 'Enter')) {
          e.preventDefault();
          next();
        } else if (q.step === 'outcome' && /^[1-5]$/.test(e.key)) {
          predireOutcome($$('button', ui.outcomes)[+e.key - 1].dataset.o);
        } else if (e.key === 'h' || e.key === 'H') {
          offmap();
        } else if (e.key === 'i' || e.key === 'I') {
          impossible();
        }
      },
      init() {
        next();
        renderStats(ui.stats, 'delock-' + q.type, kindLabel);
      },
    };
  })();

  // ---------- onglets ----------
  let current = 'confusion';
  const tabBtns = $$('.tabs button[data-tab]');
  function switchTab(name) {
    if (name !== 'confusion' && name !== 'delock') return;
    Auto.cancel();
    current = name;
    document.body.dataset.tab = name;
    tabBtns.forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === name)));
    $$('.stage .tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + name));
    syncModeSelect();
    (name === 'confusion' ? Conf : Delock).updateMini();
  }
  tabBtns.forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // ---------- sélecteur d'exercice (select en pile) ----------
  const modeSelect = $('#mode-select');
  const modeSeg = () => $(`.seg-mode[data-for="${current}"]`);
  function syncModeSelect() {
    const seg = modeSeg();
    const btns = $$('button', seg);
    modeSelect.innerHTML = '';
    btns.forEach((b) => {
      const o = document.createElement('option');
      o.value = b.dataset.v;
      o.textContent = b.title || b.textContent;
      modeSelect.appendChild(o);
    });
    const on = btns.find((b) => b.classList.contains('on'));
    if (on) modeSelect.value = on.dataset.v;
  }
  modeSelect.addEventListener('change', () => {
    const b = $(`button[data-v="${modeSelect.value}"]`, modeSeg());
    if (b) b.click();
    modeSelect.blur();
  });
  function cycleMode() {
    const btns = $$('button', modeSeg());
    const i = btns.findIndex((b) => b.classList.contains('on'));
    btns[(i + 1) % btns.length].click();
  }

  // ---------- dialogs ----------
  const popOpts = $('#pop-opts');
  const popStats = $('#pop-stats');
  const fiche = $('#tab-fiche');
  const btnOpts = $('#btn-opts');
  const btnStats = $('#btn-stats');
  const btnFiche = $('#btn-fiche');
  let dialogOrigin = null;

  function placePop(dlg, btn) {
    if (!deskMQ.matches || dlg === fiche) {
      dlg.style.cssText = deskMQ.matches || dlg === fiche ? '' : 'margin:auto auto 0;width:100%;max-width:100%;border-radius:16px 16px 0 0;max-height:85dvh;overflow:auto;';
      return;
    }
    const r = btn.getBoundingClientRect();
    const w = dlg.offsetWidth;
    const h = dlg.offsetHeight;
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    dlg.style.cssText = `margin:0;position:fixed;left:${left}px;top:${top}px;max-height:calc(100dvh - 16px);overflow:auto;`;
  }
  function openDialog(dlg, btn) {
    if (dlg.open) return;
    $$('dialog[open]').forEach((d) => d.close());
    Auto.cancel();
    dialogOrigin = btn;
    btn.setAttribute('aria-expanded', 'true');
    Conf.timer.pause();
    Delock.timer.pause();
    if (dlg === popStats) {
      Conf.renderStats();
      Delock.renderStats();
      $('.stats-mode', popStats).textContent = '· ' + (current === 'confusion' ? Conf : Delock).typeLabel();
      $('.confirm', popStats).hidden = true;
    }
    dlg.showModal();
    placePop(dlg, btn);
  }
  [popOpts, popStats, fiche].forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) {
        // clic sur le fond (hors de la boîte)
        const r = dlg.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) dlg.close();
      }
    });
    dlg.addEventListener('close', () => {
      Conf.timer.resume();
      Delock.timer.resume();
      if (dialogOrigin) {
        dialogOrigin.setAttribute('aria-expanded', 'false');
        dialogOrigin.focus({ preventScroll: true });
      }
      dialogOrigin = null;
    });
  });
  $('.close', fiche).addEventListener('click', () => fiche.close());
  btnOpts.addEventListener('click', () => openDialog(popOpts, btnOpts));
  btnStats.addEventListener('click', () => openDialog(popStats, btnStats));
  btnFiche.addEventListener('click', () => openDialog(fiche, btnFiche));

  // réinitialisation avec confirmation inline
  let resetTarget = null;
  ['c', 'd'].forEach((p) =>
    $(`#${p}-reset`).addEventListener('click', () => {
      resetTarget = p;
      $('.confirm', popStats).hidden = false;
      $('.confirm [data-confirm="no"]', popStats).focus();
    })
  );
  $$('.confirm [data-confirm]', popStats).forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.confirm === 'yes') (resetTarget === 'c' ? Conf : Delock).resetStats();
      $('.confirm', popStats).hidden = true;
    })
  );

  // ---------- clavier ----------
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (document.querySelector('dialog[open]')) return;
    const k = e.key;
    const lk = k.length === 1 ? k.toLowerCase() : k;
    if (lk === 't') switchTab(current === 'confusion' ? 'delock' : 'confusion');
    else if (lk === 'm') cycleMode();
    else if (lk === 'o') openDialog(popOpts, btnOpts);
    else if (lk === 's') openDialog(popStats, btnStats);
    else if (lk === 'f' || k === '?') openDialog(fiche, btnFiche);
    else if (lk === 'p') {
      const d = $(`#${current === 'confusion' ? 'c' : 'd'}-feedback details`);
      if (d) d.open = !d.open;
    } else if (current === 'confusion') Conf.key(e);
    else Delock.key(e);
  });

  // ---------- disposition ----------
  function applyLayout() {
    const par = deskMQ.matches ? 'xMidYMid meet' : 'xMidYMax meet';
    $$('.board').forEach((s) => s.setAttribute('preserveAspectRatio', par));
  }
  (deskMQ.addEventListener ? deskMQ.addEventListener.bind(deskMQ, 'change') : deskMQ.addListener.bind(deskMQ))(applyLayout);

  applyShape();
  (portraitMQ.addEventListener ? portraitMQ.addEventListener.bind(portraitMQ, 'change') : portraitMQ.addListener.bind(portraitMQ))(() => {
    if (applyShape()) {
      Conf.next();
      Delock.next();
    }
  });
  applyTheme();
  applyTimer();
  markDirty();
  applyLayout();
  syncModeSelect();
  Conf.init();
  Delock.init();
  Conf.updateMini();
})();
