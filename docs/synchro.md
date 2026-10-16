# Synchronisation et hors ligne

Principe : le serveur reste la vérité. L'appareil garde une copie locale (IndexedDB) et une file d'écritures en attente. Toute écriture passe par le serveur, qui revérifie session, team, droits et RLS, comme pour une action en ligne.

## Principes

1. **Le serveur reste la vérité.** Chaque opération repasse par `appliquerOperations` côté serveur.
2. **Liste blanche.** Seules les tables du registre (`src/core/synchro/registre.ts`) sont lues ou écrites par la synchro. Chaque déclaration porte la table, le schéma zod des champs modifiables, le niveau requis pour lire et pour écrire, et la règle de contribution.
3. **Identifiants côté client.** Une création hors ligne utilise `newId()` (UUID v7) : aucune réécriture d'identifiant à la synchro.
4. **Conflits : la dernière écriture gagne, sans perte silencieuse.** Une écriture envoie la `rev` qu'elle a lue. Si la ligne a changé entre-temps, elle est appliquée quand même, et la version écrasée est gardée dans `core_activity` (action `conflit_synchro`, contenu remplacé dans `resume`). Une suppression l'emporte sur une modification concurrente, et le conflit est journalisé pareil.
5. **Rien de magique à l'écran.** L'indicateur de la barre haute dit « Hors ligne », « 3 modifications en attente » ou « Synchronisé il y a 2 min ». Un conflit ne bloque jamais : il reste dans le journal de la fiche.

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

Les champs de `creer` ne suffisent pas à poser la fiche : le serveur pose l'auteur, la team et la fiche (pour une note : `app = core`, `ficheType = team`, `ficheId = teamId`).

## Conflits, en pratique

- Modification avec la `rev` lue : appliquée, `rev + 1`.
- Modification avec une `rev` dépassée : appliquée, `conflit_resolu`, journal `conflit_synchro` (`motif: modifiee`, `version_remplacee`).
- Modification d'une ligne supprimée : non appliquée, `conflit_resolu`, journal (`motif: supprimee`, `version_ecrite`).
- Suppression d'une ligne déjà supprimée : sans effet, `appliquee`.
- Suppression avec une `rev` dépassée : appliquée, `conflit_resolu`, journal (`motif: supprimee_apres_modification`).

`src/core/synchro/conflit.ts` contient les décisions, sans accès à la base.

## Client

- Base locale par compte et par team : `elsass-racing-<userId>-<teamId>`. Magasins : une table par table synchronisable (`core_note`), `operations_en_attente`, `curseurs`.
- `MoteurSynchro` (`src/core/synchro/client/moteur.ts`) : `ecrireLocal` met à jour la base locale tout de suite et ajoute l'opération à la file. Une seule synchro à la fois : pousser la file, puis tirer.
- Déclenchements : au démarrage, au retour du réseau (`online`), toutes les 60 s quand l'onglet est visible, et 2 s après une écriture locale. Après un échec réseau : attente croissante, plafonnée à une minute (`attente.ts`).
- Hooks : `useTable(table)` (lignes locales, sans les supprimées, mises à jour à chaque changement) et `useEtatSynchro()`.
- Déconnexion : la page de connexion retire les bases des comptes déconnectés, sauf celles qui ont encore des modifications en attente (les effacer perdrait ces modifications).

## Limites connues

- Pas de worker en arrière-plan : la synchro tourne dans l'onglet ouvert.
- Une seule table synchronisable : `core_note`. Les autres apps viendront avec leurs écrans.
- Les auteurs sont affichés « Toi » ou « Un membre » : pas encore de nom sur les notes.
- Le conflit est visible dans le journal de la fiche, pas dans une interface dédiée.
- Le rejeu d'une écriture n'est sûr que si le serveur a bien reçu la première : l'idempotence repose sur `idOperation`.

## Vérification

- Unitaires : curseur, conflit, contribution, attente, protocole (idempotence du résultat noté).
- Base : `pnpm db:verifier-synchro` (deux appareils simulés, conflit journalisé, rejeu idempotent, table refusée, isolement entre teams, contribution).
- E2E : `e2e/hors-ligne.spec.ts`, partie 1 (sans service worker).
