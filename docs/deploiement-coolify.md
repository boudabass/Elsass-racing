# Déploiement d'Elsass Racing sur Coolify

Guide pour John, 16/10/2026. Toutes les étapes se font dans l'interface Coolify, projet « Elsass Racing ».

Ressources existantes :
- Application `elsass-racing:main` (uuid `llnr2tnbuhmv2gk86o9iq74n`), domaine https://elsass-racing.theelsassisch.com.
- Base PostgreSQL 18 (uuid `s11u0mbj3iyaik6bhel3c03n`), utilisateur `postgres`, base `postgres`.

Ne lance pas le déploiement avant le feu vert de l'orchestrateur : la branche main ne contient pas encore le code.

## 1. DNS

Vérifie que `elsass-racing.theelsassisch.com` pointe vers le VPS, comme `elsass-dico.theelsassisch.com`. Si les autres sous-domaines .com sont déclarés un par un chez le registrar, ajoute un enregistrement A identique pour `elsass-racing`.

## 2. Base de données

1. Ouvre la base, laisse « Make it publicly available » décoché.
2. Démarre-la (Start) et attends l'état healthy.
3. Note la ligne « Postgres URL (internal) ». Elle ressemble à :
   `postgres://postgres:MOT_DE_PASSE@s11u0mbj3iyaik6bhel3c03n:5432/postgres`

## 3. Rôle de l'application

L'app ne se connecte pas avec le superutilisateur : elle utilise un rôle restreint, soumis au cloisonnement par team. Choisis un mot de passe long, sans `$`, `@`, `:` ni `/` (par exemple 32 lettres et chiffres).

Dans la base, onglet Terminal, lance `psql -U postgres -d postgres`, puis :

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elsass_racing_app') THEN
    CREATE ROLE elsass_racing_app NOLOGIN;
  END IF;
END $$;
CREATE ROLE elsass_racing_web LOGIN PASSWORD 'MOT_DE_PASSE_DU_ROLE_APP';
GRANT elsass_racing_app TO elsass_racing_web;
```

Les droits sur les tables sont donnés automatiquement par les migrations au premier démarrage.

## 4. Variables d'environnement de l'application

Onglet Environment Variables. Toutes sont des variables runtime : décoche « Build Variable » pour chacune.

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `postgresql://elsass_racing_web:MOT_DE_PASSE_DU_ROLE_APP@s11u0mbj3iyaik6bhel3c03n:5432/postgres` |
| `DATABASE_URL_MIGRATION` | l'URL interne notée à l'étape 2, en remplaçant `postgres://` par `postgresql://` |
| `SESSION_SECRET` | 48 caractères aléatoires, différents de ceux du poste (commande ci-dessous) |
| `APP_URL` | `https://elsass-racing.theelsassisch.com` |
| `SMTP_HOST` | `ssl0.ovh.net` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `info@theelsassisch.com` |
| `SMTP_PASSWORD` | le mot de passe brut, **sans** l'antislash devant le `$` (Coolify n'interprète pas les `$`, contrairement à `.env.local`) |
| `MAIL_FROM` | `Elsass Racing <info@theelsassisch.com>` |
| `STOCKAGE_DIR` | `/app/stockage` |

Ne pose pas `NEXT_DIST_DIR` : il ne sert qu'aux builds de vérification en local.

Pour générer `SESSION_SECRET`, dans un terminal Git Bash :

```
openssl rand -base64 36
```

## 5. Volume des fichiers

Onglet Persistent Storage, « Add » :
- Name : `elsass-racing-fichiers`
- Destination Path : `/app/stockage`

## 6. Health check

Onglet Health Check : active-le, chemin `/api/sante`, port 3000, code attendu 200. La route existe sur main depuis la fusion de la 1.12. Elle répond `{"ok":true}` si la base répond, 503 sinon.

## 7. Premier déploiement

Au feu vert de l'orchestrateur : Deploy. Au démarrage, le conteneur applique les migrations (tables, cloisonnement, catalogue des apps), puis démarre. Dans les logs, tu dois voir `→ prisma migrate deploy`, la liste des migrations appliquées, puis `→ démarrage`.

Vérification : https://elsass-racing.theelsassisch.com affiche la page de connexion, et https://elsass-racing.theelsassisch.com/api/sante répond `{"ok":true}`.

## 8. Première team

La base est neuve : aucun compte n'existe, donc aucun mail de connexion ne partira tant que la team n'est pas créée. On la crée depuis ton poste, en ouvrant la base quelques minutes.

1. Base, coche « Make it publicly available », note le port public proposé, enregistre.
2. Dans Git Bash, dossier Elsass Racing (remplace IP_DU_VPS, PORT_PUBLIC et MOT_DE_PASSE_POSTGRES) :

```
export DATABASE_URL_MIGRATION='postgresql://postgres:MOT_DE_PASSE_POSTGRES@IP_DU_VPS:PORT_PUBLIC/postgres'
pnpm team:creer --nom "Koehling Racing Team" --slug koehling-racing-team --email theelsassisch@gmail.com
pnpm donnees:koehling
unset DATABASE_URL_MIGRATION
```

3. Décoche aussitôt « Make it publicly available » et enregistre.
4. Connecte-toi sur https://elsass-racing.theelsassisch.com avec theelsassisch@gmail.com.

Ces commandes supposent `pnpm install` déjà fait dans le dossier du projet. `DATABASE_URL_MIGRATION` exportée l'emporte sur `.env.local` : les scripts chargent `.env.local` sans écraser une variable déjà posée. Ils n'ont pas besoin de `DATABASE_URL` (l'URL de l'app). `pnpm team:creer` refuse une team au même slug : rien n'est créé deux fois.

Pour inviter Jeoffrey et Aurélie ensuite : Réglages, Membres, Inviter. Ils recevront le lien par mail.

## 9. Sauvegardes

Base, onglet Backups : active une sauvegarde quotidienne. Une restauration se fait toujours dans une base vide, jamais par-dessus la production.
