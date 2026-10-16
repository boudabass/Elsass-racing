# Elsass Racing

Plateforme d'apps internes pour les teams de sport auto amateur. PWA Next.js, PostgreSQL, Coolify. Première team : Koehling Racing Team. Multi-team dès la première ligne.

Ce fichier ne contient que les règles, les pièges et l'état actuel. Le récit du projet va dans `documentation/JOURNAL.md`. Les spécifications font foi et vivent dans Odoo Knowledge, hub « Elsass Racing » (article 944) : socle 948, enveloppe du QG 960, catalogue des événements, widgets et droits 962, suivi 961. Le plan de travail est dans `docs/plan-developpement.md`.

## Règles de la plateforme (non négociables)

1. Une app, un métier. Aucune app principale. Le Tableau de bord est une app comme les autres.
2. Proposer, ne jamais écrire chez les autres. Une app ne modifie jamais les tables d'une autre app. Elle émet un événement du catalogue 962, le socle crée une `core_action`, la décision revient à l'app d'origine par `core.action_decidee`.
3. Pas d'IA dans l'app. Saisie manuelle, règles simples et prévisibles.
4. Motorsport Manager est la référence fonctionnelle pour tout choix non tranché (article 953).
5. Ludique uniquement sur données officielles validées. Motivant, jamais contraignant, jamais pénalisant.
6. Aucun nom de table, d'événement, de rôle ou de niveau de droit inventé. Tout vient des articles 948, 960 et 962. Un événement inconnu du catalogue est refusé à l'émission.
7. Quatre rôles de compte : responsable, équipage, assistance, invité. Cinq niveaux d'accès par app : aucun, lecture, contribution, écriture, gestion.
8. Interface en français, vocabulaire du rallye, zéro jargon technique à l'écran. Tout bouton refusé affiche la raison.

## Conventions de code et de données

