// Lancer : node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const HB = require('../js/engine.js');

const V = { x: 5, y: 5 }; // "Vous"
const at = (dx, dy) => ({ x: V.x + dx, y: V.y + dy });

test('tranches de PV -> confusion (tableau des guides)', () => {
  const cases = [
    [100, 1], [90, 1],
    [89, 3], [75, 3],
    [74, 2], [45, 2],
    [44, 3], [30, 3],
    [29, 1], [1, 1], [0, 1],
  ];
  for (const [hp, k] of cases) assert.equal(HB.confusionFromHp(hp), k, hp + '%');
});

test('schéma 90° horaire en ligne : monstre haut-gauche -> taper bas-gauche', () => {
  // Haut-gauche à l'écran = -x ; bas-gauche = +y.
  const monstre = at(-3, 0);
  assert.deepEqual(HB.aimCell(V, monstre, 1), at(0, 3));
  assert.deepEqual(HB.landing(V, at(0, 3), 1), monstre);
});

test('schéma 90° horaire "autre" (dofus-portals / guidedofus)', () => {
  // Mesuré sur l'image : monstre (-3,-2), taper ici (-2,3).
  assert.deepEqual(HB.aimCell(V, at(-3, -2), 1), at(-2, 3));
});

test('schéma vita 90° horaire : monstre au-dessus -> taper à gauche', () => {
  // Au-dessus à l'écran = (-1,-1) ; à gauche = (-1,+1).
  assert.deepEqual(HB.aimCell(V, at(-1, -1), 1), at(-1, 1));
});

test('exemple càc : 90° H, monstre haut-droite, 2 lignes -> 90° AH', () => {
  const monstre = at(0, -1); // haut-droite
  assert.deepEqual(HB.aimCell(V, monstre, 1), at(-1, 0)); // haut-gauche (case bleue)
  const k2 = HB.effectiveConfusion(1, 2);
  assert.equal(k2, 3);
  assert.deepEqual(HB.aimCell(V, monstre, k2), at(1, 0)); // bas-droite
});

test('180° et aucune confusion', () => {
  assert.deepEqual(HB.aimCell(V, at(2, 1), 2), at(-2, -1));
  assert.deepEqual(HB.aimCell(V, at(2, 1), 0), at(2, 1));
});

test('aimCell et landing sont inverses', () => {
  for (let k = 0; k < 4; k++)
    for (let dx = -3; dx <= 3; dx++)
      for (let dy = -3; dy <= 3; dy++) {
        const t = at(dx, dy);
        assert.deepEqual(HB.landing(V, HB.aimCell(V, t, k), k), t);
      }
});

function board(entities, blocked = {}) {
  return { entities, blocked: new Map(Object.entries(blocked)) };
}

test('tour pair : le Comte passe de l\'autre côté de l\'attaquant', () => {
  const b = board([
    { id: 'c', type: 'comte', x: 6, y: 4 },
    { id: 'me', type: 'self', x: 6, y: 6 },
  ]);
  const r = HB.resolveHitComte(b, 2, 'me');
  assert.equal(r.kind, 'comte-tp');
  assert.deepEqual(r.dest, { x: 6, y: 8 });
});

test('tour impair : l\'attaquant passe de l\'autre côté du Comte', () => {
  const b = board([
    { id: 'c', type: 'comte', x: 6, y: 4 },
    { id: 'me', type: 'self', x: 6, y: 6 },
  ]);
  const r = HB.resolveHitComte(b, 3, 'me');
  assert.equal(r.kind, 'self-tp');
  assert.deepEqual(r.dest, { x: 6, y: 2 });
});

test('delock sur allié, sur invocation, et wipe', () => {
  const base = [
    { id: 'c', type: 'comte', x: 6, y: 4 },
    { id: 'me', type: 'self', x: 6, y: 6 },
  ];
  let r = HB.resolveHitComte(board([...base, { id: 'a', type: 'ally', x: 6, y: 8 }]), 4, 'me');
  assert.equal(r.kind, 'delock');
  assert.equal(r.bonus, true);

  r = HB.resolveHitComte(board([...base, { id: 'i', type: 'summon', x: 6, y: 8 }]), 4, 'me');
  assert.equal(r.kind, 'delock-summon');
  assert.deepEqual(r.killed.map((e) => e.id), ['me']); // attaquant à 2 cases du Comte

  r = HB.resolveHitComte(board(base, { '6,8': 'trou' }), 4, 'me');
  assert.equal(r.kind, 'wipe');
});

test('delockCells trouve le milieu Comte/partenaire', () => {
  const b = board([
    { id: 'c', type: 'comte', x: 6, y: 4 },
    { id: 'a', type: 'ally', x: 8, y: 8 },
  ]);
  const cells = HB.delockCells(b).map((d) => d.cell);
  assert.deepEqual(cells, [{ x: 7, y: 6 }]);
});
