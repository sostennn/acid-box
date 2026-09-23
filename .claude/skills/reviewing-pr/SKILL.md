---
name: reviewing-pr
description: >
  Revue de code d'une pull request GitHub d'acid-box, ou de la branche courante avant
  d'ouvrir sa PR, avec le contexte du projet : principes du README, hypothèses, lots,
  risques et stratégie de tests de docs/PLAN.md, garanties déjà apportées par ESLint,
  Stylelint et TypeScript strict. Utiliser dès que l'utilisateur demande une review, une
  revue, une relecture, un avis ou des commentaires sur une PR (numéro, URL
  github.com/sostennn/acid-box/pull/N, branche feature/*), sur « mes changements »,
  « avant de merger », « c'est mergeable ? », ou veut poster une review sur GitHub, même
  sans employer le mot review. Dans ce dépôt, prend le pas sur code-review et sur
  mr-craft:reviewing-mr. Arguments : [numéro | URL | branche] ; vide = branche courante
  contre origin/main.
argument-hint: '[numéro-PR | URL | branche]'
allowed-tools: Bash(gh:*) Bash(git:*) Bash(pnpm:*) Bash(jq:*) Bash(mktemp:*) Bash(cat:*) Read Grep Glob Write Agent
---

# Revue de PR — acid-box

Ce dépôt a un contrat écrit inhabituellement précis : cinq principes d'architecture dans le
README, douze hypothèses tranchées, un découpage en lots, une stratégie de tests module par
module et une table de risques Web Audio avec leurs parades dans `docs/PLAN.md`. Une bonne
revue ici ne relit pas du TypeScript en général : elle vérifie que la PR tient ce contrat,
et elle ne perd pas de temps sur ce que l'outillage garantit déjà.

Le reviewer ne peut pas écouter le résultat. Il le compense de deux façons : en vérifiant
que « ce qui décide » est pur et testé, et en listant explicitement ce que l'auteur doit
écouter avant de merger.

Argument : `$ARGUMENTS`.

---

## Posture

- Trois niveaux, jamais plus : **`[Bloquant]`** empêche le merge, **`[Suggestion]`** est
  souhaitable, **`[Nit]`** est du goût et ne bloque jamais. Chaque commentaire porte un
  problème précis, un argument concret et une alternative. Sans argument concret, c'est un
  Nit.
- Un finding sans source n'est pas un bloquant. La source est un invariant de
  `references/invariants.md`, une ligne de `docs/PLAN.md`, un principe du README, ou un
  bug démontrable avec une entrée concrète.
- Un bug démontrable est un bloquant même si aucun invariant ne le nomme, et même si
  l'invariant le plus proche est formellement respecté. Une unité fausse, un geste qui ne
  fait rien, une note avalée : ce sont des bugs, pas des questions de clarté.
- Une parade documentée du plan peut être contestée par une Suggestion argumentée. Elle ne
  se retourne jamais en Bloquant contre l'auteur qui la suit.
- Le code fait foi sur les références de ce skill. Un écart entre une checklist et le code
  est signalé en « Hors périmètre » avec une note de rafraîchissement, jamais reproché à
  la PR.
- Ne commenter que ce que la PR touche. Un écart préexistant hors du diff va dans la
  section « Hors périmètre » du rapport, jamais en commentaire inline.
- Jamais de « LGTM » nu, jamais d'approbation sans lecture du diff, jamais de correction
  du code à la place de l'auteur pendant la revue.
- CI rouge : bloquant Evidence, point final. Le debug de la pipeline n'est pas le travail
  du reviewer.

### Ce que l'outillage garantit déjà

Si la CI est verte, ces points sont acquis. Ne pas les revérifier, ne pas les commenter.

| Garanti par                                                                                                            | Ce que ça couvre                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck` (svelte-check + tsc, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnused*`) | Types, exhaustivité du `switch` du reducer, index de tableau possiblement `undefined`                                                                                                  |
| ESLint                                                                                                                 | Frontière `src/engine` → aucun import de `svelte` ni de `src/ui` ; `setTimeout`/`setInterval` interdits dans le moteur hors `timer.worker.ts` et tests                                 |
| Stylelint, sur `src/**/*.{css,svelte}`                                                                                 | Couleurs, rayons, `font-size`, `font-family`, espacements et `box-shadow` littéraux interdits hors `src/ui/theme/tokens.css` ; pas les attributs `style=` inline ni le CSS hors `src/` |
| Prettier                                                                                                               | Formatage, README et docs compris                                                                                                                                                      |
| Vitest + `tests/fakes`                                                                                                 | Ce que les tests couvrent ; `FakeAudioParam` lève sur une rampe exponentielle vers ≤ 0                                                                                                 |

Le travail du reviewer commence là où ce tableau s'arrête : `references/invariants.md`
liste précisément ce qui n'est pas couvert, et sa section C0 rappelle les unités et
sémantiques Web Audio qu'aucun outil ne vérifie.

---

## Étape 0 — Cible et mode

| `$ARGUMENTS`                                      | Mode                                                                                                              | Comparaison                                                                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| vide                                              | **local**                                                                                                         | branche courante contre `origin/main`, modifications non commitées incluses                                                                          |
| entier `N`                                        | **PR**                                                                                                            | base de la PR (`baseRefName`)                                                                                                                        |
| URL `https://github.com/sostennn/acid-box/pull/N` | **PR**                                                                                                            | idem                                                                                                                                                 |
| nom de branche `[A-Za-z0-9/_.-]+`                 | **PR** si `gh pr view <branche>` la trouve, sinon **local** sur `origin/main...<branche>` sans changer de branche |
| PR dont `state` vaut `MERGED`                     | **PR rétrospective**                                                                                              | premier parent du commit de merge ; le verdict devient une liste de correctifs à livrer avec le lot suivant, rien n'est posté sans demande explicite |

Toute autre forme : refuser avec un message clair, ne rien exécuter.

En mode PR, si `gh` n'est pas authentifié : dire « Lance `gh auth login` », proposer le
mode local, s'arrêter là pour le mode PR. Si la PR est en draft : le signaler, faire la
revue quand même, ne rien poster sans accord explicite.

Le mode local ne poste jamais rien : il sert à corriger avant d'ouvrir la PR.

---

## Étape 1 — Collecte

Tout en parallèle. Les commandes exactes sont dans `references/github.md`.

**Mode PR**

- Métadonnées : `gh pr view` en JSON (titre, corps, auteur, `state`, draft, `headRefOid`,
  `baseRefName`, `mergeCommit`, additions, suppressions, fichiers, `statusCheckRollup`).
- `git fetch origin pull/N/head` : `FETCH_HEAD` est la version revue. Puis la base :
  `BASE=$(git merge-base origin/<baseRefName> FETCH_HEAD)`, ou pour une PR fusionnée
  `BASE=$(git rev-parse <mergeCommit>^1)`.
- `git diff "$BASE" FETCH_HEAD --stat` et `--name-only`. Le diff complet n'est lu par
  l'orchestrateur que sans fan-out ; avec fan-out, chaque sous-agent lit le sien.
- **Ne jamais lire le worktree en mode PR** : il peut être sur une autre branche, avec des
  fichiers que la PR ne contient pas. Fichier complet : `git show FETCH_HEAD:<chemin>` ;
  numéro de ligne côté nouveau fichier : `git show FETCH_HEAD:<chemin> | grep -n '<extrait>'`.
- Commentaires de review déjà présents sur la PR, pour ne pas répéter ce qui a été dit.
- Login `gh` courant : si le reviewer est l'auteur de la PR, GitHub refusera
  `APPROVE` et `REQUEST_CHANGES` ; la review partira en `COMMENT`.

**Mode local**

- `git fetch origin main`, puis `BASE=$(git merge-base origin/main HEAD)`.
- `git diff "$BASE" --stat`, `git diff "$BASE"` (worktree inclus), `git log "$BASE"..HEAD --oneline`.
- Messages de commit : anglais, `type(scope): message`. Un écart est un Nit, pas plus.

**Taille** : au-delà de 400 lignes modifiées ou de trois domaines touchés, le fan-out de
l'étape 4 devient obligatoire. Au-delà de 2000, prévenir et proposer une revue en
plusieurs passes par domaine.

---

## Étape 2 — Contexte projet

1. Lire `references/invariants.md` **en entier**. C'est la mémoire du projet distillée
   pour la revue ; elle est courte à l'échelle d'une session et évite les faux positifs.
   Sa section C0 (unités Web Audio) et ses repères temporels servent à chaque finding qui
   compare des durées ou des unités.
2. Identifier le lot de la PR avec `references/lot-checklists.md`, section « Identifier le
   lot », puis lire la section de ce lot. Sans lot identifiable, utiliser la checklist
   « Hors lot ». Le code fait foi : si la checklist attribue au lot quelque chose que la PR
   n'a pas, ou l'inverse, le noter en « Hors périmètre » et continuer.
3. Si la PR modifie `docs/PLAN.md` ou `README.md`, lire ces hunks. Les références de ce
   skill datent du 2026-09-23 : le plan fait foi, et le rapport signalera que le skill
   doit être rafraîchi.
4. Cartographier les fichiers touchés vers les domaines. La dernière colonne liste le
   contexte hors diff à relire pour vérifier les invariants du domaine :

| Domaine   | Fichiers                                                                                                     | Invariants                        | Contexte hors diff                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| frontière | `src/engine/index.ts`, `src/ui/state/engine.svelte.ts`, tout import croisé                                   | section A                         | `src/engine/index.ts` (ré-exports)                                                                                            |
| horloge   | `src/engine/clock/**`, câblage du scheduler dans `index.ts`, `src/ui/playhead/**`                            | section B                         | `clock/timing.ts`, `clock/scheduler.ts`, `model/constants.ts`                                                                 |
| synthèse  | `src/engine/synth/**`, `src/engine/audio/**`                                                                 | section C                         | `audio/params.ts`, `model/constants.ts`, `model/mapping.ts`, `synth/graph.ts`                                                 |
| modèle    | `src/engine/model/**`, `state.ts`, `commands.ts`                                                             | section D                         | `model/defaults.ts`, `model/types.ts`, `state.ts`                                                                             |
| interface | `src/ui/**`                                                                                                  | section E                         | `gestures/knob-math.ts`, `gestures/knob-drag.ts`, `components/Knob.svelte`, `components/Transport.svelte`, `theme/tokens.css` |
| tests     | `**/*.test.ts`, `tests/**`                                                                                   | `references/test-expectations.md` | `tests/fakes/*`, tests voisins non touchés des modules modifiés                                                               |
| livraison | `.github/**`, `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, configs lint et TS, `README.md`, `docs/**` | section G                         | `README.md` « Feuille de route » et « À écouter »                                                                             |

Un finding appartient au domaine du **fichier** où il se trouve : une constante du
moteur recopiée dans un composant est un finding du domaine interface, sourcé D2.

5. Se demander « comment j'aurais implémenté ce lot ? » à partir du plan (§5 et
   arborescence §3), puis comparer. Les divergences de conception méritent un commentaire,
   les divergences de style non.

---

## Étape 3 — Evidence

**Mode local** : exécuter `pnpm verify` (typecheck, lint, stylelint, tests) et lire la
sortie. Échec : `[Bloquant — Evidence]` avec l'extrait de sortie, puis continuer la revue
sans corriger. Si la PR touche `vite.config.ts`, un worker ou la CI, exécuter aussi
`pnpm build`.

**Mode PR** : lire `statusCheckRollup`. Le check s'appelle `verify`.

- `SUCCESS` : acquis.
- `FAILURE` : `[Bloquant — Evidence]` « La CI doit être verte avant merge », sans analyse
  des logs.
- `PENDING` ou aucun check : le dire dans le rapport, ne pas attendre. Si l'Evidence est
  indispensable, exporter la tête dans un dossier temporaire et y lancer `pnpm verify`
  (`references/github.md`), jamais de checkout dans le worktree.

**Dans les deux modes**, vérifier à la main ce que la CI ne sait pas :

- chaque module pur ajouté ou modifié sous `src/engine` a un `*.test.ts` voisin touché ;
- aucun `.only`, `.skip`, `.todo` n'entre dans le dépôt ;
- le nombre de tests annoncé dans la description correspond au décompte des `it(` à la
  version revue (`references/github.md`) ; un écart est un Nit sur la description ;
- les tests ajoutés testent un comportement, pas un mock de l'implémentation, et leurs
  assertions peuvent échouer (`references/test-expectations.md`, « Signaux d'alerte »).

---

## Étape 4 — Analyse

### 4a — Périmètre et forme de la PR, toujours inline

- Face à la checklist du lot : livré, manquant pour clore le lot, en trop. Ce qui
  appartient à un lot ultérieur ou à v2+ est du scope creep, à signaler en Suggestion, ou
  en Bloquant s'il ajoute une dépendance ou un champ de modèle écarté par une hypothèse.
- Description de PR : la convention est dans `references/lot-checklists.md`. Une section
  « À écouter » absente est une Suggestion : c'est le seul test que la revue ne peut pas
  faire. README « Feuille de route » et « À écouter à chaque lot » : ce que le lot aurait
  dû y ajouter est une Suggestion (G3) ; le retard antérieur est « Hors périmètre ».

### 4b — Invariants par domaine

Pour chaque domaine touché, parcourir sa section de `references/invariants.md` contre le
diff **et** contre les fichiers complets à la version revue, plus le contexte hors diff de
la table. Chaque invariant dit comment se vérifier.

**Fan-out** au-delà de 400 lignes ou de trois domaines : un sous-agent `general-purpose`
par domaine touché, au plus cinq, en regroupant un domaine à un seul fichier avec son
voisin (frontière avec modèle, livraison traitée inline en 4a). Tous lancés **dans le même
message et attendus** : pas en arrière-plan, sinon leurs résultats ne reviennent pas quand
l'orchestrateur est lui-même un sous-agent. Compter environ 150 k tokens par sous-agent :
le fan-out se justifie par la taille, pas par confort. Chaque prompt est autonome :

```
Tu analyses le domaine <DOMAINE> de <PR #N | la branche locale> du dépôt acid-box,
en lecture seule. Ne modifie rien, ne poste rien, ne lis jamais le worktree en mode PR.
1. Lis `.claude/skills/reviewing-pr/SKILL.md` sections « Posture » et « Ce que l'outillage
   garantit déjà », `.claude/skills/reviewing-pr/references/invariants.md` sections A, C0
   et <LETTRE> (pour le domaine tests : `references/test-expectations.md` en entier),
   et la section « Lot <N> » de `references/lot-checklists.md`.
2. Fichiers du domaine : <LISTE>. Contexte hors diff à relire : <CONTEXTE>.
   Diff : `git diff <BASE> <HEAD_REF> -- <LISTE>`.
   Fichier complet et numéros de ligne : `git show <HEAD_REF>:<chemin>` puis `| grep -n`.
3. Vérifie chaque invariant de la section sur le diff et sur les fichiers complets.
   Ignore ce que l'outillage garantit. Ne commente que ce que la PR touche ; un écart
   préexistant va dans HORS_PERIMETRE.
4. Réponds uniquement par les trois blocs ci-dessous, `[]` quand ils sont vides.
```

Format de retour, utilisé par les sous-agents et par l'analyse inline :

```yaml
FINDINGS:
  - id: <domaine>-<n>
    severity: bloquant | suggestion | nit
    criterion: Purpose | Edge | Reliability | Form | Evidence | Clarity | Taste
    path: <chemin/relatif>
    line: <ligne côté nouveau fichier, ou null>
    invariant: <A1, C2… ou null>
    claim: <une phrase>
    evidence: <extrait ou raisonnement, une à trois lignes>
    fix: <alternative précise>
CONFORMES:
  - <identifiants d'invariants vérifiés et tenus, ex. C1, C3, C5>
HORS_PERIMETRE:
  - path: <chemin>
    note: <écart préexistant ou erreur d'une référence du skill, une ligne>
```

`CONFORMES` permet un verdict étayé (« C1 à C10 vérifiés ») plutôt qu'un simple décompte
de findings. Sans fan-out, appliquer les mêmes sections inline et produire les mêmes blocs.

---

## Étape 5 — Vérification adversariale

C'est l'étape qui fait la différence entre une revue utile et du bruit. Pour chaque
finding candidat :

1. Relire le fichier complet à la version revue, pas seulement le hunk.
2. Chercher si l'invariant est déjà assuré ailleurs. Exemples réels : `safeTime` dans
   `bass-voice.apply` couvre tous les événements d'un plan, donc `bass-plan.ts` n'a pas
   à borner ses temps ; `clamp` dans le reducer couvre les valeurs venues de l'interface ;
   `smoothSet` dans `applyMix` couvre les gains du mix.
3. Confirmer que la ligne pointée existe côté nouveau fichier et fait partie du diff.
   Sinon, choisir la ligne du diff la plus proche ou basculer en commentaire global.
4. Fixer la sévérité :
   - **Bloquant** : invariant sourcé violé, ou bug démontrable avec une entrée concrète,
     ou Evidence (CI rouge, module pur sans test).
   - **Suggestion** : amélioration argumentée, alignement au plan, cas limite non testé,
     contestation argumentée d'une parade documentée.
   - **Nit** : goût, nommage sans convention écrite, micro-lisibilité.
5. Non confirmé : supprimé. Douteux : rétrogradé et formulé en question.
6. Dédoublonner : un même invariant violé sur plusieurs lignes donne un seul commentaire
   à la première occurrence, avec la liste des autres lignes ; un même `path:line` remonté
   par plusieurs domaines donne un seul finding, attribué au domaine du fichier.
7. Déjà dit dans un commentaire existant de la PR : ne pas répéter.

Trois findings vrais valent mieux que douze dont cinq faux. La précision est le budget.

---

## Étape 6 — Rapport

Toujours ce gabarit, en français :

```markdown
## Revue — PR #<N> · <titre> (ou : branche <nom> contre origin/main)

Lot <n> — <nom> · CI <verte | rouge | absente | en cours> · +<a>/−<d> sur <f> fichiers · domaines : <liste>

### Verdict

<Mergeable | Mergeable après correction des bloquants | À discuter avant d'aller plus loin
| Rétrospective : correctifs à livrer avec le lot <n+1>>. <Une phrase, appuyée sur CONFORMES.>

### Bloquants (<n>)

- `<chemin>:<ligne>` — **[Bloquant — <Critère>]** <problème>. Source : <invariant ou PLAN §>. Suggestion : <alternative>.

### Suggestions (<n>)

### Nits (<n>)

### Périmètre face au plan

- Livré : …
- Manquant pour clore le lot : …
- En trop : …

### Tests face à la stratégie §6.1

| Module touché | Attendu | Présent |

### À écouter avant de merger

- <items du lot, plus ceux que la PR induit>

### Hors périmètre, pour plus tard

- <écarts préexistants remarqués, non commentés inline>
- <références de ce skill à rafraîchir, si le code les contredit>
```

En mode local, terminer par « Corrections proposées, dans l'ordre », sans les appliquer :
la revue s'arrête au diagnostic, l'auteur décide.

---

## Étape 7 — Poster, mode PR uniquement

Demander d'abord, via une question à choix : tout poster, bloquants seulement, ou rien.
Ne proposer l'approbation que si aucun bloquant ne subsiste **et** que le reviewer n'est
pas l'auteur, et seulement comme choix explicite. Jamais d'`APPROVE` par défaut. Sur une PR
fusionnée, ne poster que sur demande explicite.

Puis une seule review GitHub, commentaires inline inclus, via l'API décrite dans
`references/github.md` :

- `commit_id` = `headRefOid` ;
- `event` = `REQUEST_CHANGES` s'il reste des bloquants et que le reviewer n'est pas
  l'auteur, sinon `COMMENT` ;
- `body` = verdict, périmètre, « À écouter », puis la signature ;
- `comments[]` = un par finding, `path`, `line`, `side: RIGHT`, format
  `[Type — Critère] problème. Argument. Suggestion.`

Chaque commentaire et le corps se terminent par :

```
---
*Revue générée par Claude Code*
```

Si l'API rejette une ligne hors diff, replier ce finding dans le corps avec le préfixe
`` `chemin:ligne` `` et renvoyer une fois. Ne jamais insister trois fois sur le même appel.

Terminer par l'URL de la review et le nombre de commentaires postés.

---

## Mode dégradé

- `gh` absent ou non authentifié : mode local disponible, mode PR impossible, le dire.
- PR introuvable : vérifier l'argument, proposer `gh pr list`.
- `git fetch origin pull/N/head` refusé : lire les fichiers via `gh api` (voir
  `references/github.md`), ne pas changer de branche.
- Références en retard sur `docs/PLAN.md` ou contredites par le code : le code et le plan
  font foi, le signaler dans « Hors périmètre ».
- Worktree sale en mode local : c'est normal, le diff l'inclut ; ne jamais `stash` ni
  `checkout` sans demande.

---

## Erreurs fréquentes à éviter

- Revérifier à la main ce que typecheck, ESLint ou Stylelint garantissent : c'est du bruit.
- Bloquer sur du goût ou sur une convention qui n'est écrite nulle part.
- Rétrograder un bug démontrable en « Clarity » parce qu'un invariant voisin est respecté.
- Lire le worktree en mode PR, ou croire une checklist de lot plutôt que le code.
- Commenter du code hors diff, ou une ligne que la PR ne touche pas.
- Demander une optimisation mobile portrait, une re-planification des pas déjà programmés
  ou un champ `length` sur le pattern : ces choix sont tranchés dans le plan.
- Oublier que la valeur d'un knob dans l'état est normalisée 0..1 et croire à un bug
  d'unité.
- Lancer les sous-agents en arrière-plan, ou lire le diff complet avant de le leur
  redistribuer.
- Approuver seul, ou tenter `APPROVE` sur sa propre PR.
- Corriger le code pendant la revue, ou partir en debug de la CI.
- Poster N commentaires isolés au lieu d'une seule review.
