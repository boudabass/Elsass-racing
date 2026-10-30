# Documents : schéma (tâche 5.3, point d'arrêt)

Statut : **schéma validé le 28/10 (arbitrages ci-dessous) ; migration en cours**. Point d'arrêt d'origine, brief `docs/briefs/5.3-documents-coffre-fort.md` §2). Spécification : article Odoo 957 (Documents v1.1, 15/10/2026), §3 « Tables » et « Événements ». Socle : 948 ; catalogue : 962 ; modèle : `docs/schema-equipe.md`.

## Décisions reprises du brief (orchestrateur, 28/10)

- **Préfixe `documents_`**, snake_case, bloc commun sur les 7 tables (`team_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `rev`), UUID v7 côté client, RLS `cloisonnement_team` forcée, droits du rôle applicatif comme `equipe_`. `documents_share_log` porte le bloc commun aussi.
- **Pas de clé étrangère vers une autre app.** Personnes : `core_person`. Contacts : `core_contact`. Fichiers : `core_attachment` (rôle `document`, seul rôle de fichier prévu ici ; le rôle `document_version` de 957 n'existe pas dans l'enum du socle, on n'en invente pas). Alertes : `core_alert`. Aucune table `voiture_`, `equipe_` ou autre n'est référencée.
- **Dossiers types** : sept, créés à la première écriture de la team, `kind = systeme`. Une lecture n'écrit jamais.
- **Complétude** : `expected_count` sur le dossier reprend les nombres du brief (Association 3, Assurances 1, Règlements 1) ; les autres dossiers n'ont pas de jauge (`expected_count` vide).
- **Archiver plutôt que supprimer** : `documents_doc.status` (`actif` / `archive`). Pas de suppression de document en 5.3 ; `deleted_at` reste réservé aux dossiers perso supprimés vides.
- **Hors ligne** : aucune table au registre de synchro (`src/core/synchro/registre.ts` inchangé).

## Écarts validés par l'orchestrateur (28/10)

1. **Document sans fichier** : ni ligne `documents_version`, ni `current_version_id`. La fiche affiche « Aucun fichier » et un bouton « Ajouter un fichier », qui crée la version 1.
2. **Visibilité sur le document et sur le dossier**, team par défaut. `peutVoirDocument` applique la plus stricte des deux (règles dans `src/apps/documents/regles.ts`).
3. **`uploaded_by` et `granted_by` facultatifs**, vers `core_person`. Un compte sans fiche personne n'est jamais bloqué pour envoyer un fichier ; l'écran affiche alors le nom du compte (repli `libelleAuteur`, testé). `created_by` du bloc commun reste l'identifiant de compte.
4. **`current_version_id`** est une clé vers `documents_version`, nullable. Les deux clés croisées (`documents_doc.current_version_id` et `documents_version.doc_id`) sont en `ON DELETE RESTRICT`. La clé `current_version_id` est créée dans la migration **après** les deux tables.
5. **`documents_version.attachment_id` obligatoire.** Ordre dans la transaction : générer l'id de la version ; créer le rattachement (fiche `documents_version`, `fiche_id` = cet id, rôle `document`) ; insérer la version avec `attachment_id` = l'identifiant renvoyé par `rattacherFichier` (socle, commit `3cdaa80`).
6. `parent_id` gardé sur `documents_folder`, vide en 5.3.
7. **Tables 5.4 créées sans service ni écran** : `documents_deadline`, `documents_share`, `documents_share_log`. `documents_access` est utilisée en 5.3.

## Enums

| Enum (SQL) | Valeurs | Usage |
|---|---|---|
| `documents_kind_dossier` | `systeme`, `perso` | `documents_folder.kind` |
| `documents_visibilite` | `team`, `gestion`, `prive` | `documents_folder.visibility`, `documents_doc.visibility` |
| `documents_type_document` | `statuts`, `recepisse_rna`, `pv_ag`, `reglement_ffsa`, `reglement_particulier`, `modele`, `assurance_asso`, `attestation`, `autre` | `documents_doc.doc_type` |
| `documents_statut` | `actif`, `archive` | `documents_doc.status` |
| `documents_niveau_acces` | `lecture`, `contribution` | `documents_access.level` |
| `documents_zone` | `vert`, `orange`, `rouge` | `documents_deadline.zone` |
| `documents_etape_alerte` | `J60`, `J30`, `J7`, `expire` | `documents_deadline.last_alert_step` |

## Tables (7)

Bloc commun sur chaque table. Dates : `DATE` (jour civil, minuit UTC). Pas de montant.

### documents_folder : dossiers du coffre-fort

| Colonne | Type | Règle |
|---|---|---|
| `name` | texte | obligatoire |
| `icon` | texte | facultatif (icône par défaut si vide) |
| `kind` | enum `documents_kind_dossier` | obligatoire, défaut `perso` |
| `parent_id` | uuid → `documents_folder` | facultatif. **Vide en 5.3** |
| `sort` | entier | obligatoire, défaut `0` |
| `expected_count` | entier | facultatif, >= 0. Nombre de types attendus (jauge), seulement pour les dossiers types |
| `visibility` | enum `documents_visibilite` | obligatoire, défaut `team` |
| `owner_person_id` | uuid → `core_person` | facultatif |

**Contraintes**
- Un seul dossier type par team : index unique `(team_id, name)` **WHERE `kind = 'systeme'` AND `deleted_at IS NULL`**. C'est la garde contre les doublons sous deux écritures concurrentes (reprise par `avecReprisePourConflit`).
- `expected_count` >= 0 si renseigné.

### documents_doc : document propre à la team

| Colonne | Type | Règle |
|---|---|---|
| `folder_id` | uuid → `documents_folder` | obligatoire |
| `title` | texte | obligatoire |
| `doc_type` | enum `documents_type_document` | obligatoire |
| `reference` | texte | facultatif (ex. numéro RNA seul) |
| `issued_on` | date | facultative |
| `valid_until` | date | facultative |
| `owner_person_id` | uuid → `core_person` | facultatif (propriétaire, utile pour l'assistance) |
| `notes` | texte | facultatives |
| `status` | enum `documents_statut` | obligatoire, défaut `actif` |
| `visibility` | enum `documents_visibilite` | obligatoire, défaut `team` (écart 2) |
| `current_version_id` | uuid → `documents_version` | facultatif (écart 1 et 4) |

**Contraintes**
- `valid_until >= issued_on` quand les deux sont renseignées.

### documents_version : fichiers d'un document (historique)

| Colonne | Type | Règle |
|---|---|---|
| `doc_id` | uuid → `documents_doc` | obligatoire |
| `version_no` | entier | obligatoire, à partir de 1, croissant par document |
| `attachment_id` | uuid → `core_attachment` | obligatoire (écart 5) |
| `uploaded_by` | uuid → `core_person` | facultatif (repli : nom du compte, écart 3) |
| `uploaded_at` | timestamptz | obligatoire, défaut maintenant |
| `comment` | texte | facultatif (commentaire de la nouvelle version) |

**Contraintes**
- `(doc_id, version_no)` unique, **sans** condition sur `deleted_at` : une version ne se retire pas, elle reste dans l'historique.
- Une nouvelle version ne remplace jamais l'ancienne en base : on ajoute une ligne et on déplace `current_version_id`.

### documents_deadline : échéances centralisées (tables 5.4, pas de service en 5.3)

| Colonne | Type | Règle |
|---|---|---|
| `source_app` | texte | obligatoire (ex. `documents`, `voiture`, `equipe`) |
| `source_table` | texte | obligatoire. Pas de clé : c'est un nom de table lu par l'app 5.4 |
| `source_id` | uuid | obligatoire. Pas de clé : la fiche d'origine reste dans son app |
| `label` | texte | obligatoire |
| `due_on` | date | obligatoire |
| `zone` | enum `documents_zone` | obligatoire |
| `last_alert_step` | enum `documents_etape_alerte` | facultatif |
| `snoozed_until` | date | facultative (reporter) |
| `alert_id` | uuid → `core_alert` | facultatif |
| `resolved_at` | timestamptz | facultatif |

### documents_access : partage interne d'un document à un membre

| Colonne | Type | Règle |
|---|---|---|
| `doc_id` | uuid → `documents_doc` | obligatoire |
| `person_id` | uuid → `core_person` | obligatoire |
| `level` | enum `documents_niveau_acces` | obligatoire |
| `granted_by` | uuid → `core_person` | facultatif (repli : nom du compte, écart 3) |
| `granted_at` | timestamptz | obligatoire, défaut maintenant |

**Contraintes**
- Un accès actif par `(doc_id, person_id)` : index unique **WHERE `deleted_at IS NULL`**. Retirer un accès = `deleted_at`.

### documents_share : lien de partage externe (table 5.4, pas de service en 5.3)

| Colonne | Type | Règle |
|---|---|---|
| `doc_id` | uuid → `documents_doc` | obligatoire |
| `token_hash` | texte | obligatoire, **unique** (jamais le jeton en clair) |
| `recipient_label` | texte | facultatif |
| `recipient_contact_id` | uuid → `core_contact` | facultatif |
| `expires_at` | timestamptz | obligatoire |
| `revoked_at` | timestamptz | facultatif |
| `open_count` | entier | obligatoire, défaut `0`, >= 0 |
| `last_opened_at` | timestamptz | facultatif |

### documents_share_log : journal des ouvertures d'un lien (table 5.4)

| Colonne | Type | Règle |
|---|---|---|
| `share_id` | uuid → `documents_share` | obligatoire |
| `opened_at` | timestamptz | obligatoire |
| `ip_hash` | texte | facultatif (haché, jamais l'IP en clair) |
| `user_agent` | texte | facultatif |

## Index

Sur chaque table : `team_id` et `(team_id, deleted_at)`. En plus :
- `documents_doc (folder_id)`, `documents_doc (owner_person_id)` ;
- `documents_version (doc_id)`, `documents_version (attachment_id)` ;
- `documents_access (person_id)` ;
- `documents_share (doc_id)`, `documents_share_log (share_id)` ;
- `documents_deadline (source_app, source_id)`.

## Qui écrit quoi

| Écrit par Documents | Table(s) | Quand |
|---|---|---|
| Services de Documents, à la première écriture de la team (même transaction, sans doublon) | `documents_folder` (7 dossiers `systeme`) | première écriture de Documents dans la team |
| Services 5.3 | `documents_folder` (perso, renommer, supprimer vide, `visibility`) | niveau écriture |
| Services 5.3 | `documents_doc`, `documents_version`, `documents_access` | niveau écriture, ou assistance sur ses documents |
| Socle (`rattacherFichier`, appelé par Documents) | `core_attachment` (app `documents`, fiche `documents_version`, rôle `document`) | à chaque version ; l'id renvoyé devient `attachment_id` |
| Services 5.4 | `documents_deadline`, `documents_share`, `documents_share_log` | non écrit en 5.3 |

Lues, jamais écrites ici : `core_person`, `core_contact`, `core_attachment`, `core_alert` (5.4).

**Événements émis** (catalogue 962) : `documents.document_ajoute` à la création d'un document propre ; `documents.reglement_publie` à la création d'un document `reglement_ffsa` ou `reglement_particulier`, en plus du premier. Pas à une nouvelle version.

**Aucune écriture dans une table d'une autre app.** Les papiers de Voiture, les licences d'Équipe, etc. restent là où ils sont ; la vue unifiée (`core_attachment`) vient en 5.4.

## Cloisonnement et vérification

- RLS forcée et politique `cloisonnement_team` sur les 7 tables (`core_team_courante()`).
- Vérification en base : `scripts/verifier-documents.ts` (`pnpm db:verifier-documents`), jouée par le job `complet` de `.github/workflows/verifications.yml`. Contrôles : une team ne voit pas l'autre ; contraintes ci-dessus ; dossiers types créés une seule fois sous deux écritures concurrentes ; une nouvelle version ne remplace pas l'ancienne en base.
- Migration : `prisma/migrations/<horodatage>_documents_schema`, écrite (ou complétée à la main) après `pnpm db:migrate --create-only`, relue. Appliquée et vérifiée par GitHub Actions : pas de Docker sur le poste.

## Ajouts de la tâche 5.4 (brief `docs/briefs/5.4-documents-echeances-partages.md`, §2)

- Migration `20261030100000_documents_echeances_partages` : **un seul index unique partiel**, pas de colonne ni de table nouvelle. `documents_deadline_document_actif_key` sur `(team_id, source_table, source_id)` WHERE `deleted_at IS NULL AND resolved_at IS NULL` : une échéance active par document propre sous deux recalculs concurrents (reprise par `avecReprisePourConflit`).
- `documents_deadline` ne sert qu'aux documents propres (`source_app = 'documents'`, `source_table = 'documents_doc'`). Les échéances reçues (papiers de Voiture, licences et homologations d'Équipe) se lisent par les lectures partagées de l'app d'origine, sans copie.
- Gestionnaires absents : `voiture.papier_expire_bientot`, `equipe.licence_expire_bientot`, `equipe.homologation_expire_bientot` restent écoutés par Documents dans le catalogue, sans effet (comme Saison depuis la 5.2b).
- `documents_share.token_hash` unique (déjà en 5.3). Le jeton n'est jamais en base.
