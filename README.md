# Harebourg Trainer

Ce site statique sert à apprendre par cœur la stratégie du **Comte Harebourg** (Frigost 3, Dofus 3). Il ne s'installe pas et n'a pas de dépendances.

```bash
npm start           # sert le dossier sur http://localhost:8000 (python3)
npm test            # tests du moteur de règles (node >= 18)
```

Vous pouvez aussi ouvrir `index.html` directement dans un navigateur.

## Interface

Le plateau occupe tout l'écran disponible ; le reste de l'interface est réduit à l'essentiel.

- **Ordinateur (paysage)** : plateau à gauche, rail d'action de 300 px à droite (onglets, exercice, cœur % PV / mêlée ou tour / parité, consigne courte, réponses, Suivant).
- **Téléphone et écrans 4:3** : barre du haut (onglets, exercice en liste, stats, options, fiche), plateau, puis dock en bas (HUD, consigne, réponses).
- **Après une réponse**, le plateau montre le résultat en premier : liseré vert ou rouge, badges ✔ / ✘ / ÉC sur les cases, flèches, arc de rotation de la confusion autour de « Toi ». Le texte se limite au verdict et à une ligne ; le détail est replié derrière **Pourquoi ?**.
- **⚙ Options** : cible, mêlée, échecs critiques, enchaînement automatique si juste, chrono visible, thème (auto / clair / sombre).
- **Stats** : la mini-ligne « 84 % · série 7 » ouvre le détail (réussite, série, record, temps moyen, point faible, réinitialisation).
- **?** ouvre la fiche des règles (avec la légende des couleurs).

Raccourcis : `Espace` / `Entrée` suivant (ou tap sur le plateau), `1`–`4` confusion, `1`–`5` conséquence, `I` Impossible, `H` Hors carte, `P` Pourquoi ?, `T` onglet, `M` exercice, `O` options, `S` stats, `F` ou `?` fiche.

## Entraînement 1 : Confusions

Chaque question donne un **% de vitalité**, l'état de **mêlée** (lignes de dégâts déjà infligées au càc ce tour), **ta position** et celle de l'**ennemi**.

| Exercice | But |
|---|---|
| **Taper** | Cliquer la case à viser pour que le sort confus touche la cible. Si cette case est une case noire, un obstacle ou hors carte, répondre « Impossible ». Le jeu ferait alors un échec critique. |
| **Marquer** | Tu cliques la case bleue : marquer la case où le sort arrive vraiment. |
| **Lire la confusion** | À partir du % de PV et de la mêlée, donner la confusion (touches 1 à 4). |
| **Mixte** | Les trois exercices mélangés. |

Options : cible en ligne, en diagonale ou libre ; mêlée activée ou non ; cas « Impossible » activés ou non.

## Entraînement 2 : Delock

| Exercice | But |
|---|---|
| **Prédire la frappe** | Tour N, tu frappes le Comte : marquer la case d'arrivée de la téléportation, puis choisir la conséquence (touches 1 à 5). Conséquences possibles : téléportation, delock, delock sur une invocation, wipe. |
| **Se placer** | Tour pair : marquer la case où te placer pour que ta frappe échange le Comte avec un allié ou un monstre. |
| **Delock complet** | Se placer, puis viser le Comte malgré ta confusion. |

Les stats (réussite, série, temps moyen, point faible par tranche de PV) et les options sont gardées dans le `localStorage` du navigateur.

## Règles modélisées (`js/engine.js`)

**Confusion par % de vitalité en début de tour :**

| Vitalité | Confusion |
|---|---|
| 100 à 90 % | 90° horaire |
| 89 à 75 % | 90° anti-horaire |
| 74 à 45 % | 180° |
| 44 à 30 % | 90° anti-horaire |
| 29 à 0 % | 90° horaire |

**Autres règles :**

- **Mêlée** : chaque ligne de dégâts infligée depuis le càc d'un monstre fait tourner la confusion de −90° (anti-horaire). Le décalage s'applique aux coups suivants.
- **Tour impair** : chaque coup sur le Comte téléporte l'attaquant à la case symétrique, par rapport au Comte.
- **Tour pair** : chaque coup téléporte le Comte à la case symétrique, par rapport à l'attaquant. S'il y a une entité sur la case d'arrivée, elle échange sa place avec le Comte, qui perd son invulnérabilité. Un allié échangé gagne +100 dommages.
- **Échange avec une invocation alliée** : les alliés à 3 cases ou moins de la position initiale du Comte meurent.
- **Case d'arrivée bloquée** (case noire, obstacle, hors carte) : toute l'équipe meurt.

**Simplifications** : la ligne de vue, la portée des sorts et les PM ne sont pas simulés. La carte est générique, ce n'est pas la vraie salle du Comte.

## Sources

- https://dofus-portals.fr/donjons/donjon-du-comte-harebourg/
- https://guidedofus.com/v2/donjon-du-comte-harebourg (tableau des tranches de PV et schémas)
- https://www.dofuspourlesnoobs.com/donjon-du-comte-harebourg.html

Les tests (`tests/engine.test.js`) reproduisent les schémas de ces guides : 90° horaire en ligne, « autre », exemple au càc, symétries pair et impair.

## Crédits

Les visuels de `assets/` (Comte Harebourg, Cycloïde, Granduk, Sinistrofu, Strigide, icônes de sorts, têtes de classes) sont © Ankama Games et ont été récupérés via l'API DofusDB. Ce projet de fan n'est pas officiel et n'est pas affilié à Ankama.

## GitHub Pages

Le workflow `.github/workflows/pages.yml` lance les tests puis publie le site à chaque push.

Activation (une seule fois) : **Settings → Pages → Build and deployment → Source : GitHub Actions**, puis relancer le workflow depuis l'onglet **Actions**. Le site est alors servi sur `https://ahilarion.github.io/dofus-harebourg-training/`.
