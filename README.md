# acid-box

Synthétiseur basse « acid » monophonique jouable dans le navigateur, avec
séquenceur 16 pas et boîte à rythmes minimale. Tout est synthétisé en Web
Audio : aucun sample, aucun asset audio.

Le cœur du projet est le synthé basse et le plaisir de le jouer en direct au
knob. La rythmique est un accompagnement.

## Démarrer

```bash
pnpm install
pnpm dev
```

Vérifications (typecheck, lint, stylelint, tests) :

```bash
pnpm verify
```

## Principes d'architecture

**Le moteur ne connaît pas l'interface.** `src/engine/` possède son propre
état, expose une API de commandes et publie des snapshots immuables.
`src/ui/` (Svelte 5) envoie des commandes et lit ces snapshots. Une règle
ESLint interdit à `src/engine/` d'importer Svelte ou `src/ui/` ; un seul
fichier de l'interface instancie le moteur (`src/ui/state/engine.svelte.ts`).

**Aucun son n'est déclenché par un timer du navigateur.** Un scheduler à
lookahead programme à l'avance les événements sur l'horloge de
l'AudioContext ; ESLint interdit `setTimeout` et `setInterval` dans le
moteur, hors du worker qui réveille le scheduler.

**La tête de lecture affiche ce qui s'entend.** Le scheduler travaille dans
le futur ; une file d'événements programmés est comparée au temps courant de
l'AudioContext par une boucle d'animation pour afficher le pas audible.

**Tout le visuel passe par des tokens CSS.** `src/ui/theme/tokens.css` est
le seul fichier autorisé à contenir couleurs, rayons, espacements et
typographies en clair ; Stylelint refuse les littéraux ailleurs. Réhabiller
l'application ne touche pas aux composants.

**Ce qui décide est pur, ce qui touche Web Audio est mince.** Les calculs
de timing, d'enveloppes et de génération sont des fonctions pures testées en
node contre un faux AudioContext ; le rendu réel est vérifié à l'oreille et,
plus tard, par des tests hors ligne.

## Feuille de route

Le plan détaillé est dans [docs/PLAN.md](docs/PLAN.md).

| Lot | Contenu                                      | État |
| --- | -------------------------------------------- | ---- |
| 0   | Socle, outillage, déblocage audio, CI, Pages | fait |
| 1   | Horloge, transport, tête de lecture          | fait |
| 2   | Le knob et le geste                          | fait |
| 3   | La voix basse                                | fait |
| 4   | Accent et slide                              | fait |
| 5   | Rythmique et sidechain                       | fait |
| 6   | Générateur de patterns                       |      |
| 7   | Persistance, robustesse, finition            |      |

Versions ultérieures : filtre en échelle en AudioWorklet (v2), banque de
patterns et enregistrement (v3), export WAV, partage par URL et Web MIDI (v4).

## À écouter à chaque lot

- Pas de clic à l'arrêt ni au changement de forme d'onde ; aucune frappe ne part après le stop.
- Un mute ou un démute en lecture tombe sur le premier temps de la mesure suivante, sans clic ; l'interrupteur clignote en attendant.
- Pas de bruit de « zipper » quand on tourne un knob.
- Le curseur visuel tombe sur le pas que l'on entend, à 60 comme à 240 BPM.
