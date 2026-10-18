# Fichiers

Service commun des fichiers (tâche 3.1). Les apps ne lisent ni n'écrivent le disque : elles appellent le service, qui range le fichier, le rattache à la fiche et contrôle qui le lit.

Code : `src/core/fichiers/` (règles pures dans `regles.ts`, service serveur dans `fichiers-serveur.ts`), routes `src/app/api/fichiers/`, composant `src/components/formulaire/champ-fichier.tsx`.

## Règles

- **Type** : lu dans le contenu, jamais dans le nom ni dans le type annoncé par le navigateur. Acceptés : JPEG, PNG, WebP, PDF, SVG (`detecterType`). Le reste est refusé avec « Formats acceptés : photo (JPEG, PNG, WebP), PDF ou SVG. ».
- **Taille** : 10 Mo au plus.
- **Stockage** : `<dossierStockage()>/<team>/<année>/<mois>/<identifiant>`. Le nom d'origine n'entre jamais dans le chemin. Le nom est gardé pour l'affichage seulement (`nomPropre` : sans chemin, sans caractères interdits, 120 caractères au plus).
- **Écriture** : fichier temporaire du même dossier, puis renommage. Une coupure ne laisse pas de fichier à moitié écrit.
- **Ligne** : `core_file`, avec l'empreinte SHA-256 et l'auteur. Écrite dans le contexte de la team (RLS).
- **Remplacement** : `remplacerFichier` met `deletedAt` sur l'ancien fichier. Le fichier physique reste sur le disque.

## Rattachement

`rattacherFichier(client, ctx, { fileId, app, ficheType, ficheId, role })`, appelé par l'app dans sa transaction :

- le fichier doit exister dans la team et ne pas être supprimé ;
- seul son auteur peut le rattacher, ou une fiche déjà liée à ce fichier ;
- pas de doublon : même fichier, même fiche, même rôle.

| Usage | app | ficheType | ficheId | rôle |
|---|---|---|---|---|
| Logo de la team | `settings` | `team` | id de la team | `photo` |
| Ticket d'une dépense | `budget` | `expense` | id de la dépense | `ticket` |
| Preuve d'un résultat | `saison` | `result` | id du résultat | `preuve` |

## Routes

**`POST /api/fichiers`** : multipart, champs `fichier` et `app`. `app` doit être une clé du catalogue. Garde `exigerAcces(app, "contribution")`.

- 201 : `{ id, nom, mimeType, taille }`.
- 400 : `{ message }` en français (format, taille, fichier absent).
- 401 : hors session ou sans team. 403 : niveau insuffisant (message de `libelleErreurAcces`).

**`GET /api/fichiers/[id]`** : session et team courante obligatoires.

- **Règle de lecture** (`peutLire`) : si le fichier a des rattachements, la personne doit avoir au moins `lecture` sur l'app d'un de ces rattachements. Sans rattachement, seuls le logo courant de la team et l'auteur peuvent le lire.
- **Tout refus renvoie 404**, y compris l'absence de session : on ne révèle pas qu'un fichier existe.
- En-têtes : `Content-Type` (le type stocké), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` (un SVG ouvert directement n'exécute rien), `Content-Disposition: inline` avec le nom encodé, `Cache-Control: private, max-age=3600`.
- Le fichier est lu en flux, pas chargé en mémoire.

Le middleware ne redirige pas `/api/fichiers` vers la connexion (comme `/api/synchro/`) : la route répond elle-même 401 ou 404. Le service worker ignore déjà `/api/` : rien à changer.

## Composant `ChampFichier`

`<ChampFichier app="budget" libelle="Photo du ticket" valeur={id ou null} typeValeur={mime} nomValeur={nom} onChange={(fichier) => …} name="justificatifFileId" />`

- Affichage : l'`<input type="file">` natif est caché (`sr-only`) et reste au clavier. Le bouton visible est un `<label htmlFor>` en `BOUTON_SECONDAIRE` : « Choisir une photo » si `accept` ne contient que des images, « Choisir un fichier » sinon. Le focus clavier s'affiche sur ce bouton (`peer-focus-visible`). Avec un fichier : vignette ou nom, puis « Remplacer » et « Retirer » (liens `LIEN`), sans bouton de choix.
- L'envoi part dès le choix (`fetch("/api/fichiers")`). Pendant l'envoi : « Envoi… », et le champ ne se contrôle pas.
- Photos (JPEG, PNG, WebP) de plus de 1,5 Mo ou de plus de 2 000 px : redessinées à 2 000 px au plus, JPEG à 0,85 (`preparer-fichier.ts`). PDF et SVG partent tels quels.
- Après l'envoi : vignette de 64 px pour une image, nom du fichier pour un PDF. Les deux ouvrent le fichier dans un nouvel onglet. « Retirer » vide la valeur (`libelleRetirer` pour le libellé).
- `name` : champ caché portant l'id, pour un formulaire classique.
- Hors ligne (`useEtatSynchro`) : le champ est désactivé, avec « La photo s'ajoute quand le réseau revient. ». Pas de file d'attente de fichiers.
- Erreur serveur affichée sous le champ ; sans réponse : « L'envoi a échoué. Réessaie. ».

## Usages dans l'app

- **Logo** (Réglages, Identité) : écrit avec la team dans une transaction (`sauverIdentite`). Affiché dans la barre haute et l'aperçu des couleurs (`src/components/qg/logo-team.tsx`). Si l'image ne charge pas, l'icône QG revient.
- **Ticket** (Budget) : facultatif dans « Nouvelle dépense » (son id part avec l'écriture locale, dans `justificatifFileId`) et dans la fiche de dépense (ajout ou remplacement, par le formulaire de modification existant). Création, modification et synchro rattachent le ticket dans leur transaction (`poserJustificatif`).
- **Preuve** (Saison) : « Preuve : un lien ou un fichier », avec le champ « Lien de la preuve » et le champ fichier « ou un fichier ». Un lien ou un fichier suffit. Le fichier s'ouvre par « Voir la preuve » dans la fiche d'épreuve et la fiche d'engagement. Un résultat avec seulement un fichier n'est pas « sans preuve ».

## Pour plus tard

- Purge physique des fichiers supprimés ou jamais rattachés.
- File d'attente des fichiers hors ligne (aujourd'hui, le champ est désactivé).
- Dimensions des images (`largeur`, `hauteur` restent vides).
- Outil PDF : tâche 3.1b.

## Tests

- Unitaires : `src/core/fichiers/regles.test.ts` (signatures, nom, clé, règle de lecture).
- Bout en bout : `e2e/fichiers.spec.ts` (logo, ticket, preuve, refus, cloisonnement, hors ligne). Fixtures dans `e2e/fichiers/`. Le dossier des fichiers de test est `.e2e-stockage/` (`STOCKAGE_DIR` dans `playwright.config.ts`, vidé au démarrage).