- Tables préfixées : `core_` pour le socle, `<clé d'app>_` pour chaque app. snake_case en base.
- Chaque ligne (sauf `core_user` et `core_app`) porte `team_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `rev`. UUID v7 générés côté client. Montants en centimes, dates en UTC.
- Une app vit dans `src/apps/<clé>/` avec son `manifest.ts`. Le socle est dans `src/core/`. L'enveloppe du QG dans `src/components/qg/`.
- Server Actions : un fichier `'use server'` n'exporte que des actions, chacune contrôle elle-même la session et les droits. Les utilitaires serveur vont dans `src/lib/*-serveur.ts`.
- Redirection dans une route API : chemin relatif, jamais `new URL(x, request.url)`.
- Tests Vitest obligatoires sur ce qui porte des règles : droits, priorités du bouton Prochaine étape, synchronisation, validation des événements.

## Outils et workflow

- pnpm uniquement, jamais npm. Versions épinglées sur Elsass Dico (voir `docs/stack-reference.md`) : Next 15.5.27, React 19.3, Prisma 7.10.0, Tailwind 3.4.17, Node 22, pnpm 11.21.0.
- Après chaque groupe de changements : `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Branches : travail sur `dev`, fusion `dev` vers `main` par commit de merge, jamais de squash. Messages de commit en français, impératif, courts. Une tâche, un commit.
- Migrations Prisma : dossiers SQL dans `prisma/migrations/`, appliquées par le conteneur au démarrage (`prisma migrate deploy`). Jamais à la main en production, jamais `migrate dev` en production.
- Mesurer avant d'écrire en base : script jetable en lecture seule, supprimé après. Aucune écriture de test en base partagée.
- Coolify : lecture seule via MCP. Déploiement vérifié quand `updated_at` avance et que le code servi contient le changement.
- Windows : ne jamais désactiver `core.protectNTFS`. Pas de `?` dans les noms de fichiers.
- Secrets dans `.env.local`, jamais versionnés. `.env.example` liste les noms sans valeur.

## Pièges connus (hérités du Dico)

- `DATABASE_URL` est nécessaire au build et au runtime. Le Dockerfile la prend en `ARG` avec une garde.
- `sw.js` et `manifest` doivent être exclus du matcher du middleware, sinon redirection vers la connexion.
- CSP : `worker-src 'self'` explicite. `'strict-dynamic'` annule `'self'` dans `script-src`.
- Une Server Action en vol ne survit pas à `router.replace`.
- `pnpm-workspace.yaml` doit lister `allowBuilds` pour prisma, @prisma/engines et sharp.
- Un `$` dans une valeur de `.env.local` doit être écrit `\$` : Next interprète les `$` comme des variables (dotenv-expand) alors que dotenv seul, utilisé par les scripts, ne le fait pas. Symptôme vécu : SMTP 535 dans l'app, envoi correct depuis un script. Dans Coolify, les variables ne sont pas expansées : y mettre la valeur brute.

## État actuel

- 16/10/2026 : socle en production sur https://elsass-racing.theelsassisch.com (Coolify, branche main, PostgreSQL 18, guide `docs/deploiement-coolify.md`). Team en production : « The Elsassisch Racing Team », team de test, John responsable ; la Koehling Racing Team réelle viendra plus tard. Lot 1 (socle) terminé : tâches 1.1 à 1.12, hors ligne compris (synchro sur liste blanche, service worker, app installable). Prochain : lot 2, apps Saison et Budget.
- Données de démonstration : `pnpm donnees:koehling [--slug <slug>]` (saison 2026 de la Saxo).
- Production : le rôle de connexion de l'app (`elsass_racing_web`) doit être membre de `elsass_racing_app`, sinon « permission denied » ; `/api/sante` le vérifie. Health check Coolify sur `/api/sante` (curl présent dans l'image).
- Déploiement : **Coolify redéploie automatiquement à chaque push sur main.** Un push sur main est une mise en production immédiate. Fusion dev dans main par commit de merge, uniquement sur feu vert explicite de l'orchestrateur après relecture. L'opérateur s'arrête toujours au push sur dev. Création de team en production : base ouverte quelques minutes, script lancé depuis le poste, base refermée.
- Vérifications en base : `pnpm db:verifier-rls` et `pnpm db:verifier-bus` après toute migration.
- Tests de bout en bout : `pnpm test:e2e` (Playwright, son propre Chromium, port 3100, `.next-e2e`, mail en console, données de test créées et supprimées par `e2e/aide`). Captures dans `docs/captures/`.
- Le serveur dev de John (port 3000) ne s'arrête jamais pendant une tâche. Build de vérification : `NEXT_DIST_DIR=.next-build pnpm build`.
- Briefs de l'orchestrateur dans `docs/briefs/`, un fichier par tâche.
- Hors ligne : une table n'est synchronisée que si son app la déclare dans `src/core/synchro/registre.ts` (voir `docs/synchro.md`). Vérification : `pnpm db:verifier-synchro`. Le test e2e hors ligne tourne sur un serveur de production local (port 3101).
- Deux rôles PostgreSQL : propriétaire (DATABASE_URL_MIGRATION, migrations, seed, scripts) et applicatif restreint soumis au RLS (DATABASE_URL, l'app).
- Base locale : `pnpm db:up` puis `pnpm db:deploy` puis `pnpm db:seed`. Port 5433. Première team : `pnpm team:creer --nom … --slug … --email …`.
- Migrations : `pnpm db:migrate` ne fait que créer le SQL (`--create-only`), relire, compléter à la main si besoin, puis `pnpm db:deploy`.
- Mails : SMTP OVH (port 587, STARTTLS), expéditeur info@theelsassisch.com. Sans SMTP_HOST hors production, le mail s'affiche en console.
- Chrome piloté ne charge pas localhost:3000 sur ce poste (même limite que le Dico) : les parcours se vérifient en HTTP ou par John dans son navigateur.
