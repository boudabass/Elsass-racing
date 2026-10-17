# Déploiement d'Elsass Racing sur Coolify

Guide pour John, 16/10/2026. Toutes les étapes se font dans l'interface Coolify, projet « Elsass Racing ».

Ressources existantes :
- Application `elsass-racing:main` (uuid `llnr2tnbuhmv2gk86o9iq74n`), domaine https://elsass-racing.theelsassisch.com.
- Base PostgreSQL 18 (uuid `s11u0mbj3iyaik6bhel3c03n`), utilisateur `postgres`, base `postgres`.

Ne lance pas le déploiement avant le feu vert de l'orchestrateur : la branche main ne contient pas encore le code.

## 0. Déploiement automatique

Coolify redéploie l'application à chaque push sur la branche main. Toute fusion dans main part donc en production dans les minutes qui suivent. Le travail se fait sur dev, et la fusion dans main n'a lieu qu'après relecture par l'orchestrateur.

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

Les droits sur les tables sont donnés automatiquement par les migrations au premier démarrage. Après le premier démarrage (étape 7), lance la requête de vérification de l'étape 8.1 : les deux colonnes doivent afficher `t`. Avant ce démarrage, les tables n'existent pas encore, la requête échoue : c'est normal.

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

Onglet Health Check : chemin `/api/sante`, port 3000, code attendu 200. La route existe sur main depuis la fusion de la 1.12. Elle répond `{"ok":true}` si tout passe (base, droits du rôle de l'app, catalogue des 11 apps), sinon 503 avec une raison courte, par exemple `{"ok":false,"raison":"droits du rôle de l'app incomplets"}`.

Le health check est actif depuis le 16/10/2026. L'image contient `curl`, que Coolify utilise pour l'appeler depuis le conteneur : sans lui, Coolify refuse tout nouveau conteneur et garde l'ancien.

## 7. Premier déploiement

Au feu vert de l'orchestrateur : Deploy. Au démarrage, le conteneur applique les migrations (tables, cloisonnement, catalogue des apps), puis démarre. Dans les logs, tu dois voir `→ prisma migrate deploy`, la liste des migrations appliquées, puis `→ démarrage`.

Vérification : https://elsass-racing.theelsassisch.com affiche la page de connexion, et https://elsass-racing.theelsassisch.com/api/sante répond `{"ok":true}`.

## 8. Première team (team de test)

La première team est une team de test : « The Elsassisch Racing Team ». La Koehling Racing Team sera créée plus tard, quand Jeoffrey et Aurélie seront prêts.

La base est neuve : aucun compte n'existe, donc l'app n'envoie aucun mail de connexion tant que la team n'est pas créée. C'est voulu. On la crée depuis ton poste, en ouvrant la base quelques minutes.

### 8.1 Vérifier les droits du rôle de l'app

Base, onglet Terminal, `psql -U postgres -d postgres`, puis :

```sql
GRANT elsass_racing_app TO elsass_racing_web;
SELECT has_table_privilege('elsass_racing_web', 'core_user', 'SELECT') AS lecture_comptes,
       has_table_privilege('elsass_racing_web', 'core_team', 'INSERT') AS ecriture_teams;
```

Les deux colonnes doivent afficher `t`. Sinon, ne va pas plus loin et préviens l'orchestrateur. Tape `\q` pour quitter.

### 8.2 Ouvrir la base

Base, coche « Make it publicly available ». Dans « Public Port », mets `54330` (un port libre, différent de ceux des autres bases), enregistre.

### 8.3 Créer la team

Dans Git Bash. Remplace seulement `MOT_DE_PASSE_POSTGRES` par le mot de passe de l'utilisateur postgres (celui de l'URL interne de la base). L'adresse 37.59.108.111 est celle du VPS.

```
cd "/c/Users/George/Desktop/The Elsassisch/Projet/Elsass Racing"
export DATABASE_URL_MIGRATION='postgresql://postgres:MOT_DE_PASSE_POSTGRES@37.59.108.111:54330/postgres'
pnpm team:creer --nom "The Elsassisch Racing Team" --slug the-elsassisch-racing-team --email theelsassisch@gmail.com --prenom-responsable Prénom --nom-responsable Nom
unset DATABASE_URL_MIGRATION
```

Les arguments `--prenom-responsable` et `--nom-responsable` sont obligatoires : la commande crée aussi la fiche personne du responsable, liée à son compte et à son adhésion. Sans elle, le responsable n'est ni pilote, ni dans les soldes Budget. `--nom` reste le nom de la team.

Résultat attendu : un message qui confirme la team, le responsable (nom, prénom et adresse) et les 11 apps activées. Si la commande dit que la team existe déjà, rien n'a été créé en double.

### 8.4 Refermer la base

Décoche aussitôt « Make it publicly available » et enregistre. La base ne doit jamais rester ouverte.

### 8.5 Se connecter

1. Va sur https://elsass-racing.theelsassisch.com.
2. Saisis theelsassisch@gmail.com, puis « Recevoir mon lien ».
3. Utilise le lien ou le code reçu par mail.
4. Tu arrives sur le QG de « The Elsassisch Racing Team », rôle responsable.

La team de test est vide : pas de saison ni d'épreuve, donc ni compte à rebours ni bouton Prochaine étape. C'est normal.

### 8.6 Remplir la team de test (facultatif)

Pour remplir la team de test avec la saison 2026 de la Saxo (véhicule, deux pilotes, neuf épreuves, engagements) : ouvre la base comme en 8.2, lance la commande sur une ligne, puis referme la base comme en 8.4. Le script est idempotent : le relancer ne crée pas de doublon.

```
cd "/c/Users/George/Desktop/The Elsassisch/Projet/Elsass Racing" && DATABASE_URL_MIGRATION='postgresql://postgres:MOT_DE_PASSE_POSTGRES@37.59.108.111:54330/postgres' pnpm donnees:koehling --slug the-elsassisch-racing-team
```

### Remarques

- Ces commandes supposent `pnpm install` déjà fait dans le dossier du projet.
- `DATABASE_URL_MIGRATION` exportée l'emporte sur `.env.local` : les scripts n'écrasent pas une variable déjà posée. Ils n'ont pas besoin de `DATABASE_URL`.
- Si le mot de passe postgres contient `@`, `:`, `/` ou `#`, préviens l'orchestrateur avant : il faut l'encoder dans l'URL.
- Pour inviter quelqu'un ensuite : Réglages, Membres, Inviter. La personne reçoit le lien par mail.

## 9. Sauvegardes

Base, onglet Backups : active une sauvegarde quotidienne. Une restauration se fait toujours dans une base vide, jamais par-dessus la production.
