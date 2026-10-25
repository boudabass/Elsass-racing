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
- Menu et liste des apps : `appsVisibles` (`src/core/sdk/apps-serveur.ts`) ne montre que les apps activées de niveau au moins lecture, Réglages en dernier pour le responsable. Réglages reste visible pour tous : ses rubriques personnelles sont ouvertes à chaque membre, et les rubriques de la team sont masquées sous « lecture » (`niveauMinimum` du manifeste).
- Livraison des événements : prévue au lot suivant, selon les abonnés déclarés ici.

### Socle à importer, pas à recopier (brief 2.14)

Une nouvelle app importe ces éléments au lieu de les recopier :

- `src/core/sdk/actions-serveur.ts` : `Resultat`, `ErreurMetier` (base des refus métier de l'app : son message s'affiche tel quel), `texte`, `texteOuNull`, `messageDe`, `executer(chemin, action)` (revalide le chemin de l'app et renvoie `{ ok, id }` ou `{ ok: false, message }`).
- `src/core/sdk/ecran-serveur.ts` : `accesEcranApp(appCle, titre, acces, requis)`, la garde d'écran. Le `ecran.ts` de chaque app n'en est qu'un appel.
- `src/core/actions/actions-serveur.ts` : `rouvrirAction(client, ctx, cleUnicite, motif)`, qui remet une action de la boîte en attente avec son motif de refus.
- `src/core/synchro/registre.ts` : `socleSynchro(ligne)` (champs communs, au format de la synchro) et `refusLectureSeule()` pour les tables lues seulement hors ligne.
- `src/components/formulaire/message.tsx` : `Message`, le message affiché sous un formulaire après une Server Action (prop `ok` pour le texte de succès).
- `src/components/silhouette/silhouette.tsx` : `Silhouette`, le dessin d'un gabarit de véhicule en SVG (types dans `silhouette/types.ts`), avec ses calques (emplacements, repères) passés en enfants. Voiture (plan) et Garage (atelier).
- `src/lib/euros.ts` : `formatEuros(centimes)` (« 1 234,50 € ») et `enEuros(centimes)` (« 12,50 » pour un champ de saisie).
- `src/core/fichiers/fichiers-serveur.ts` : `enregistrerFichier` (écriture et ligne `core_file`), `rattacherFichier` (lien à une fiche, dans la transaction de l'app), `remplacerFichier` (l'ancien fichier part à la corbeille). Règles et routes dans `docs/fichiers.md`.
- `src/components/formulaire/champ-fichier.tsx` : `ChampFichier`, le champ d'envoi de fichier (photo compressée, hors ligne géré, vignette ou nom).
- `src/core/notes/notes-serveur.ts` : notes et photos d'une fiche (tâche 5.0). Une app passe son `ControleFiche` (`voir`, `contribuer`, `gerer`) à chaque fonction : `notesEtPhotos`, `ajouterNote`, `modifierNote` (auteur seul), `retirerNote` (auteur ou gestion), `ajouterPhoto`, `retirerPhoto`, `nomsDesMembres`. Règles pures dans `regles.ts`. Le Garage fournit `controleOrdre` (`src/apps/garage/notes-serveur.ts`) et ses actions (`src/apps/garage/notes-actions.ts`). Hors ligne : liste blanche `src/core/notes/fiches.ts` (voir `docs/synchro.md`).
- `src/components/notes-photos/notes-et-photos.tsx` : `NotesEtPhotos`, le bloc « Notes et photos » d'une fiche. Les notes se lisent et s'écrivent sur la base locale ; les photos et le retrait par la gestion passent par le réseau. Les actions lui sont passées en props, pour rester sans app.
- `src/core/pdf/` : `DocumentTeam` (en-tête, pied de page), les blocs `Tableau`, `ChiffresCles`…, `rendrePdf` et `reponsePdf` pour une route qui télécharge un PDF, `lireLogoPourPdf`. Usage et limites dans `docs/pdf.md`.

Les erreurs métier de Saison (`ErreurSaison`) et de Budget (`ErreurBudget`) héritent de `ErreurMetier`.

## 9. Rendre une table disponible hors ligne

Une table n'est synchronisée que si elle est déclarée dans le registre de la synchro (`src/core/synchro/registre.ts`). Pour l'ajouter :

1. Définir le schéma zod des champs modifiables (sans les colonnes du socle : le serveur pose l'auteur, la team et la fiche).
2. Choisir l'app dont les droits s'appliquent, le niveau requis pour lire (`niveauLecture`), et si la règle de contribution s'applique (`contributionPropre`).
3. Écrire les cinq fonctions de la déclaration : `lirePaquet` (lignes après le curseur, `updatedAt` puis `id`, suppressions comprises), `trouver`, `creer`, `modifier`, `supprimer`. Les modifications passent par `rev: { increment: 1 }` et `updatedBy`.
4. Ajouter la table à `TABLES_LOCALES` (`src/core/synchro/client/base.ts`) et au schéma local de la base.
5. Vérifier : `pnpm test`, `pnpm db:verifier-synchro` (à étendre pour la nouvelle table), et un test e2e hors ligne.

Côté écran : `useTable("<table>")` lit la base locale, `useMoteurSynchro().ecrireLocal(...)` écrit. Une écriture n'attend jamais le réseau. Détails et limites : `docs/synchro.md`.

## Onglets de fiche apportés par une autre app (tâche 2.7)

Une app peut ajouter un onglet à la fiche d'une autre app. Le contrat est dans `src/core/sdk/onglets.ts` :

1. Déclarer l'onglet dans la liste de la fiche : `{ cle, libelle, app, niveauMinimum, composant }`. `composant` est le composant serveur de l'app, qui reçoit `{ ficheId }` et appelle ses propres fonctions de lecture. La liste vit dans `src/apps/onglets-fiches.ts` (couche de composition : elle connaît les apps, le socle et la fiche non). Pour la fiche épreuve : `ONGLETS_FICHE_EPREUVE`. Pour la fiche véhicule (Voiture, tâche 3.3) : `ONGLETS_FICHE_VEHICULE`, avec les cinq onglets de Voiture (Identité, Papiers, Déco, Réglages, Historique) ; Garage y ajoutera « État » au lot 4.
2. Dans la page de la fiche, appeler `ongletsVisibles(contexte, liste)` : l'onglet n'est retenu que si son app est activée pour la team et que le membre a au moins `niveauMinimum`.
3. Ajouter l'onglet à la barre (`Onglets`), et rendre `onglet.composant` avec `ficheId`. La fiche ne connaît pas l'app qui fournit l'onglet. L'app qui possède la fiche ne lit jamais les tables de l'autre.

Exemple : Budget fournit l'onglet « Dépenses » de la fiche épreuve (`PanneauDepensesEpreuve`, déclaré dans `src/apps/onglets-fiches.ts`). Garage, Médias et Check-lists pourront suivre le même chemin.

## Menu d'une app, rendu par le socle (tâche 2.9)

Le menu déclaré dans `manifeste.menu` est rendu par le socle, sur toutes les apps (`src/components/qg/menu-app.tsx`, dans le layout de l'espace connecté). Il apparaît sous le titre sur ordinateur, en rangée défilante sur téléphone, et l'entrée de la page courante est marquée (`aria-current`).

Chaque entrée peut porter ses droits, en plus du niveau d'accès à l'app :

- `niveauMinimum` : niveau requis pour voir l'entrée (ex. « À confirmer » : `ecriture`).
- `masquePour` : niveaux pour lesquels l'entrée est masquée (ex. « Prévisionnel » : `["contribution"]`, l'assistance ne voit pas le prévu).

Le filtre est `entreeVisible` (`src/core/sdk/manifeste.ts`). Il ne remplace pas les contrôles de la page : la page garde sa propre garde (`accesEcran`, `exigerAcces`).

## Lectures partagées entre apps (tâche 3.6)

Une app lit les données d'une autre seulement par une fonction exposée dans `lectures-partagees.ts` de l'app propriétaire. Jamais par ses tables, et jamais par ses fiches d'écriture.

Exemple : `listerEmplacementsPourPartenaires(ctx)` (`src/apps/voiture/lectures-partagees.ts`) renvoie les emplacements de tous les véhicules de la team, avec le statut `libre`, `reserve`, `occupe` ou `indisponible` (même règle que le plan de déco). Partenaires s'en sert pour le choix d'un emplacement de contrepartie « logo ».

Ces fonctions n'ont pas de garde : l'app appelante contrôle son propre accès avant d'appeler la lecture (ici, `accesPartenaires`). Elles ne renvoient que des données de résultat.

## Contexte public, sans utilisateur (tâche 3.7)

`avecContextePublic(teamId, tx => …)` (`src/lib/prisma.ts`) ouvre une transaction où seul `app.team_id` est posé. Il n'y a pas d'`app.user_id` : une page servie sans compte, comme `/p/<jeton>`, lit et écrit dans une seule team, et les politiques RLS ne laissent rien passer d'autre.

Règles :
- à n'utiliser que quand le filtre (par exemple un lien validé) est décidé avant la requête ;
- une table ne s'ouvre sans contexte que par une fonction SQL `SECURITY DEFINER` dont le corps est fermé (précédents : `core_invitation_en_attente`, `partenaires_lien_par_empreinte`) ;
- `scripts/verifier-cloisonnement.ts` vérifie qu'une lecture sans contexte ne renvoie rien, et que la fonction ne renvoie que la ligne demandée.

Exemple : `lirePagePartenaire(lien)` (`src/apps/partenaires/page-publique-serveur.ts`).
