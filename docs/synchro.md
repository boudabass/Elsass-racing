# Synchronisation et hors ligne

Principe : le serveur reste la vérité. L'appareil garde une copie locale (IndexedDB) et une file d'écritures en attente. Toute écriture passe par le serveur, qui revérifie session, team, droits et RLS, comme pour une action en ligne.

## Principes

1. **Le serveur reste la vérité.** Chaque opération repasse par `appliquerOperations` côté serveur.
2. **Liste blanche.** Seules les tables du registre (`src/core/synchro/registre.ts`) sont lues ou écrites par la synchro. Chaque déclaration porte la table, le schéma zod des champs modifiables, le niveau requis pour lire et pour écrire, et la règle de contribution.
3. **Identifiants côté client.** Une création hors ligne utilise `newId()` (UUID v7) : aucune réécriture d'identifiant à la synchro.
4. **Conflits : la dernière écriture gagne, sans perte silencieuse.** Une écriture envoie la `rev` qu'elle a lue. Si la ligne a changé entre-temps, elle est appliquée quand même, et la version écrasée est gardée dans `core_activity` (action `conflit_synchro`, contenu remplacé dans `resume`). Une suppression l'emporte sur une modification concurrente, et le conflit est journalisé pareil.
5. **Rien de magique à l'écran.** L'indicateur de la barre haute dit « 1 envoi refusé » (tant qu'un refus n'est pas lu), « Hors ligne », « 3 modifications en attente » ou « Synchronisé il y a 2 min ». Un conflit ne bloque jamais : il reste dans le journal de la fiche. Un refus, lui, s'affiche avec sa raison (voir « Envois refusés »).

## Routes

| Route | Entrée | Sortie |
|---|---|---|
| `POST /api/synchro/tirer` | `{ curseurs: { [table]: curseur \| null } }` | `{ tables: { [table]: { lignes, curseur, suite } }, horodatage }` |
| `POST /api/synchro/pousser` | `{ operations: [{ idOperation, table, type, id, revLue?, champs? }] }`, 200 au plus | `{ resultats: [{ idOperation, statut, raison? }] }` |

- `statut` : `appliquee`, `conflit_resolu` (appliquée, version écrasée journalisée, ou suppression gagnante), `refusee` (avec raison en français).
- Paquets de 500 lignes au plus. `suite: true` : le client rappelle avec le nouveau curseur.
- Session et team exigées : 401 si non connecté, 403 si pas de team ou niveau insuffisant. Réponses `Cache-Control: no-store`. Le middleware ne redirige pas ces routes (elles répondent en JSON).
- Chaque opération a sa propre transaction : une opération refusée ne bloque pas les autres.
- Idempotence : `core_sync_operation` garde le résultat de chaque `idOperation`. Une opération rejouée renvoie son résultat, sans rien réappliquer.
- `tirer` met à jour `core_sync_cursor` et `core_device.derniereSyncAt`.

## Registre et règle de contribution

Une table synchronisable est déclarée dans `registre.ts`. Aujourd'hui : `core_note`, rattachée aux droits de l'app `equipe` (lecture pour voir, contribution pour créer et modifier les siennes). Une déclaration fournit `lirePaquet`, `trouver`, `creer`, `modifier`, `supprimer`, et le schéma des champs.

Règle de contribution (`src/core/synchro/contribution.ts`) : au niveau contribution, on n'écrit que les lignes dont `created_by` est le compte courant. Au niveau écriture ou plus, toutes les lignes de la table.

Règle par affectation (tâche 4.3, D1) : une déclaration peut porter `regleContribution: "affectation"` et une fonction `affecte(tx, teamId, userId, id)`. Au niveau contribution, on n'écrit alors que les lignes où le membre est affecté (par exemple un ordre de travail, article 954), quel que soit leur auteur. La table répond à `affecte` ; le prédicat `peutEcrire` ne lit jamais la base. Sans fonction `affecte`, le niveau contribution est refusé (défaut sûr). Absente, la règle vaut `createur` : comportement inchangé pour `core_note` et les tables existantes. La création reste libre au niveau contribution, et l'auteur devient le membre.

