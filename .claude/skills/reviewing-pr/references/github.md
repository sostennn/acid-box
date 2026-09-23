# GitHub via `gh` — collecte et publication

<!-- forged-by: forging-review-skill · 2026-09-23 · sources : fiche plateforme github, gh 2.x, dépôt sostennn/acid-box -->

État au 2026-09-23 : le comportement de `gh` et de l'API GitHub fait foi.

Dépôt : `sostennn/acid-box`. `gh` résout `{owner}` et `{repo}` depuis le remote courant.
`<REF>` désigne indifféremment un numéro, une URL ou un nom de branche : `gh pr view` les
accepte tous.

---

## Pré-vérification

```bash
gh auth status
```

Échec : « Lance `gh auth login` », proposer le mode local, ne pas insister.

---

## Collecte, en parallèle

Métadonnées, en une seule commande :

```bash
gh pr view "<REF>" --json number,title,body,state,isDraft,author,url,headRefName,baseRefName,headRefOid,additions,deletions,changedFiles,reviewDecision,statusCheckRollup
```

Lecture des checks depuis la même sortie (les check runs ont `name`/`conclusion`, les
statuts `context`/`state`) :

```bash
gh pr view "<REF>" --json statusCheckRollup --jq '[.statusCheckRollup[]? | {name: (.name // .context), status: (.conclusion // .state)}]'
```

Le check attendu est `verify`. `SUCCESS` vert, `FAILURE` rouge, `PENDING`/`IN_PROGRESS`
en cours, tableau vide = aucune CI déclenchée.

Diff et fichiers :

```bash
gh pr diff "<REF>"
gh pr diff "<REF>" --name-only
```

Version revue et base, sans toucher au worktree. Le worktree peut être sur une autre
branche : en mode PR, tout se lit par `git show`.

```bash
git fetch origin "pull/<N>/head"                                  # FETCH_HEAD = tête de la PR
BASE=$(git merge-base "origin/<baseRefName>" FETCH_HEAD)          # PR ouverte
BASE=$(git rev-parse "<mergeCommit.oid>^1")                       # PR fusionnée : premier parent du merge
git diff "$BASE" FETCH_HEAD --stat
git diff "$BASE" FETCH_HEAD --name-only
git diff "$BASE" FETCH_HEAD -- <chemins>                          # diff restreint à un domaine
git show FETCH_HEAD:<chemin>                                      # fichier complet
git show FETCH_HEAD:<chemin> | grep -n '<extrait>'                # numéro de ligne côté nouveau fichier
```

`mergeCommit.oid` vient de `gh pr view "<REF>" --json mergeCommit`. Sur une PR fusionnée,
`git merge-base origin/main FETCH_HEAD` renvoie la tête elle-même et le diff serait vide.

Décompte des tests à la version revue, à comparer au chiffre de la description :

```bash
git grep -c -E '^[[:space:]]*it\(' FETCH_HEAD -- 'src/**/*.test.ts' 'tests/**/*.test.ts' | awk -F: '{ s += $NF } END { print s }'
# `[[:space:]]` et non `\s` : le git grep de macOS (ERE POSIX) ne connaît pas `\s`.
```

Evidence sans CI (check absent ou en attente), toujours hors du worktree :

```bash
TMP=$(mktemp -d -t acid-verify) && mkdir -p "$TMP/pr"
git archive FETCH_HEAD | tar -x -C "$TMP/pr"
( cd "$TMP/pr" && pnpm install --frozen-lockfile && pnpm verify )
```

Repli si le fetch est refusé :

```bash
gh api "repos/{owner}/{repo}/contents/<chemin>?ref=<headRefOid>" --jq .content | base64 -d
```

Commentaires déjà présents, pour ne pas répéter et pour repérer une revue précédente
signée « Revue générée par Claude Code » :

```bash
gh api "repos/{owner}/{repo}/pulls/<N>/comments" --paginate --jq '.[] | {path, line, user: .user.login, body: .body[0:200]}'
gh api "repos/{owner}/{repo}/pulls/<N>/reviews" --jq '.[] | {user: .user.login, state, body: .body[0:200]}'
```

Reviewer = auteur ?

```bash
gh api user --jq .login
```

Si ce login égale `.author.login` de la PR, GitHub refuse `APPROVE` et `REQUEST_CHANGES`
avec une erreur 422 : l'`event` sera `COMMENT`.

---

## Publication : une seule review, commentaires inline inclus

Construire un JSON dans un répertoire temporaire :

```bash
TMP=$(mktemp -d -t acid-review)
```

`$TMP/review.json` :

```json
{
  "commit_id": "<headRefOid>",
  "event": "COMMENT",
  "body": "<verdict, périmètre, à écouter>\n\n---\n*Revue générée par Claude Code*",
  "comments": [
    {
      "path": "src/engine/synth/bass/bass-plan.ts",
      "line": 87,
      "side": "RIGHT",
      "body": "[Bloquant — Edge] <problème>.\nArgument : <invariant C2>.\nSuggestion : <alternative>.\n\n---\n*Revue générée par Claude Code*"
    }
  ]
}
```

- `event` : `REQUEST_CHANGES` s'il reste des bloquants et que le reviewer n'est pas
  l'auteur ; `COMMENT` sinon ; `APPROVE` uniquement sur demande explicite de
  l'utilisateur et jamais sur sa propre PR.
- `line` est le numéro **dans le fichier après modification** ; `side: RIGHT`. Pour une
  ligne supprimée seulement : numéro dans l'ancien fichier et `side: LEFT`. Pour un
  intervalle : ajouter `start_line` et `start_side`.
- La ligne doit faire partie du diff de la PR. Sinon l'API répond 422
  `pull_request_review_thread.line_must_be_part_of_diff`.

Envoi :

```bash
gh api "repos/{owner}/{repo}/pulls/<N>/reviews" --method POST --input "$TMP/review.json" --jq '.html_url'
```

### Repli sur une ligne hors diff

Retirer le commentaire fautif de `comments[]`, l'ajouter au `body` préfixé par
`` `chemin:ligne` `` et renvoyer une fois. Pas de troisième essai : signaler à
l'utilisateur ce qui n'a pas pu être posté inline.

### Approbation, sur demande explicite uniquement

```bash
gh pr review "<REF>" --approve --body "Purpose ✅ Edge ✅ Reliability ✅ Evidence ✅ — <une phrase>.

---
*Revue générée par Claude Code*"
```

---

## Mode local, pour mémoire

```bash
git fetch origin main
BASE=$(git merge-base origin/main HEAD)
git diff "$BASE" --stat
git diff "$BASE"                 # worktree inclus
git log "$BASE"..HEAD --oneline
pnpm verify
```

Branche nommée sans PR :

```bash
git fetch origin
git diff origin/main...origin/<branche> --stat
git diff origin/main...origin/<branche>
```

Aucune publication possible dans ce mode.
