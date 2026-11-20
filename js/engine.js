/*
 * Harebourg Trainer — moteur de règles (pur, sans DOM).
 *
 * Repère : coordonnées de grille Dofus (x, y).
 *   - un pas en +x apparaît à l'écran vers le bas-droite,
 *   - un pas en +y apparaît à l'écran vers le bas-gauche.
 *   - "en ligne" = même x ou même y ; càc = distance de Manhattan 1.
 *
 * Confusion : k = nombre de quarts de tour dans le sens HORAIRE (à l'écran)
 * appliqués à la case ciblée, autour du lanceur.
 *   k=0 aucune, k=1 90° horaire, k=2 180°, k=3 90° anti-horaire (= 270° horaire).
 *
 * Sources : dofus-portals.fr, guidedofus.com, dofuspourlesnoobs.com (voir README).
 */
(function (root) {
  'use strict';

  // Tranches de vitalité (% PV en début de tour) -> confusion de base.
  const TRANCHES = [
    { min: 90, max: 100, k: 1 },
    { min: 75, max: 89, k: 3 },
    { min: 45, max: 74, k: 2 },
    { min: 30, max: 44, k: 3 },
    { min: 0, max: 29, k: 1 },
  ];

  const CONF_LABELS = ['Aucune (tir direct)', '90° horaire', '180°', '90° anti-horaire'];
  const CONF_SHORT = ['0°', '90° H', '180°', '90° AH'];

  const mod4 = (n) => ((n % 4) + 4) % 4;

  function clampHp(hp) {
    return Math.max(0, Math.min(100, Math.floor(hp)));
  }

  function tranche(hp) {
    const p = clampHp(hp);
    return TRANCHES.find((t) => p >= t.min && p <= t.max);
  }

  function confusionFromHp(hp) {
    return tranche(hp).k;
  }

  // Chaque ligne de dégâts infligée au càc d'un monstre fait pivoter la confusion
  // de 90° dans le sens anti-horaire.
  function effectiveConfusion(baseK, meleeLines) {
    return mod4(baseK - (meleeLines || 0));
  }

  // Rotation horaire (écran) d'un quart de tour : (dx, dy) -> (-dy, dx).
  function rotate(v, k) {
    let x = v.x;
    let y = v.y;
    for (let i = 0; i < mod4(k); i++) {
      const nx = -y;
      y = x;
      x = nx;
    }
    return { x: x + 0, y: y + 0 }; // +0 évite les -0
  }

  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const eq = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;
  const key = (c) => c.x + ',' + c.y;
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  // Où part réellement le sort quand on clique `click` avec la confusion k.
  function landing(caster, click, k) {
    return add(caster, rotate(sub(click, caster), k));
  }

  // Quelle case cliquer pour que le sort arrive sur `target`.
  function aimCell(caster, target, k) {
    return add(caster, rotate(sub(target, caster), 4 - mod4(k)));
  }

  // Symétrique de p par rapport à center (rotation de 180°).
  function symmetric(center, p) {
    return { x: 2 * center.x - p.x, y: 2 * center.y - p.y };
  }

  function alignment(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return 'meme';
    if (dx === 0 || dy === 0) return 'ligne';
    if (Math.abs(dx) === Math.abs(dy)) return 'diagonale';
    return 'libre';
  }

  // ---- Carte : rectangle "écran" façon Dofus ----
  // Cellule valide si |x - y| <= D et 0 <= x + y <= S.
  const MAP = { D: 7, S: 20 };

  function onMap(c) {
    const d = c.x - c.y;
    const s = c.x + c.y;
    return Math.abs(d) <= MAP.D && s >= 0 && s <= MAP.S;
  }

  function allCells() {
    const out = [];
    for (let s = 0; s <= MAP.S; s++) {
      for (let d = -MAP.D; d <= MAP.D; d++) {
        if ((s + d) % 2 !== 0) continue;
        out.push({ x: (s + d) / 2, y: (s - d) / 2 });
      }
    }
    return out;
  }

  /*
   * Plateau : { blocked: Map<key, 'trou'|'pilier'>, entities: [{id, type, x, y, name}] }
   * types : 'comte' | 'self' | 'ally' | 'summon' | 'monster'
   */
  function entityAt(board, c) {
    return board.entities.find((e) => e.x === c.x && e.y === c.y) || null;
  }

  function isBlocked(board, c) {
    return !onMap(c) || board.blocked.has(key(c));
  }

  /*
   * Résout une frappe (1 ligne de dégâts) sur le Comte par `attackerId`.
   * Tour impair : l'attaquant est téléporté symétriquement par rapport au Comte.
   * Tour pair   : le Comte est téléporté symétriquement par rapport à l'attaquant ;
   *               si une entité occupe la case d'arrivée -> échange + perte d'invulnérabilité.
   * Case d'arrivée bloquée (trou, obstacle, hors carte) -> toute l'équipe meurt.
   * Échange avec une invocation alliée -> les alliés à 3 cases ou moins de la
   * position initiale du Comte sont tués.
   */
  function resolveHitComte(board, turn, attackerId) {
    const comte = board.entities.find((e) => e.type === 'comte');
    const att = board.entities.find((e) => e.id === attackerId);
    const even = turn % 2 === 0;
    const mover = even ? 'comte' : 'self';
    const dest = even ? symmetric(att, comte) : symmetric(comte, att);

    if (isBlocked(board, dest)) {
      return { kind: 'wipe', mover, dest, offMap: !onMap(dest), cause: onMap(dest) ? board.blocked.get(key(dest)) : 'hors carte' };
    }
    const occ = entityAt(board, dest);
    if (!even) {
      if (occ) return { kind: 'self-tp-occupe', mover, dest, occupant: occ };
      return { kind: 'self-tp', mover, dest };
    }
    if (!occ) return { kind: 'comte-tp', mover, dest };
    if (occ.type === 'summon') {
      const killed = board.entities.filter(
        (e) => e !== occ && (e.type === 'self' || e.type === 'ally' || e.type === 'summon') && dist(e, comte) <= 3
      );
      return { kind: 'delock-summon', mover, dest, swapWith: occ, killed };
    }
    return { kind: 'delock', mover, dest, swapWith: occ, bonus: occ.type === 'ally' };
  }

  // Cases libres d'où frapper le Comte (tour pair) pour le delock sans invocation.
  function delockCells(board) {
    const comte = board.entities.find((e) => e.type === 'comte');
    const out = [];
    for (const c of allCells()) {
      if (board.blocked.has(key(c))) continue;
      const occ = entityAt(board, c);
      if (occ && occ.type !== 'self') continue;
      if (eq(c, comte)) continue;
      const dest = symmetric(c, comte);
      if (isBlocked(board, dest)) continue;
      const tgt = entityAt(board, dest);
      if (!tgt || tgt.type === 'self') continue;
      if (tgt.type === 'ally' || tgt.type === 'monster') out.push({ cell: c, partner: tgt });
    }
    return out;
  }

  const api = {
    TRANCHES,
    CONF_LABELS,
    CONF_SHORT,
    MAP,
    mod4,
    clampHp,
    tranche,
    confusionFromHp,
    effectiveConfusion,
    rotate,
    add,
    sub,
    eq,
    key,
    dist,
    landing,
    aimCell,
    symmetric,
    alignment,
    onMap,
    allCells,
    entityAt,
    isBlocked,
    resolveHitComte,
    delockCells,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HB = api;
})(typeof self !== 'undefined' ? self : this);