Les champs de `creer` ne suffisent pas à poser la fiche : le serveur pose l'auteur, la team et la fiche (pour une note : `app = core`, `ficheType = team`, `ficheId = teamId`).

## Conflits, en pratique

- Modification avec la `rev` lue : appliquée, `rev + 1`.
- Modification avec une `rev` dépassée : appliquée, `conflit_resolu`, journal `conflit_synchro` (`motif: modifiee`, `version_remplacee`).
- Modification d'une ligne supprimée : non appliquée, `conflit_resolu`, journal (`motif: supprimee`, `version_ecrite`).
- Suppression d'une ligne déjà supprimée : sans effet, `appliquee`.
- Suppression avec une `rev` dépassée : appliquée, `conflit_resolu`, journal (`motif: supprimee_apres_modification`).

`src/core/synchro/conflit.ts` contient les décisions, sans accès à la base.

Effets après application (tâche 4.3b). `apresApplication` d'une déclaration est appelé après toute écriture validée, `appliquee` ou `conflit_resolu` (un ordre terminé par une modification en conflit émet donc comme les autres). Il n'est pas appelé quand rien n'a été écrit : suppression déjà faite, modification face à une ligne supprimée (`conflit_resolu` sans écriture). `pousser.ts` le décide ; le garage ne lit que les ordres non supprimés (`garage.travail_termine`, `fautEmettreTravailTermine`).

## Client

