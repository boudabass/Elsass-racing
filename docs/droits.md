# Droits par app et cloisonnement par team

## Niveaux

Ordre croissant : `aucun` < `lecture` < `contribution` < `ecriture` < `gestion`. Défini dans `src/core/droits/niveaux.ts`.

## Résolution du niveau

Pour une membership et une app :

1. Une ligne `core_app_access` de la membership pour cette app prime, même si elle est plus basse que le défaut.
2. Sinon, la ligne `core_role_default` du rôle de la membership pour cette app.
3. Sinon, `aucun`. C'est le cas d'une app inconnue, ou d'un rôle sans défaut.

Les 44 défauts (4 rôles × 11 apps) sont dans `src/core/catalogue.ts`, écrits en base par le seed.

## Garde des actions

Toute Server Action qui touche une app commence par :

```ts
const { team, membership, niveau } = await exigerAcces("budget", "ecriture")
```

`exigerAcces` lit la session, la team courante et la membership, calcule le niveau effectif, et lève `ErreurAcces` avec la raison : `non_connecte`, `aucune_team` ou `niveau_insuffisant`. `libelleErreurAcces(erreur)` donne le message en français, qui dit toujours pourquoi.

## Cloisonnement en base (RLS)

- L'application se connecte avec le rôle `elsass_racing_app_dev`, qui hérite du rôle `elsass_racing_app` (NOLOGIN, non superutilisateur). Les politiques RLS s'appliquent à ce rôle.
- Chaque requête sur des données de team passe par `prismaPourTeam(teamId, userId)` : une transaction qui pose `app.team_id` et `app.user_id` (`set_config`, portée transaction), puis exécute la requête.
- `prismaPourCompte(userId)` ne pose que `app.user_id`, pour lister les teams d'un compte et choisir l'une d'elles.
- Le client nu `prisma` ne sert qu'à l'authentification.
- Toute table qui porte `team_id` a une politique `cloisonnement_team` (FOR ALL) : lecture et écriture limitées à la team courante, et `WITH CHECK` refuse une écriture dans une autre team.
- `core_membership` ajoute une lecture de ses propres adhésions (`adhesions_du_compte`).
- `core_team` est lisible si c'est la team courante ou une team où le compte a une adhésion active ; modifiable seulement par la team courante. Pas de création ni de suppression par l'application.
- Vérification : `pnpm db:verifier-rls` (`scripts/verifier-cloisonnement.ts`).

## Les deux URL

| Variable | Rôle | Utilisée par |
|---|---|---|
| `DATABASE_URL` | Rôle applicatif (`elsass_racing_app_dev` en local), soumis au RLS | l'application (`src/lib/prisma.ts`) |
| `DATABASE_URL_MIGRATION` | Rôle propriétaire (`elsass_racing` en local), contourne le RLS | migrations (`prisma.config.ts`, entrypoint), seed, `team:creer`, vérification |

Le rôle propriétaire ne doit jamais être utilisé par l'application. En production, le rôle applicatif ne doit être ni superutilisateur, ni propriétaire des tables.

## Exceptions au RLS

Ces tables n'ont pas de politique de cloisonnement, parce que ce sont des données de compte ou des référentiels, lus avant qu'une team soit choisie. Leur accès est filtré par le code :

- `core_user`, `core_auth_token`, `core_device` : comptes et jetons de connexion.
- `core_app`, `core_role_default` : catalogue et défauts, globaux.

La fonction `core_invitation_en_attente(adresse)` est `SECURITY DEFINER` : elle lit les invitations sans team courante, pour la décision d'envoi d'une connexion. Son propriétaire doit être superutilisateur ou BYPASSRLS, sinon elle ne voit aucune invitation et répond faux, ce qui revient à ne jamais envoyer à une adresse invitée.
