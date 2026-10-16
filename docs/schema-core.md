# Tables du socle (`core_`)

État au 16/10/2026 : 31 tables et 19 enums, dans `prisma/schema.prisma`. Les règles de nommage et de colonnes communes sont dans [`conventions-schema.md`](conventions-schema.md).

Les renvois sont au niveau des sections des articles Odoo : le cahier des charges est dans Odoo (948 pour le socle, 960 pour les actions, 962 pour les rôles et droits). Ce document ne reprend que le rôle de chaque table.

## Plateforme et accès (Odoo 948, section 2 ; Odoo 962, section 4)

| Table | Rôle |
|---|---|
| `core_team` | Team : racine de toutes les données, son id est la `team_id` de tout le reste. |
| `core_user` | Compte personnel. Un compte peut appartenir à plusieurs teams. |
| `core_auth_token` | Jeton de connexion (lien ou code). Seul le hash du secret est stocké. |
| `core_invitation` | Invitation à rejoindre une team, par email ou téléphone. |
| `core_device` | Appareil d'un compte (notifications, synchronisation). |
| `core_membership` | Adhésion d'un compte à une team, avec son rôle et son statut. |
| `core_app` | Catalogue global des apps (clé, nom, icône, version, apps requises). |
| `core_team_app` | Apps activées pour une team, avec la version installée et l'ordre. |
| `core_role_default` | Niveau d'accès par défaut d'un rôle à une app (4 rôles × 11 apps). |
| `core_app_access` | Niveau d'accès effectif d'une adhésion à une app. |

## Référentiels partagés (Odoo 948, section 3)

| Table | Rôle |
|---|---|
| `core_person` | Personne physique : pilote, copilote, membre, ou contact d'une entreprise. Peut être liée à un compte et à une entreprise. |
| `core_season` | Saison sportive d'une team, une par année. |
| `core_event` | Événement sportif (rallye, slalom, course de côte...) rattaché à une saison. |
| `core_event_entry` | Engagement d'un véhicule et de son équipage sur un événement. |
| `core_vehicle` | Véhicule de la team (course, reconnaissance, assistance, remorque). |
| `core_contact` | Entreprise ou organisme : partenaire, fournisseur, ASA, photographe, prestataire. |
| `core_tag` | Étiquette de la team, éventuellement limitée à une app. |

## Services transversaux (Odoo 948, section 4 ; Odoo 960, section 4.2 pour `core_action`)

| Table | Rôle |
|---|---|
| `core_file` | Fichier stocké hors base (photo, ticket, document), avec son empreinte. |
| `core_attachment` | Rattache un fichier à une fiche d'une app, avec son rôle (ticket, preuve, photo, document). |
| `core_activity` | Journal d'activité d'une fiche. |
| `core_note` | Note libre sur une fiche. |
| `core_task` | Tâche rattachée à une fiche ou à un événement, assignable à une personne. |
| `core_alert` | Alerte à traiter, de niveau info, orange ou rouge. |
| `core_action` | Action qui attend une décision humaine, avec ses boutons et ses destinataires. |
| `core_notification` | Notification envoyée à un membre, sur un canal donné. |
| `core_notification_pref` | Préférence de notification d'un membre, par app, type et canal. |
| `core_domain_event` | Événement de domaine émis par une app, à livrer aux autres apps. |
| `core_event_delivery` | Livraison d'un événement de domaine à une app destinataire, avec ses tentatives. |
| `core_sync_cursor` | Position de synchronisation d'un appareil pour une team (format fixé en 1.11). |
| `core_search_index` | Index plein texte d'une fiche (colonne `vecteur` générée, index GIN). |
| `core_export` | Demande d'export, et fichier produit une fois prêt. |

## Clés étrangères notables

- `core_team.logo_file_id`, `core_person.photo_file_id`, `core_vehicle.photo_file_id` pointent vers `core_file` (SetNull).
- `core_attachment.file_id` : `Cascade` (un rattachement disparaît avec son fichier). `core_action.event_id` : `SetNull`.
- `core_app_access.membership_id`, `core_notification.destinataire_membership_id`, `core_notification_pref.membership_id`, `core_auth_token.user_id`, `core_device.user_id`, `core_sync_cursor.device_id`, `core_domain_event` → `core_event_delivery` : `Cascade`.
- Toutes les relations vers `core_team` sont en `Restrict`.
