# Checklists par lot

<!-- forged-by: forging-review-skill · 2026-09-23 · commit 577e06d · sources : docs/PLAN.md §3 §5 §7 §8, README.md, descriptions des PR -->

Dérivé de `docs/PLAN.md` §5 (lots), §3 (arborescence cible), §7 (risques), §8 (roadmap
v2+) et « Vérification de fin de v1 ». État au 2026-09-23. L'état des lots (livré, en
cours) se lit dans la feuille de route du README, pas ici.

**Le code fait foi.** Ces checklists décrivent ce que le plan attend ; si une PR contient
autre chose, c'est la PR qu'on lit et la checklist qu'on signale en « Hors périmètre »
pour rafraîchissement.

---

## Identifier le lot

Dans l'ordre :

1. Titre de la PR : `(lot N)` en fin de titre, convention des PR #1 à #4.
2. Corps de la PR : première ligne `## Lot N — …`.
3. Nom de branche : `clock-transport` → 1, `knob` → 2, `bass-voice` → 3,
   `accent-slide` → 4, `drums`, `rhythm`, `sidechain` → 5, `generator` → 6,
   `persistence`, `polish`, `finish` → 7.
4. Contenu : les fichiers créés pointent vers un lot via l'arborescence §3 (`synth/drums/`
   → 5, `generator/` → 6, `persistence/` → 7).

Pas de lot identifiable : c'est une PR « hors lot » (correctif, chore, docs, CI), voir la
section dédiée.

Une PR peut clore un lot ou n'en livrer qu'une partie : la description doit le dire. Un
lot livré en plusieurs PR n'est pas un défaut ; un lot annoncé clos alors qu'il manque un
item de « Livre » l'est.

---

## Convention de description de PR

Observée sur les PR #1 à #4, non versionnée dans `.github/` :

```markdown
## Lot N — <nom du lot>

### Contenu

- <une puce par élément livré, orientée comportement, cinq à sept puces>

### À écouter (ou « À essayer » pour un lot d'interface)

- <ce que l'auteur a vérifié à l'oreille ou au doigt, et que le reviewer doit refaire>

### Tests

<nombre> tests, dont <les plus significatifs>.
```

Titre : `type(scope): description in English (lot N)`, sans le verbe du commit. Scopes
vus : `project`, `clock`, `ui`, `synth` ; attendus : `pattern`, `drums`, `generator`,
`persistence`, `ci`, `docs`. Branches : `feature/<sujet-kebab>` pour un lot,
`chore/<sujet-kebab>` sinon. Merge par merge-commit. Une PR hors lot n'a pas de suffixe et
remplace « À écouter » et « Tests » par « Vérifications » et « À essayer ».

---

## Lots livrés

Les lots marqués « fait » dans le README ne reçoivent plus de checklist : une PR qui
retouche leur code est une PR hors lot, ou fait partie du lot en cours. Appliquer alors
les invariants du domaine touché, en particulier, pour la voix basse, C3, C4, C6, C11 et
C12, et relire les décisions du lot concerné dans PLAN §5.

À écouter quand une PR touche la voix basse : phrasé acid du pattern par défaut ; slide du
pas 16 vers le pas 1 au premier play ; chaîne de slides à travers des silences ; shuffle
maximal à tempo élevé avec slide vers un pas impair ; accent avec résonance au maximum ;
knob résonance tourné pendant une ligne accentuée ; stop en plein slide ou sur un accent.

## Lot 5 — Rythmique et sidechain

- Livre : `synth/drums/noise.ts` (buffer généré une fois), `kick.ts` (sinus + enveloppe
  de pitch), `clap.ts` (bruit filtré + rafale + queue), `hihat.ts` (bruit passe-haut,
  decay court/long, choke), `drum-plan.ts` pur ; nœuds source **par frappe** arrêtés à
  `t + durée` ; `sidechain.ts` (GainNode sur le bus basse, `SIDECHAIN_ATTACK_S`,
  `SIDECHAIN_RELEASE_S`, profondeur = amount) ; `DrumGrid.svelte`, `DrumPanel.svelte`
  (mute, niveau) ; interrupteur + knob sidechain dans le transport ; `mix` complet
  (basse, rythmique, master) ; commandes `pattern/setDrumVelocity`, `drums/setMuted`,
  `drums/setLevel`, `transport/setSidechain`.
- Hypothèses : H7 (vélocité continue, clic = toggle, drag = fin), H8 (choke), H9 (trois
  niveaux), décision « Sidechain : interrupteur + amount ; attaque et retour en
  constantes ».
- Risques §7 : nœuds source non réutilisables (C5), rampes vers 0 (C2), `safeTime` (B2),
  fake à étendre (`FakeBufferSourceNode`, `stop`, `ended`, `timeConstant`).
