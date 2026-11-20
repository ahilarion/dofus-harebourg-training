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
  const CELLS = HB.allCells();

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
  function createBoard(svg, onCell) {
    svg.innerHTML = '';
    const gCells = el('g', {}, svg);
    const gMarks = el('g', {}, svg);
    const gEnts = el('g', {}, svg);
    const gOver = el('g', {}, svg);
    const cellEls = new Map();
    const entEls = new Map();
    let locked = false;
    let hovered = null;

    svg.addEventListener('click', (e) => {
      const t = e.target.closest('[data-x]');
      if (!t || locked) return;
      onCell({ x: +t.dataset.x, y: +t.dataset.y });
    });
    svg.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-x]');
      if (hovered) hovered.classList.remove('hover');
      hovered = null;
      if (!t || locked) return;
      const c = cellEls.get(t.dataset.x + ',' + t.dataset.y);
      if (c && !c.classList.contains('trou')) {
        c.classList.add('hover');
        hovered = c;
      }
    });
    svg.addEventListener('pointerleave', () => {
      if (hovered) hovered.classList.remove('hover');
      hovered = null;
    });

    function entityNode(e) {
      const asset = e.asset;
      const big = e.type === 'comte' || e.type === 'monster';
      const p = scr(e);
      const g = el('g', { class: 'ent ' + e.type, 'data-x': e.x, 'data-y': e.y });
      g.style.transform = `translate(${p.x}px, ${p.y}px)`;
      el('ellipse', { class: 'base', cx: 0, cy: 0, rx: 21, ry: 10.5 }, g);
      if (e.type === 'comte') el('ellipse', { class: 'ring', cx: 0, cy: 0, rx: 25, ry: 12.5 }, g);
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

    return {
      render(board) {
        gCells.innerHTML = '';
        gMarks.innerHTML = '';
        gEnts.innerHTML = '';
        gOver.innerHTML = '';
        cellEls.clear();
        entEls.clear();
        for (const c of CELLS) {
          const b = board.blocked.get(key(c));
          const cls = 'cell' + (c.x % 2 === 0 ? ' alt' : '') + (b === 'trou' ? ' trou' : '');
          const poly = el('polygon', { class: cls, points: diamond(c), 'data-x': c.x, 'data-y': c.y }, gCells);
          cellEls.set(key(c), poly);
        }
        const drawables = [];
        for (const [k, v] of board.blocked) {
          if (v !== 'pilier') continue;
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
        el('line', { class: 'arrow ' + cls, x1: p.x + ux * 10, y1: p.y + uy * 10, x2: ex, y2: ey }, gOver);
        const s = 9;
        const pts = [
          [q.x, q.y],
          [ex - ux * s + -uy * s * 0.6, ey - uy * s + ux * s * 0.6],
          [ex - ux * s - -uy * s * 0.6, ey - uy * s - ux * s * 0.6],
        ];
        const color = getComputedStyle(svg).getPropertyValue(cls === 'aim' ? '--aim' : cls === 'ok' ? '--ok' : '--ko');
        el('polygon', { points: pts.map((x) => x.join(',')).join(' '), fill: color.trim(), 'pointer-events': 'none' }, gOver);
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
        n.dataset.x = c.x;
        n.dataset.y = c.y;
      },
      kill(id) {
        const n = entEls.get(id);
        if (n) n.classList.add('dead');
      },
      lock(v) {
        locked = v;
        svg.style.cursor = v ? 'default' : '';
        if (v && hovered) {
          hovered.classList.remove('hover');
          hovered = null;
        }
      },
    };
  }

  // ---------- génération commune ----------
  function genBlocked(holes, pillars) {
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
  function chip(k) {
    return `<span class="chip k${k}">${HB.CONF_LABELS[k]}</span>`;
  }
  function confExplain(hp, m, base, k) {
    const t = HB.tranche(hp);
    let s = `<p>Vitalité ${hp} % (tranche ${t.max} → ${t.min} %) → ${chip(base)}.</p>`;
    if (m > 0) {
      s += `<p>${m} ligne${m > 1 ? 's' : ''} de dégâts au càc → −${m * 90}° (anti-horaire) → confusion effective ${chip(k)}.</p>`;
    }
    return s;
  }
  function meleeText(m, enabled) {
    if (!enabled) return 'désactivée';
    return m === 0 ? 'aucune ligne au càc ce tour' : `${m} ligne${m > 1 ? 's' : ''} déjà au càc`;
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
  function renderStats(container, name, subLabel) {
    const b = bucket(name);
    const pct = b.n ? Math.round((100 * b.ok) / b.n) + ' %' : '—';
    const avg = b.n ? (b.time / b.n / 1000).toFixed(1) + ' s' : '—';
    let weak = '';
    const subs = Object.entries(b.by).filter(([, s]) => s.n >= 3);
    if (subs.length) {
      subs.sort((a, b2) => a[1].ok / a[1].n - b2[1].ok / b2[1].n);
      const [w, s] = subs[0];
      if (s.ok < s.n) weak = `<div class="weak">Point faible : <b>${subLabel(w)}</b> (${Math.round((100 * s.ok) / s.n)} % sur ${s.n})</div>`;
    }
    container.innerHTML =
      `<div class="stat"><b>${pct}</b><small>Réussite</small></div>` +
      `<div class="stat"><b>${b.streak}</b><small>Série</small></div>` +
      `<div class="stat"><b>${b.best}</b><small>Record</small></div>` +
      `<div class="stat"><b>${avg}</b><small>Temps moy.</small></div>` +
      weak;
  }

  // ---------- options ----------
  const opts = Object.assign(
    { cMode: 'taper', cAlign: 'libre', cMelee: 'on', cImpossible: 'on', dMode: 'predire' },
    store.get('hbt-opts', {})
  );
  $$('.seg[data-opt]').forEach((seg) => {
    const name = seg.dataset.opt;
    $$('button', seg).forEach((b) => {
      b.classList.toggle('on', b.dataset.v === opts[name]);
      b.addEventListener('click', () => {
        opts[name] = b.dataset.v;
        store.set('hbt-opts', opts);
        $$('button', seg).forEach((x) => x.classList.toggle('on', x === b));
        if (name[0] === 'c') Conf.next();
        else Delock.next();
      });
    });
  });

  // ---------- chrono ----------
  function makeTimer(node) {
    let start = 0;
    let raf = 0;
    const tick = () => {
      node.textContent = ((performance.now() - start) / 1000).toFixed(1) + ' s';
      raf = requestAnimationFrame(tick);
    };
    return {
      start() {
        cancelAnimationFrame(raf);
        start = performance.now();
        tick();
      },
      stop() {
        cancelAnimationFrame(raf);
        const ms = performance.now() - start;
        node.textContent = (ms / 1000).toFixed(1) + ' s';
        return ms;
      },
    };
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
    };
    const timer = makeTimer($('#c-timer'));
    const board = createBoard(ui.svg, onCell);
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
        const target = chance(0.3) ? addEnt(b, 'comte', tgt, COMTE) : addEnt(b, 'monster', tgt, pick(MONSTERS));
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
      return { type: 'quiz', hp, m, base, k: HB.effectiveConfusion(base, m), board: { blocked: new Map(), entities: [] } };
    }

    function next() {
      const meleeOn = opts.cMelee === 'on';
      let type = opts.cMode;
      if (type === 'mixte') type = pick(['taper', 'taper', 'taper', 'marquer', 'marquer', 'quiz']);
      q = type === 'taper' ? genTaper(meleeOn) : type === 'marquer' ? genMarquer(meleeOn) : genQuiz(meleeOn);
      q.answered = false;

      board.render(q.board);
      board.clearMarks();
      board.lock(type === 'quiz');
      ui.quiz.classList.toggle('hidden', type !== 'quiz');
      $$('button', ui.quiz).forEach((b) => {
        b.disabled = false;
        b.classList.remove('good', 'bad');
      });
      ui.hp.textContent = q.hp + '%';
      ui.hpLabel.textContent = q.hp + ' % PV';
      ui.melee.textContent = meleeText(q.m, meleeOn);
      ui.feedback.innerHTML = '';
      ui.impossible.classList.toggle('hidden', type !== 'taper' || opts.cImpossible !== 'on');
      ui.impossible.disabled = false;

      if (type === 'taper') {
        board.mark(q.tgt, 'zone');
        ui.prompt.innerHTML = `<b>Taper :</b> clique la case à viser pour toucher ${q.target.type === 'comte' ? 'le Comte' : 'le ' + q.target.asset.name} (case orange).`;
      } else if (type === 'marquer') {
        board.mark(q.click, 'click');
        ui.prompt.innerHTML = '<b>Marquer :</b> tu lances ton sort sur la case bleue. Marque la case où il arrive vraiment.';
      } else {
        ui.prompt.innerHTML = '<b>Lire la confusion :</b> réponds avec 1-4 ou en cliquant.';
      }
      timer.start();
    }

    function finish(ok, html) {
      q.answered = true;
      const ms = timer.stop();
      board.lock(true);
      ui.impossible.disabled = true;
      record('conf-' + q.type, ok, ms, String(HB.TRANCHES.indexOf(HB.tranche(q.hp))));
      ui.feedback.innerHTML = `<div class="verdict ${ok ? 'ok' : 'ko'}">${ok ? '✔ Bien joué' : '✘ Raté'}</div>` + html;
      renderStats(ui.stats, 'conf-' + q.type, trancheLabel);
    }

    function answerTaper(c, sayImpossible) {
      const ok = sayImpossible ? !q.possible : q.possible && eq(c, q.aim);
      let html = confExplain(q.hp, q.m, q.base, q.k);
      board.clearMarks();
      board.mark(q.tgt, 'zone');
      if (q.possible) {
        board.mark(q.aim, ok ? 'good' : 'aim');
        board.arrow(q.me, q.aim, 'aim');
        board.arrow(q.me, q.tgt, 'ok');
        html += `<p>Pour toucher la cible, ${INV_HINT[q.k]} : <b>case bleue</b>.</p>`;
      } else {
        html += `<p>La case à viser est ${blockedName(q.board, q.aim)} : le sort ferait un <b>échec critique</b>. Bonne réponse : « Impossible ».</p>`;
        if (HB.onMap(q.aim)) {
          board.mark(q.aim, 'bad');
          board.cross(q.aim);
        }
      }
      if (!sayImpossible && !ok) {
        board.mark(c, 'bad');
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
      finish(ok, html);
    }

    function answerMarquer(c) {
      const ok = eq(c, q.land);
      let html = confExplain(q.hp, q.m, q.base, q.k);
      board.clearMarks();
      board.mark(q.click, 'click');
      board.mark(q.land, 'good');
      if (!ok) board.mark(c, 'bad');
      board.arrow(q.me, q.click, 'aim');
      board.arrow(q.me, q.land, 'ok');
      const dir = ['ne bouge pas', 'tourne de 90° horaire', 'part à l’opposé (180°)', 'tourne de 90° anti-horaire'][q.k];
      html += `<p>Le sort ${dir} autour de toi : il arrive sur la <b>case verte</b>.</p>`;
      finish(ok, html);
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
      finish(ok, confExplain(q.hp, q.m, q.base, q.k));
    }

    $$('button', ui.quiz).forEach((b) => b.addEventListener('click', () => answerQuiz(+b.dataset.k)));
    ui.impossible.addEventListener('click', () => q && !q.answered && q.type === 'taper' && answerTaper(null, true));
    ui.next.addEventListener('click', next);
    $('#c-reset').addEventListener('click', () => {
      ['conf-taper', 'conf-marquer', 'conf-quiz'].forEach((n) => delete stats[n]);
      store.set(STATS_KEY, stats);
      renderStats(ui.stats, 'conf-' + (q ? q.type : 'taper'), trancheLabel);
    });

    return {
      next,
      key(e) {
        if (!q) return;
        if (q.answered && (e.code === 'Space' || e.key === 'Enter')) {
          e.preventDefault();
          next();
        } else if (!q.answered && q.type === 'quiz' && /^[1-4]$/.test(e.key)) {
          answerQuiz(+e.key - 1);
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
  const outcomeOf = (r) => r.kind;

  const Delock = (() => {
    const ui = {
      svg: $('#d-board'),
      turn: $('#d-turn b'),
      parity: $('#d-parity'),
      state: $('#d-state'),
      hpRow: $('#d-hp-row'),
      hp: $('#d-hp'),
      prompt: $('#d-prompt'),
      outcomes: $('#d-outcomes'),
      offmap: $('#d-offmap'),
      impossible: $('#d-impossible'),
      next: $('#d-next'),
      feedback: $('#d-feedback'),
      stats: $('#d-stats'),
    };
    const timer = makeTimer(document.createElement('span'));
    const board = createBoard(ui.svg, onCell);
    let q = null;
    const kindLabel = (k) =>
      ({ 'comte-tp': 'Comte téléporté', 'self-tp': 'toi téléporté', delock: 'delock', 'delock-summon': 'delock invocation', wipe: 'wipe', placer: 'placement', confusion: 'frappe confuse' }[k] || k);

    function baseBoard() {
      return { blocked: genBlocked(rand(3, 6), rand(4, 7)), entities: [] };
    }

    function genPredire() {
      for (let tries = 0; tries < 800; tries++) {
        const turn = rand(1, 8);
        const even = turn % 2 === 0;
        const desired = even ? pick(['comte-tp', 'delock', 'delock', 'delock-summon', 'wipe']) : pick(['self-tp', 'self-tp', 'wipe']);
        const b = baseBoard();
        const C = freeCell(b);
        const A = add(C, genOffset('libre', 5));
        if (!isFree(b, A) || eq(A, C)) continue;
        const comte = addEnt(b, 'comte', C, COMTE);
        addEnt(b, 'self', A, SELF, 'Toi');
        const dest = even ? HB.symmetric(A, C) : HB.symmetric(C, A);
        if (desired === 'wipe') {
          if (!HB.isBlocked(b, dest)) {
            if (!HB.onMap(dest) || HB.entityAt(b, dest) || chance(0.35)) continue;
            b.blocked.set(key(dest), pick(['trou', 'pilier']));
          }
        } else {
          if (!isFree(b, dest)) continue;
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
          return Math.abs(d) <= 5 && s >= 3 && s <= 17;
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
      ui.parity.textContent = q.turn % 2 === 0 ? 'pair — le Comte bouge' : 'impair — tu bouges';
      ui.state.textContent = 'Invulnérable';
      ui.hpRow.classList.add('hidden');
    }

    function next() {
      let type = opts.dMode;
      if (type === 'mixte') type = pick(['predire', 'predire', 'placer', 'complet']);
      q = type === 'predire' ? genPredire() : genPlacer(type === 'complet');
      q.answered = false;
      board.render(q.board);
      board.clearMarks();
      board.lock(false);
      setHeader();
      ui.feedback.innerHTML = '';
      ui.outcomes.classList.add('hidden');
      $$('button', ui.outcomes).forEach((b) => {
        b.disabled = false;
        b.classList.remove('good', 'bad');
      });
      ui.impossible.classList.add('hidden');
      ui.offmap.classList.toggle('hidden', type !== 'predire');
      ui.offmap.disabled = false;
      q.ok = true;
      q.notes = '';
      if (type === 'predire') {
        ui.parity.textContent = '?';
        ui.prompt.innerHTML = `<b>Tour ${q.turn}.</b> Tu frappes le Comte (1 ligne de dégâts). <b>Marque</b> la case d'arrivée de la téléportation.`;
      } else {
        ui.prompt.innerHTML = `<b>Tour ${q.turn} (pair).</b> Marque la case où te placer pour que ta frappe <b>delock</b> le Comte.`;
      }
      timer.start();
    }

    // --- Prédire ---
    function predireMark(c, offmapPressed) {
      const r = q.r;
      const destOn = HB.onMap(r.dest);
      const ok = offmapPressed ? !destOn : destOn && eq(c, r.dest);
      q.ok = ok;
      ui.offmap.disabled = true;
      board.lock(true);
      const even = q.turn % 2 === 0;
      ui.parity.textContent = even ? 'pair — le Comte bouge' : 'impair — tu bouges';
      if (destOn) board.mark(r.dest, ok ? 'good' : 'aim');
      if (!ok && c) board.mark(c, 'bad');
      const self = q.board.entities.find((e) => e.id === q.selfId);
      if (even) board.arrow(self, r.dest, 'aim');
      else board.arrow(q.comte, r.dest, 'aim');
      q.notes =
        `<p>${ok ? '✔' : '✘'} Case d'arrivée : ${even
          ? 'tour <b>pair</b> → le <b>Comte</b> passe de l’autre côté de <b>toi</b> (symétrie par rapport à toi)'
          : 'tour <b>impair</b> → <b>tu</b> passes de l’autre côté du <b>Comte</b> (symétrie par rapport au Comte)'}${destOn ? '' : ' — ici, hors de la carte'}.</p>`;
      ui.feedback.innerHTML = q.notes;
      q.step = 'outcome';
      ui.prompt.innerHTML = 'Que se passe-t-il ? (1-5)';
      ui.outcomes.classList.remove('hidden');
    }

    function predireOutcome(o) {
      if (q.step !== 'outcome') return;
      q.step = 'done';
      const r = q.r;
      const ok2 = o === r.kind;
      $$('button', ui.outcomes).forEach((b) => {
        b.disabled = true;
        if (b.dataset.o === r.kind) b.classList.add('good');
        else if (b.dataset.o === o) b.classList.add('bad');
      });
      const html = q.notes + `<p>${ok2 ? '✔' : '✘'} Résultat : ${OUTCOME_LABEL[r.kind]}.</p>` + explainResult(r);
      animate(r, q.selfId);
      finish(q.ok && ok2, html, r.kind);
    }

    function explainResult(r) {
      switch (r.kind) {
        case 'delock':
          return r.bonus
            ? '<p>L’allié échangé gagne <b>+100 dommages</b> pendant 1 tour : c’est lui qui doit taper fort.</p>'
            : '<p>Échange avec un monstre : ça marche aussi, le Comte perd son invulnérabilité.</p>';
        case 'delock-summon':
          return `<p>Échange avec une <b>invocation alliée</b> : tous les alliés à ≤ 3 cases de la position initiale du Comte meurent${r.killed.length ? ` (${r.killed.length} ici, zone orange)` : ' (aucun ici, zone orange)'}.</p>`;
        case 'wipe':
          return `<p>La case d'arrivée est ${r.offMap ? 'hors de la carte' : r.cause === 'trou' ? 'une case noire' : 'un obstacle'} : la rotation est impossible, le combat est perdu.</p>`;
        case 'comte-tp':
          return '<p>Case libre : le Comte change juste de place. Pour delock, il faut une entité sur la case d’arrivée.</p>';
        case 'self-tp':
          return '<p>Aux tours impairs, on ne peut pas delock : chaque coup te renvoie de l’autre côté du Comte.</p>';
        default:
          return '';
      }
    }

    function animate(r, attackerId) {
      const comte = q.board.entities.find((e) => e.type === 'comte');
      if (r.kind === 'wipe') {
        board.cross(r.dest);
        const cur = q;
        setTimeout(() => q === cur && cur.board.entities.filter((e) => e.type !== 'comte' && e.type !== 'monster').forEach((e) => board.kill(e.id)), 350);
        return;
      }
      if (r.kind === 'self-tp') {
        board.moveEntity(attackerId, r.dest);
        return;
      }
      if (r.kind === 'comte-tp') {
        board.moveEntity(comte.id, r.dest);
        return;
      }
      // delock : échange
      for (const c of HB.allCells()) if (r.kind === 'delock-summon' && HB.dist(c, comte) <= 3) board.mark(c, 'zone');
      board.moveEntity(comte.id, r.dest);
      board.moveEntity(r.swapWith.id, comte);
      ui.state.textContent = 'Vulnérable !';
      const cur = q;
      if (r.kind === 'delock-summon') setTimeout(() => q === cur && r.killed.forEach((e) => board.kill(e.id)), 450);
    }

    // --- Placer ---
    function placerAnswer(c) {
      const isValid = q.valid.find((d) => eq(d.cell, c));
      q.ok = !!isValid;
      board.lock(true);
      q.valid.forEach((d) => board.mark(d.cell, 'option'));
      board.mark(c, isValid ? 'good' : 'bad');
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
      }
      const best = q.valid.find((d) => eq(d.cell, spot));
      html += best.partner.type === 'ally'
        ? '<p>Préfère l’échange avec un <b>allié</b> : il gagne +100 dommages pour 1 tour.</p>'
        : '<p>Ici l’échange se fait avec un monstre.</p>';
      if (q.board.entities.some((e) => e.type === 'summon')) html += '<p class="muted">Piège : ne te place jamais pour échanger avec une invocation alliée.</p>';
      board.moveEntity(q.selfId, spot);
      self.x = spot.x;
      self.y = spot.y;
      r = HB.resolveHitComte(q.board, q.turn, q.selfId);
      q.notes = html;
      if (q.type === 'placer') {
        board.arrow(spot, r.dest, 'ok');
        const cur = q;
        setTimeout(() => q === cur && animate(r, cur.selfId), 500);
        finish(q.ok, html, 'placer');
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
      ui.feedback.innerHTML = q.notes;
      ui.hpRow.classList.remove('hidden');
      ui.hp.textContent = `${hp} % — ${meleeText(m, true)}`;
      ui.prompt.innerHTML = `<b>Étape 2 :</b> tu es en place, ${hp} % PV${m ? `, ${m} ligne${m > 1 ? 's' : ''} déjà au càc ce tour` : ''}. Clique la case à viser pour toucher le Comte.`;
      ui.impossible.classList.remove('hidden');
      ui.impossible.disabled = false;
      const cur = q;
      setTimeout(() => {
        if (q !== cur) return;
        board.clearMarks();
        board.mark(q.comte, 'zone');
        board.lock(false);
      }, 550);
    }

    function aimAnswer(c, sayImpossible) {
      q.step = 'done';
      board.lock(true);
      ui.impossible.disabled = true;
      const ok = sayImpossible ? !q.possible : q.possible && eq(c, q.aim);
      let html = q.notes + `<p>${ok ? '✔' : '✘'} Frappe :</p>` + confExplain(q.hp, q.m, q.base, q.k);
      if (q.possible) {
        board.mark(q.aim, ok ? 'good' : 'aim');
        board.arrow(q.spot, q.aim, 'aim');
        html += `<p>Pour toucher le Comte, ${INV_HINT[q.k]}.</p>`;
      } else {
        html += `<p>La case à viser est ${blockedName(q.board, q.aim)} → échec critique : il fallait répondre « Impossible » (et se replacer).</p>`;
      }
      if (!sayImpossible && !ok) {
        board.mark(c, 'bad');
        board.arrow(q.spot, HB.landing(q.spot, c, q.k), 'shot');
      }
      if (q.adj) html += '<p class="muted">Tu frappes au càc : après ce coup, ta confusion tournera de −90° par ligne de dégâts.</p>';
      const cur = q;
      if (ok) setTimeout(() => q === cur && animate(cur.r, cur.selfId), 400);
      finish(q.ok && ok, html, 'complet');
    }

    function finish(ok, html, sub) {
      q.answered = true;
      const ms = timer.stop();
      board.lock(true);
      ui.offmap.disabled = true;
      record('delock-' + q.type, ok, ms, sub);
      ui.feedback.innerHTML = `<div class="verdict ${ok ? 'ok' : 'ko'}">${ok ? '✔ Parfait' : '✘ Raté'}</div>` + html;
      renderStats(ui.stats, 'delock-' + q.type, kindLabel);
    }

    function onCell(c) {
      if (!q || q.answered) return;
      if (q.type === 'predire' && q.step === 'mark') predireMark(c, false);
      else if ((q.type === 'placer' || q.type === 'complet') && q.step === 'place') placerAnswer(c);
      else if (q.type === 'complet' && q.step === 'aim') aimAnswer(c, false);
    }

    $$('button', ui.outcomes).forEach((b) => b.addEventListener('click', () => predireOutcome(b.dataset.o)));
    ui.offmap.addEventListener('click', () => q && q.type === 'predire' && q.step === 'mark' && predireMark(null, true));
    ui.impossible.addEventListener('click', () => q && q.step === 'aim' && aimAnswer(null, true));
    ui.next.addEventListener('click', next);
    $('#d-reset').addEventListener('click', () => {
      ['delock-predire', 'delock-placer', 'delock-complet'].forEach((n) => delete stats[n]);
      store.set(STATS_KEY, stats);
      renderStats(ui.stats, 'delock-' + (q ? q.type : 'predire'), kindLabel);
    });

    return {
      next,
      key(e) {
        if (!q) return;
        if (q.answered && (e.code === 'Space' || e.key === 'Enter')) {
          e.preventDefault();
          next();
        } else if (q.step === 'outcome' && /^[1-5]$/.test(e.key)) {
          predireOutcome($$('button', ui.outcomes)[+e.key - 1].dataset.o);
        }
      },
      init() {
        next();
        renderStats(ui.stats, 'delock-' + q.type, kindLabel);
      },
    };
  })();

  // ---------- onglets & clavier ----------
  let current = 'confusion';
  $$('.tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      current = b.dataset.tab;
      $$('.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      $$('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + current));
    })
  );
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (current === 'confusion') Conf.key(e);
    else if (current === 'delock') Delock.key(e);
  });

  Conf.init();
  Delock.init();
})();
