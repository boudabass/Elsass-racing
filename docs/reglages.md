# Réglages

App de gestion de la team et de ses membres. Clé `settings`, nom « Réglages ». Toute action commence par `exigerAcces("settings", niveau)` et émet son événement `settings.*` via `emettre`.

## Rubriques livrées (1.10a)

- **Identité** (`/apps/settings/identite`) : nom, couleurs principale et secondaire, discipline, fuseau. Langue affichée (français). Logo : emplacement réservé.
- **Association** (`/apps/settings/association`) : nom, numéro RNA (format W + 9 chiffres), siège.
- **Membres** (`/apps/settings/membres`) : liste des membres, invitations en attente (renvoyer, annuler), inviter (e-mail, rôle, personne existante ou nouvelle), changer le rôle, retirer.

Événements émis : `settings.identite_modifiee` (identité et association), `settings.membre_invite`, `settings.membre_rejoint`, `settings.membre_retire`, `settings.droits_modifies` (changement de rôle).

## Qui peut quoi

Les rubriques de la team se lisent avec le niveau `lecture` sur Réglages (équipage par défaut). Modifier demande `gestion` (responsable). Sans ce niveau, les champs sont désactivés et la raison est affichée.

**Règle du dernier responsable** (`src/apps/settings/regles.ts`, fonction pure testée) : retirer, rétrograder ou désactiver le seul responsable actif est refusé, avec « Nomme d'abord un autre responsable. ».

## Invitations

1. Création : secret de 32 octets, hash SHA-256 stocké dans `core_invitation.hash`, expiration 7 jours, mail avec le lien `${APP_URL}/invitation?t=…`. Si le mail échoue, l'invitation est retirée.
2. Renvoi : nouveau secret, nouvelle expiration, nouveau mail. L'ancien lien ne marche plus.
3. Lien `/invitation` (route publique) : sans session, le secret est mémorisé dix minutes (`er_invitation`) et la connexion propose l'adresse de l'invitation. Avec session, l'acceptation est immédiate.
4. Acceptation : l'adresse du compte doit être celle de l'invitation. Adhésion créée ou réactivée, personne liée, `accepteeAt` posé, `settings.membre_rejoint` émis. Un secret ne sert qu'une fois.
5. La fonction `core_invitation_active_par_hash` (SECURITY DEFINER) lit l'invitation hors team. Même règle que `core_invitation_en_attente` : son propriétaire doit être superutilisateur ou BYPASSRLS.

## Rubriques complétées (1.10a, suite)

- **Rôles et droits** (`/apps/settings/droits`) : une carte par membre, un sélecteur de niveau par app. Une case différente du défaut du rôle est surlignée. « Revenir aux droits du rôle » supprime les exceptions du membre. Un responsable garde la gestion de Réglages (`niveauAutorise`, fonction pure testée). Événement `settings.droits_modifies`.
- **Apps** (`/apps/settings/apps`) : activer ou désactiver, monter et descendre (le glisser-déposer viendra plus tard). Une app requise par une autre activée ne peut pas être désactivée (« Requise par <app> »). Réglages ne peut pas être désactivée. Événements `settings.app_activee`, `settings.app_desactivee`, `settings.ordre_apps_modifie`. Dépendances en fonction pure (`droits-regles.ts`, testée).
- **Mode terrain** : préférence de membre (`settings_member_pref.modeTerrain`), créée à la demande. Le cookie `er_terrain` n'existe plus.
- **Jour d'épreuve** : réglage de la team dans Identité (`settings_team_pref.terrainProposeJourEpreuve`). Le bandeau du QG le respecte.
- **Aperçu couleur** : dans Identité, les deux sélecteurs de couleur mettent à jour en direct une barre haute et une tuile, dans les deux thèmes, avec le contraste de la team.

## Pas encore livré

- **Rubriques personnelles** (notifications, affichage, appareils, données, compte) : 1.10b.
- **Logo** : emplacement réservé, en attente du stockage des fichiers.

## Données

- `settings_team_pref` : une ligne par team (ludique, proposition du mode terrain).
- `settings_member_pref` : préférences d'un membre (thème, taille de texte, mode terrain, heures calmes, apps découvertes).
- `settings_deletion_request` : demandes de suppression (compte ou team), avec délai de purge.
- Ces trois tables sont cloisonnées par RLS (cf. `docs/droits.md`). Le contrôle `pnpm db:verifier-rls` vérifie qu'aucune table publique avec `team_id` n'est sans RLS.