- Tests : `drum-plan.ts`, partie pure de `sidechain.ts`, drums contre le fake (un nœud par
  frappe, `stop` appelé, pas de référence gardée), `DrumGrid.svelte` sous happy-dom,
  `state.test.ts` pour les nouvelles commandes.
- À écouter : le groove complet ; la basse qui « pompe » sous le kick ; hat ouvert coupé
  par le fermé ; mute instantané sans clic.
- Vigilance : timbres fixés par constantes (pas de knobs de timbre) ; la grille lit le
  même `audibleStep` que la basse (B4) ; le sidechain n'écrit que sur le bus basse ; la
  vélocité de la grille est un consommateur discret de `knobDrag` (E3) ; le choke du hat
  ouvert se décide d'après ce qui sonne, comme la liaison (C11) ; enveloppes de frappe et
  courbe de ducking en `setTargetAtTime` plutôt qu'en rampes (C2), avec des échéances
  qui tiennent dans le créneau d'un 16e impair (C12) ; `release` de chaque nouvelle voix
  appelé par `stop()` (C6).

## Lot 6 — Générateur de patterns

- Livre : `generator/rng.ts` seedable, `model/scales.ts` (mineure, phrygienne),
  `acid-generator.ts` pur (tonique au pas 0, notes dans la gamme, densités notes /
  accents / slides / sauts d'octave, heuristiques de plausibilité) ; commandes
  `generator/setParams`, `generator/run`, `generator/undo` avec `previousPattern` ;
  `GeneratorPanel.svelte`.
- Hypothèses : H6 (sauts d'octave, undo à un niveau).
- Tests : table §6.1 ligne `acid-generator.ts` ; reducer `generator/undo`.
- À écouter : une nouvelle ligne crédible à chaque pression, retour arrière possible.
- Vigilance : `Math.random` interdit hors `rng.ts` (déterminisme) ; le générateur ne
  touche pas aux drums en v1 sauf décision écrite.

## Lot 7 — Persistance, robustesse, finition

- Livre : `persistence/serialize.ts` versionné + `storage.ts` injectable ; sauvegarde
  debouncée, restauration au démarrage ; passe iOS / Safari réelle ; tests
  `OfflineAudioContext` dans `tests/browser/` ; mise en page desktop / tablette finale ;
  README complet avec capture et lien de démo.
- Risques §7 : iOS / Safari (C9), fuite de dépendance (A2).
- Tests : `serialize.ts`, §6.4 ; c'est aussi le moment du test de frontière `@engine` en
  node pur (§6.2) et du test du pont `engine.svelte.ts` (§6.3), tous deux encore absents.
- Vérification de fin de v1 (PLAN) : `pnpm verify` vert ; démo Pages jouable ; scénarios
  d'écoute (slide dernier → premier, chaîne de slides, accent seul, sidechain max, stop en
  plein slide) ; rechargement restaure pattern et knobs ; iPad Safari déblocage et reprise ;
  onglet caché 30 s puis retour en phase.

---

## Hors v1 : scope creep à signaler

Tout ceci est planifié pour plus tard. Une PR qui l'introduit sans mettre à jour le plan
sort du contrat :

- v2 : filtre en échelle en AudioWorklet, sélecteur biquad / ladder.
- v3 : banque de patterns à N slots, champ `length` sur `Pattern`, enregistrement par
  capture de commandes, chaînage de patterns.
- v4 : export WAV, partage par URL (`PersistedState` en base64url), Web MIDI.
- Jamais planifié : clavier musical, knobs de timbre pour les drums, routing configurable,
  optimisation mobile portrait.

---

## PR hors lot

Correctif, chore, docs, CI. Checklist minimale :

- Le problème corrigé est nommé et, s'il est reproductible, un test le capture d'abord.
- Le correctif vise la cause, sans refactor opportuniste.
- Les invariants des sections touchées (`invariants.md`) tiennent toujours.
- README et plan restent cohérents avec le code après la PR.

---

## Dette et points ouverts

Ils sont dans `docs/PLAN.md`, section « Dette et points ouverts ». Les signaler en « Hors
périmètre » quand une PR passe à côté, les suggérer quand elle touche le fichier, et ne
jamais les reprocher à une PR qui ne touche pas la ligne. Une PR qui en corrige un retire
sa ligne du plan : si elle ne le fait pas, c'est une Suggestion.

---

<!-- manual:start -->

## Ajouts manuels

Zone préservée par `/forging-review-skill --refresh`. Y noter les points ouverts tranchés
par l'auteur et les checklists d'écoute ajoutées au fil des lots, avec leur date.

<!-- manual:end -->
