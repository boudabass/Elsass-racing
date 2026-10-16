# Créer une app

Une app est un module qui déclare son contrat au socle : un manifeste, des widgets, et les événements qu'elle émet et écoute. Le socle assemble le menu, la liste des apps visibles, et la livraison des événements.

Exemple de référence : Réglages (`src/apps/settings/`).

## 1. Le catalogue d'abord

Une app doit exister dans le catalogue des apps (`src/core/catalogue.ts`) : clé, nom, icône, version et apps requises. Le manifeste doit reprendre ces valeurs à l'identique ; `validerManifeste` le vérifie.

## 2. Le dossier de l'app

```
src/apps/<cle>/
  manifest.ts     le manifeste (ManifesteApp)
  …               écrans, actions, schéma propre à l'app
```

Le manifeste de Réglages :

```ts
export const manifesteSettings: ManifesteApp = {
  cle: "settings",
  nom: "Réglages",
  icone: "settings",
  version: "0.1.0",
  requiert: [],
  menu: [{ libelle: "Identité", chemin: "/identite" }, …],
  widgets: [],
  evenementsEmis: EVENEMENTS.filter((e) => e.emisPar === "settings").map((e) => e.nom),
  evenementsEcoutes: [],
}
```

Chemins de menu : relatifs à `/apps/<cle>`, avec une barre oblique initiale.

## 3. Les widgets

Un widget doit figurer dans `src/core/sdk/widgets-catalogue.ts`, pour son app, avec une clé en kebab-case et un nom en français. Le manifeste ne peut déclarer que ces widgets, une seule fois chacun.

## 4. Enregistrer l'app

Ajouter le manifeste dans `src/apps/registre.ts`. Une app activée en base mais absente du registre est ignorée, avec un avertissement console unique.

Tant que le registre est incomplet (lot 1), le commentaire de `registre.ts` le dit.

## 5. Événements

Les listes `evenementsEmis` et `evenementsEcoutes` d'un manifeste ne se recopient pas : elles sont dérivées du catalogue, par `evenementsEmisPar(cle)` et `evenementsEcoutesPar(cle)` (`src/core/evenements/catalogue.ts`). Un manifeste qui les écrirait à la main pourrait diverger du catalogue ; le test du registre le détecte.


Règle absolue : **aucun nom hors de `src/core/evenements/catalogue.ts`**. Un nom s'écrit `app.fait_au_participe` : minuscules, un point, des underscores.

- Émettre : seulement les événements dont `emisPar` est l'app. Plus les deux motifs génériques `<cle>.action_requise` et `<cle>.action_levee`, écoutés par le socle.
- Écouter : seulement les événements où l'app figure dans `ecoutePar`, ou où `ecoutePar` contient `*` (toutes les apps sauf l'émetteur). Plus `core.action_decidee`, livré à l'app d'origine de l'action.
- Une app ne s'écoute pas elle-même dans les listes explicites.
- Un nom absent du catalogue est refusé par `validerManifeste` et par `estNomValide`.
- Un besoin de nouvel événement ne se résout pas dans le code : on le demande à l'orchestrateur, qui le fait valider.

## 6. Tables

Les tables de l'app sont préfixées par la clé de l'app (ex. `budget_depense`). Les règles de colonnes communes et de `team_id` sont celles de `docs/conventions-schema.md`. Toute table qui porte `team_id` est soumise au RLS (voir `docs/droits.md`).

## 7. Vérifier

```bash
pnpm test    # validerManifeste, registre, événements, assemblage des apps
pnpm typecheck
```

`validerManifeste(manifeste)` renvoie la liste des erreurs en français, vide si le manifeste est valide. Le test du registre vérifie que tous les manifestes importés passent.

## 8. Ce que le socle fait pour l'app

- Garde : toute Server Action commence par `exigerAcces(cle, niveau)` (`src/core/droits/garde-serveur.ts`).
- Menu et liste des apps : `appsVisibles` (`src/core/sdk/apps-serveur.ts`) ne montre que les apps activées de niveau au moins lecture, Réglages en dernier pour le responsable.
- Livraison des événements : prévue au lot suivant, selon les abonnés déclarés ici.

## 9. Rendre une table disponible hors ligne

Une table n'est synchronisée que si elle est déclarée dans le registre de la synchro (`src/core/synchro/registre.ts`). Pour l'ajouter :

1. Définir le schéma zod des champs modifiables (sans les colonnes du socle : le serveur pose l'auteur, la team et la fiche).
2. Choisir l'app dont les droits s'appliquent, le niveau requis pour lire (`niveauLecture`), et si la règle de contribution s'applique (`contributionPropre`).
3. Écrire les cinq fonctions de la déclaration : `lirePaquet` (lignes après le curseur, `updatedAt` puis `id`, suppressions comprises), `trouver`, `creer`, `modifier`, `supprimer`. Les modifications passent par `rev: { increment: 1 }` et `updatedBy`.
4. Ajouter la table à `TABLES_LOCALES` (`src/core/synchro/client/base.ts`) et au schéma local de la base.
5. Vérifier : `pnpm test`, `pnpm db:verifier-synchro` (à étendre pour la nouvelle table), et un test e2e hors ligne.

Côté écran : `useTable("<table>")` lit la base locale, `useMoteurSynchro().ecrireLocal(...)` écrit. Une écriture n'attend jamais le réseau. Détails et limites : `docs/synchro.md`.
