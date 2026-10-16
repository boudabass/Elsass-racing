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

## Pas encore livré (1.10a, suite)

- **Rôles et droits** (niveaux par app par membre, bouton « revenir aux droits du rôle ») : rubrique affichée comme « arrive bientôt ».
- **Apps** (activer, désactiver, ordre, dépendances requises) : même traitement. La règle des dépendances reste à écrire (fonction pure).
- **Mode terrain en préférence de membre** : le cookie `er_terrain` reste la source. Migration vers `settings_member_pref.modeTerrain` à faire, ainsi que le réglage « proposer le mode terrain le jour d'une épreuve » (`settings_team_pref.terrainProposeJourEpreuve`).
- **Rubriques personnelles** (notifications, affichage, appareils, données, compte) : 1.10b.

## Données

- `settings_team_pref` : une ligne par team (ludique, proposition du mode terrain).
- `settings_member_pref` : préférences d'un membre (thème, taille de texte, mode terrain, heures calmes, apps découvertes).
- `settings_deletion_request` : demandes de suppression (compte ou team), avec délai de purge.
- Ces trois tables sont cloisonnées par RLS (cf. `docs/droits.md`). Le contrôle `pnpm db:verifier-rls` vérifie qu'aucune table publique avec `team_id` n'est sans RLS.