- Base locale par compte et par team : `elsass-racing-<userId>-<teamId>` (version 6). Magasins : une table par table synchronisable (`core_note`), `operations_en_attente`, `refus_synchro` (envois refusés, tant qu'ils ne sont pas lus), `curseurs`.
- `MoteurSynchro` (`src/core/synchro/client/moteur.ts`) : `ecrireLocal` met à jour la base locale tout de suite et ajoute l'opération à la file. Une seule synchro à la fois : pousser la file, puis tirer.
- Déclenchements : au démarrage, au retour du réseau (`online`), toutes les 60 s quand l'onglet est visible, et 2 s après une écriture locale. Après un échec réseau : attente croissante, plafonnée à une minute (`attente.ts`).
- Hooks : `useTable(table)` (lignes locales, sans les supprimées, mises à jour à chaque changement) et `useEtatSynchro()`.
- Déconnexion : la page de connexion retire les bases des comptes déconnectés, sauf celles qui ont encore des modifications en attente ou des refus non lus (les effacer perdrait ces modifications, ou un refus que personne n'a vu).

## Service worker et application installable

- `/sw.js` : service worker écrit à la main, servi par une route (`src/app/sw.js/route.ts`, code dans `src/core/synchro/service-worker.ts`). Le brief prévoyait `public/sw.js` : une route permet d'injecter la version de l'app au build (`VERSION_APP`, `next.config.ts`), un fichier statique ne le peut pas. Un nouveau build crée un nouveau cache (`elsass-racing-<version>`) ; l'ancien est supprimé à l'activation.
- Stratégies : `_next/static` et icônes, cache d'abord ; pages (navigations), réseau d'abord avec copie en cache des pages HTML ; hors ligne sans copie, la page `/hors-ligne` ; `/api/` jamais interceptée.
- Les pages sont mises en cache quand elles sont visitées en ligne, pas à l'installation : une page authentifiée ne se précharge pas sans session.
- Enregistrement : `EnregistrementSW` dans l'espace connecté, en production seulement.
- Déconnexion : la page de connexion retire les caches de l'app (pages de team) et les bases des comptes déconnectés, sauf les modifications en attente.
- Manifeste : `src/app/manifest.ts` (`/manifest.webmanifest`), nom « Elsass Racing », nom court « Racing », thème sombre, `display: standalone`, `lang: fr`. Icônes 192, 512 et 512 masquable dans `public/icones/`, générées par `pnpm exec tsx scripts/generer-icones.ts` (fond rouge de la team, « ER » en pixels, sans dépendance).
- CSP : `worker-src 'self'` ajouté à `frame-ancestors 'none'`.

## Périmètre de lecture

Un membre ne reçoit que ce qu'il peut lire (article 948) : niveau aucun, la table n'est pas renvoyée ; niveau contribution, seulement ses lignes (`created_by` = le compte courant) ; lecture et plus, toute la team. La décision est dans `perimetreLecture` (`contribution.ts`, testée). Le filtre est un paramètre de `lirePaquet` : une nouvelle table en hérite.

## Navigation hors ligne

- Cause du plantage constaté en production (1.11b) : hors ligne, un lien interne ne retrouvait pas sa page dans le cache (`/notes?nouvelle=1`, paramètre absent du cache), le service worker servait `/hors-ligne`, dont le JavaScript n'était pas en cache : « Loading chunk failed », soit l'écran « client-side exception ».
- Correction : le cache des pages ignore les paramètres (`ignoreSearch`) ; le repli hors ligne est une page sans JavaScript, générée par le service worker ; les requêtes RSC ne sont pas interceptées (Next retombe alors sur une navigation de page, servie par le service worker).
- Garde côté client (`NavigationHorsLigne`, `src/components/navigation-hors-ligne.tsx`) : hors ligne, un clic sur un lien interne devient une navigation de page. La décision est dans `modeNavigation` (testée) ; `naviguer(routeur, href)` est la fonction commune du code.
- Préchargement : en ligne, le client demande au service worker de mettre en cache `/qg` et `/notes`.
- Écran d'erreur : `src/app/(app)/error.tsx` (espace connecté) et `src/app/global-error.tsx` (racine), en français, avec « Recharger », « Retour au QG », et la mention hors ligne.
- Journal des erreurs : `POST /api/erreurs-client` (session exigée, 20 envois par minute et par appareil, `[erreur client]` dans les logs serveur). Hors ligne, l'erreur est gardée sur l'appareil et envoyée au retour du réseau. Aucune donnée de team : message, pile tronquée, chemin de la page, version, navigateur.
- Test de l'écran d'erreur : `/erreur-test` (hors production). Le brief parlait de `/__erreur-test` ; un dossier qui commence par `_` est privé dans Next.

## Appareil déconnecté pendant une synchro

Une ligne lue plus tôt peut disparaître avant l'écriture (appareil déconnecté ou révoqué). Aucune écriture de synchro ne fait donc de `update` ou de `delete` nu : `updateMany` renvoie le nombre de lignes touchées.

- Curseur : si rien n'est touché, on vérifie que l'appareil existe encore. Absent : `ErreurAppareilRevoque`, réponse 401 « Cet appareil a été déconnecté. », sans journal d'erreur ; le client doit alors aller sur `/connexion`. Présent : le curseur est recréé.
- Poussée : une ligne disparue donne `refusee` « Cet élément n'existe plus. », sans journal de conflit.
- Contrôles : `pnpm db:verifier-synchro` (appareil supprimé entre deux tirages, 401, aucun log ; curseur seul supprimé, recréé).


## Tables de Saison hors ligne (tâche 2.4)

Six tables de Saison suivent la procédure de `docs/app-sdk.md`, section 9 (registre, cinq fonctions par table, `TABLES_LOCALES`, schéma local, vérifications).

- **Lecture seule** (`lectureSeule: true` dans la déclaration) : `core_event`, `saison_stage`, `saison_schedule_item`, `saison_recce`. `pousser.ts` refuse toute opération sur ces tables avant même de les lire : elles se reçoivent, elles ne s'écrivent pas depuis l'appareil.
- **Contribution propre** : `saison_recce_session` (niveau de lecture « lecture », donc l'assistance les voit) et `saison_debrief` (niveau de lecture « contribution », donc l'assistance ne les reçoit jamais). Chacun ne modifie que ses lignes au niveau contribution.
- **Refus métier** : une règle de Saison (saison clôturée, personne ou spéciale hors de la team ou de l'épreuve, débrief en double) lève `RefusSynchro`. La transaction est annulée, l'opération est notée `refusee` avec son message en français, et l'appareil le montre.
- **Base locale** : version 2. Une base créée en version 1 reçoit les nouveaux magasins à l'ouverture. Les magasins existants ne sont pas touchés.
- **Préchargement** : les pages `?onglet=programme` et `?onglet=reconnaissances` de la prochaine épreuve sont demandées au service worker avec les pages clés (`/qg`, `/notes`).

- **Débrief hors ligne** : le formulaire de débrief de la fiche engagement écrit dans la base locale (`saison_debrief`, `ecrireLocal`) et s'affiche hors ligne, comme les sorties de reco. La ligne locale de cet appareil l'emporte sur celle du rendu serveur. Une fois l'écriture validée par le serveur, l'événement `saison.debrief_saisi` est émis (crochet `apresApplication` de `DeclarationSynchro`, appelé après la transaction ; son échec est journalisé sans changer le résultat de l'opération).

Vérifications : `db:verifier-synchro` (registre, lecture seule refusée, sortie de l'équipage appliquée, sortie de l'assistance refusée, débrief jamais reçu par l'assistance, événement du débrief émis une seule fois, saison clôturée refusée) et `e2e/saison-hors-ligne.spec.ts` (programme en mode avion, sortie saisie hors ligne puis synchronisée au retour du réseau ; débrief saisi hors ligne, en base et événement émis au retour du réseau).

Limite : un débrief créé sur un autre appareil n'est visible ici qu'après la première synchronisation : tant qu'il n'est pas sur cet appareil, un nouveau débrief y est créé et sera refusé à l'envoi (« Tu as déjà un débrief pour cette épreuve »).
## Envois refusés, visibles (tâche 4.3b)

Un envoi que le serveur refuse ne disparaît pas en silence (règle 8 : tout refus affiche sa raison). Avant, le client jetait la raison, une création refusée disparaissait de l'écran et l'indicateur disait « Synchronisé ».

- **Ce qui est gardé** (`refus_synchro`, `src/core/synchro/client/refus.ts`) : `idOperation`, la team et le compte qui ont fait l'envoi, la table, l'identifiant de la ligne, le type, le libellé de la table, un résumé seulement quand la saisie le permet (`resumer`, dans `libelles.ts` ; sans résumé, rien n'est deviné), la raison du serveur (ou « Le serveur a refusé cet envoi. » si elle manque), la date de saisie et la date du refus.
- **Qui le voit** : `refusDuCompte` ne rend que les refus de la team et du compte courants, les plus récents d'abord. Un appareil partagé, ou un changement de team, n'affiche jamais les refus d'un autre.
- **Effet sur la ligne locale** : une création refusée est retirée de l'écran. Une modification ou une suppression refusée remet le curseur de la table à zéro : au tirage suivant, la ligne reprend la valeur du serveur (les lignes encore en attente sur l'appareil gardent leur version locale, comme avant).
- **Écran** : l'indicateur passe à « N envoi(s) refusé(s) » (rouge, icône et texte, visible aussi sur téléphone). Son tiroir liste chaque refus avec sa raison et un bouton « Compris », qui efface le refus. Hook : `useRefusSynchro()` (`src/core/synchro/client/react.tsx`).
- **Libellés** : `LIBELLES_TABLES` a une entrée par table de `TABLES_LOCALES`. `refus.test.ts` échoue si une table du registre serveur n'a pas de libellé.
- **Tests** : `refus.test.ts` (ce qui est gardé, visibilité par compte, libellé, couverture du registre), `pousser.test.ts` (quand `apresApplication` suit une écriture). Le moteur lui-même (IndexedDB) n'a pas de test unitaire : l'environnement de test est `node`, sans IndexedDB. Son câblage est couvert par `e2e/garage-refus-hors-ligne.spec.ts` (raison visible au retour du réseau, persistance après rechargement, « Compris »).

## Limites connues

- Pas de worker en arrière-plan : la synchro tourne dans l'onglet ouvert, et le service worker ne rejoue rien seul.
- Un changement de niveau ne relance pas un tirage complet : un membre promu garde son curseur, et ne reçoit pas rétroactivement les lignes des autres. À traiter avec un tirage complet lors d'un changement de niveau.
- Tables synchronisables : `core_note` (equipe) et, depuis la tâche 2.4, six tables de Saison (voir la section suivante). Les autres apps viendront avec leurs écrans.
- Les auteurs sont affichés « Toi » ou « Un membre » : pas encore de nom sur les notes.
- Le conflit est visible dans le journal de la fiche, pas dans une interface dédiée.
- Le rejeu d'une écriture n'est sûr que si le serveur a bien reçu la première : l'idempotence repose sur `idOperation`.
- Le cache des pages est partagé par tous les comptes de l'appareil jusqu'à la prochaine déconnexion : il ne contient que des pages déjà visitées.

## Vérification

- Unitaires : curseur, conflit, contribution et périmètre de lecture, attente, protocole (idempotence du résultat noté).
- Base : `pnpm db:verifier-synchro` (deux appareils simulés, conflit journalisé, rejeu idempotent, table refusée, isolement entre teams, contribution, périmètre de lecture de l'assistance et de l'équipage).
- E2E, projet `chromium` (développement) : `e2e/hors-ligne.spec.ts` ne tourne pas ici.
- E2E, projet `hors-ligne` (production, port 3101) : `e2e/hors-ligne.spec.ts`. Connexion, note en ligne, visite de `/qg` et `/notes`, passage hors ligne, rechargement depuis le cache, note hors ligne avec badge et indicateur, retour du réseau et contrôle en base.

## Dépenses de Budget hors ligne (tâche 2.6)

- `budget_expense` : contribution propre (`src/apps/budget/synchro-serveur.ts`). Un membre ne saisit hors ligne que les dépenses qu'il paie lui-même (contrôle de payeur dans la transaction). Une dépense ne se modifie ni ne se supprime depuis l'appareil : `RefusSynchro` avec message en français.
- `budget_category` et `budget_payer` : lecture seule, lisibles hors ligne pour le formulaire « Nouvelle dépense ».
- À l'application (transaction validée), `apresApplication` émet `budget.depense_creee`, `budget.depense_confirmee`, `budget.solde_modifie` (payeur membre) et, au franchissement, `budget.depassement_previsionnel`.
- Base locale : version 3 (magasins `budget_expense`, `budget_category`, `budget_payer`).
- Test e2e : `e2e/budget-hors-ligne.spec.ts` (projet « hors-ligne »).

## Dépenses de Budget : modification et suppression (tâche 2.7)

- `budget_expense` accepte les opérations `modifier` et `supprimer`, avec la même règle qu'en ligne (`src/apps/budget/depenses-tx.ts`) : contribution propre (on ne modifie que ses lignes au niveau contribution), payeur contrôlé, montant non inférieur à ce qui est remboursé.
- Après application, `apresApplication` reçoit le type de l'opération : une création émet les événements de la dépense ; une modification ou une suppression émet `budget.solde_modifie` pour le payeur membre.
- Le registre passe le type de l'opération à `apresApplication(ctx, id, type)`.

## Rafraîchissement après une synchro (tâche 2.9, point 2)

Quand le serveur applique des opérations poussées, le moteur prévient ses abonnés serveur ; le fournisseur de synchro appelle alors `router.refresh()`. Une dépense d'engagement crée ainsi son action dans la boîte, et la boîte, le compteur et le solde se mettent à jour sans rechargement. Reproduction : `e2e/boite-reproduction.spec.ts`.
