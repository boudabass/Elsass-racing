# Elsass Racing, plan de développement

Version 0.2, 16/10/2026 au soir. Rédigé par l'orchestrateur à partir des articles Odoo Knowledge 946 (cahier des charges), 947 (architecture), 948 (socle v1.3), 953 (UI), 960 (enveloppe du QG) et 962 (catalogue). En cas d'écart avec ces articles, les articles font foi.

## 0. État au 18/10/2026

- **Lot 2 terminé et en production** (Saison et Budget : tâches 2.1 à 2.11, fusion 308be05 le 17/10).
- **Tâches 2.12 à 2.17 en production** (dcf301a, 18/10) : audit technique, navigation allégée, nettoyage du code et socle commun des apps, finitions visuelles, boutons et liens communs, erreurs serveur.
- **Tests** : 392 unitaires, 74 de bout en bout sur le build de production, plus les trois vérifications en base.
- **Suite** : lot 3 (Voiture et Partenaires), puis les lots 4 à 6, puis l'app de démarrage, puis la création de la Koehling Racing Team et les invitations.

### État au 16/10/2026 (historique)

- **Lot 1 terminé.** Toutes les tâches de la section 5 sont faites, testées et fusionnées dans main (dernier merge c0a3292).
- **En production** sur https://elsass-racing.theelsassisch.com (Coolify, health check actif). Team en production : « The Elsassisch Racing Team », team de test, John responsable. Connexion et changement de couleur vérifiés par John sur mobile.
- **Hors ligne en production** depuis le redéploiement du 16/10 au soir (service worker, manifeste, page hors ligne). Reste le test réel sur téléphone.
- **Tests** : 205 unitaires, 21 de bout en bout (dont 2 hors ligne sur serveur de production local), vérifications en base `db:verifier-rls`, `db:verifier-bus`, `db:verifier-synchro`.
- **Ordre réel** : la 1.12 (déploiement) est passée avant la 1.11 (hors ligne), décision de John, pour tester sur téléphone au plus tôt.
- **En cours** : lot 2, Saison et Budget, découpé en section 5 bis. Tâche 2.1 lancée le 16/10 au soir.

## 1. Cap

- Plateforme d'apps internes pour les teams de sport auto amateur, en français, PWA sur téléphone et PC.
- Première team : Koehling Racing Team. Multi-team dès la première ligne de code.
- Règles non négociables : une app un métier, aucune app principale, pas d'IA dans l'app, proposer sans jamais écrire chez les autres, Motorsport Manager comme référence fonctionnelle, ludique uniquement sur données validées.

## 2. Stack (confirmée le 16/10 par le relevé `docs/stack-reference.md`)

Versions épinglées sur celles d'Elsass Dico, pour que John maintienne les deux projets avec les mêmes réflexes :

- Node 22 (Docker), pnpm 11.21.0, Next.js 15.5.27 (App Router, `output: standalone`), React 19.3.0, TypeScript 5.8.
- Prisma 7.10.0 avec `@prisma/adapter-pg`, générateur `prisma-client`, `prisma migrate deploy` au démarrage du conteneur.
- Tailwind CSS 3.4.17 (v3, choix délibéré : mêmes composants shadcn/ui new-york que le Dico, copiés dans `src/components/ui/`), lucide, next-themes.
- Vitest pour les règles (droits, priorités, synchronisation). Le Dico n'a pas de tests, Racing en aura dès le socle.
- PWA faite à la main comme le Dico (manifest.ts et service worker), mais avec un vrai cache hors ligne et une file de synchronisation.
- Docker deux étages et entrypoint repris du Dico, Coolify, PostgreSQL en ressource séparée, port Postgres fermé.
- Authentification par lien mail ou code (article 948), pas de SSO Odoo. Mails par le SMTP d'OVH (section 7).
- Tests de bout en bout Playwright, qui lance son propre Chromium.

## 3. Organisation du code

Un seul paquet Next.js, pas de workspace pnpm multi-paquets : plus simple à empaqueter en Docker et à maintenir, même structure que le Dico. La modularité est portée par les dossiers et par le manifeste de chaque app.

```
elsass-racing/
  src/app/                  routes Next (connexion, QG, /apps/<clé>/...)
  src/core/                 socle : auth, droits, événements, actions, synchro, catalogue d'apps
  src/core/sdk/             contrat d'une app : manifeste, widgets, événements, routes
  src/apps/<clé>/           une app = un dossier : manifest.ts, écrans, widgets, événements, services
  src/components/ui/        shadcn/ui copié du Dico
  src/components/qg/        enveloppe du QG : barre haute, grille, boîte d'actions, bouton +
  src/lib/                  utilitaires, prisma.ts
  prisma/                   schema.prisma (tables core_ puis <clé>_), migrations
  docs/                     ce plan, le relevé de stack, les décisions
  documentation/JOURNAL.md  récit du projet, CLAUDE.md ne garde que les règles
```

Chaque app expose un manifeste : clé, nom, icône, version, apps requises, niveaux de droits, entrées de menu, widgets, événements émis et écoutés. Le socle découvre les apps et construit le QG.

## 4. Lots

Ordre des lots fixé par le cahier des charges, section 10. Chaque lot est définitif, pas une maquette.

| Lot | Contenu | Dépend de |
|---|---|---|
| 1 Socle | monorepo, schéma core_, auth par lien mail ou code, teams et memberships, droits, catalogue d'apps, bus d'événements, core_action, enveloppe du QG, Réglages, hors ligne, déploiement Coolify | rien |
| 2 Saison et Budget | épreuves, engagements, résultats validés, dépenses, recettes, prévisionnel | 1 |
| 3 Voiture et Partenaires | fiche véhicule, plan de déco, prospection, conventions, contreparties, bilans PDF | 1, 2 |
| 4 Garage | carnet, pièces d'usure, stock, pneus, casses | 1, 2 |
| 5 Équipe, Documents, Check-lists | licences, homologations, coffre-fort, listes, bulletins | 1, 2 |
| 6 Médias et Tableau de bord | galerie, dossier de partenariat automatique, widgets, objectifs, trophées | tout |
| 7 Ouverture | autres teams, apps futures (Chrono en premier, puis une app interne qui récupère et affiche les résultats officiels, demandée par John le 16/10) | tout |

## 5. Lot 1, le socle, découpé en tâches opérateur

Chaque tâche est un brief autonome pour l'opérateur. L'orchestrateur relit et valide avant la tâche suivante.

### 1.1 Initialisation du dépôt
- Paquet Next.js unique, versions épinglées sur le Dico, fichiers de config copiés et adaptés depuis le Dico (next.config.ts, prisma.config.ts, tailwind.config.ts, postcss.config.mjs, components.json, tsconfig.json, pnpm-workspace.yaml, Dockerfile, docker-entrypoint.sh, src/lib/prisma.ts, src/lib/utils.ts, src/components/ui/).
- `.gitignore`, `.env.example`, `README.md`, `CLAUDE.md` (écrit par l'orchestrateur), `documentation/JOURNAL.md`.
- `git init`, branches `main` et `dev`, premier commit.
- Livrable : `pnpm typecheck` et `pnpm build` passent, `pnpm dev` affiche une page sombre « Elsass Racing ».

### 1.2 Base de données et conventions
- Prisma, datasource PostgreSQL, base locale de développement en Docker.
- Conventions du socle (article 948, section 1) : UUID v7 générés côté client, `team_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `rev`, montants en centimes, dates en UTC.
- Un helper Prisma ou un générateur qui applique ces colonnes à chaque modèle.
- Livrable : première migration vide qui passe.

### 1.3 Schéma core_, plateforme et accès
- Tables : core_team, core_user, core_auth_token, core_invitation, core_device, core_membership, core_role_default, core_app, core_team_app, core_app_access.
- Seed : les 4 rôles, les 11 apps du catalogue, les droits par défaut de l'article 962 section 4.
- Livrable : migration, seed, tests de lecture.

### 1.4a Schéma core_, référentiels partagés
- core_person, core_season, core_event, core_event_entry, core_vehicle, core_contact, core_tag.
- Livrable : migration `core_referentiels`.

### 1.4b Schéma core_, services transversaux
- core_file, core_attachment, core_activity, core_note, core_task, core_alert, core_action, core_notification, core_notification_pref, core_domain_event, core_event_delivery, core_sync_cursor, core_search_index, core_export.
- Livrable : migration `core_services`, documentation des tables dans `docs/schema-core.md`.

### 1.5 Authentification et sessions
- Connexion par lien mail ou code à 6 chiffres, sans mot de passe (core_auth_token).
- Session par cookie, appareil enregistré dans core_device.
- Sélecteur de team si le compte appartient à plusieurs teams.
- Livrable : page de connexion, page de choix de team, déconnexion.

### 1.6 Droits et cloisonnement
- Row Level Security par team_id sur toutes les tables.
- Résolution des droits : core_app_access sinon core_role_default. Niveaux aucun, lecture, contribution, écriture, gestion.
- Middleware serveur qui refuse toute requête sans team ou sans niveau suffisant, avec la raison renvoyée au client.
- Livrable : tests d'accès croisés entre deux teams.

### 1.7 SDK d'app et catalogue
- Contrat de manifeste, registre des apps, découverte au démarrage.
- Enregistrement des widgets, des événements émis et écoutés, des routes.
- Une app témoin « Réglages » branchée dessus pour valider le contrat.
- Livrable : `packages/app-sdk` documenté dans `docs/app-sdk.md`.

### 1.8 Bus d'événements et boîte d'actions
- core_domain_event et core_event_delivery, noms validés contre le catalogue 962 (refus de tout nom inconnu).
- `*.action_requise` et `*.action_levee` créent ou annulent un core_action, clé d'unicité, regroupement.
- `core.action_decidee` renvoyé à l'app d'origine.
- Règles de priorité du bouton Prochaine étape (article 960, section 5), implémentées comme fonction pure testée.
- Livrable : tests unitaires des 9 priorités et de la proximité d'épreuve.

### 1.9 Enveloppe du QG
- Grille des apps avec badges, pastilles, ligne d'état, calculés depuis core_action, core_alert, core_task.
- Barre haute : logo, saison, prochaine épreuve et compte à rebours, solde, boîte d'actions, recherche, retour au QG.
- Navigation PC (colonne d'icônes, panneau de détail à droite) et téléphone (grille, barre basse).
- Bouton Prochaine étape flottant, bouton + global, boîte d'actions.
- Thème sombre par défaut, couleurs de la team avec contraste garanti, vert orange rouge réservés aux états.
- Livrable : QG fonctionnel avec l'app Réglages seule.

### 1.10a App Réglages, rubriques de la team
- Tables settings_team_pref, settings_member_pref, settings_deletion_request, hash d'invitation, RLS.
- Identité, association, membres et invitations (acceptation par lien), rôles et droits, apps.
- Règles : dernier responsable protégé, invitation 7 jours, dépendances entre apps.

### 1.10b App Réglages, rubriques personnelles
- Notifications, affichage, appareils, données et confidentialité (export, suppression avec délai de 30 jours), mon compte, découverte des apps.
- Livrable : Réglages complet, événements settings.* émis.

### 1.9 ter Ajustements visuels du QG
- À partir des remarques de John sur le QG en local (couleurs, densité, lisibilité, téléphone).

### 1.11 Hors ligne et synchronisation
- Cache local des données de la team (IndexedDB), file d'écritures en attente, synchro par rev et core_sync_cursor.
- Résolution des conflits : dernière révision gagne, journal des conflits.
- Service worker, manifest PWA, installation sur Android, iPhone et PC.
- Livrable : création d'une fiche hors ligne puis synchronisation vérifiée.

### 1.12 Déploiement
- Dockerfile et entrypoint sur le modèle d'Elsass Dico, migrations au démarrage.
- Coolify : application, base PostgreSQL, volume des fichiers, variables d'environnement, sauvegardes quotidiennes.
- Livrable : URL de préproduction accessible, compte de John créé, team Koehling Racing Team créée.

## 5 bis. Lot 2, Saison et Budget, découpé en tâches opérateur

Spécifications : articles Odoo 949 (Saison v1.3) et 950 (Budget v1.1), catalogue 962, UI 953. Un brief détaillé est écrit dans `docs/briefs/` au moment de lancer chaque tâche, après relecture de la précédente.

### 2.1 Saison, schéma et services
- 12 tables `saison_`, RLS, règles pures (statuts, indice de préparation, cycle de validation, prochaine épreuve, clôture), services serveur et événements émis. Aucun écran.
- Brief : `docs/briefs/2.1-saison-schema-services.md`. Fait le 16/10 (75bcf97), relu et accepté.

### 2.2 Saison, calendrier et fiche épreuve
- Brief : `docs/briefs/2.2-saison-calendrier-fiche.md`. Fait le 16/10 (6ec0522, 6958a34, 6704e2e tiroir du +, 897db42), relu et accepté.
- Calendrier (liste et mois, filtres), bouton + « Nouvelle épreuve » en 3 champs, fiche épreuve en onglets (Infos, Engagements, Programme), fiche engagement (inscription, paiement). Masquage des montants pour l'assistance.

### 2.3 Saison, résultats, débrief et saisons
- Brief : `docs/briefs/2.3-saison-resultats-saisons.md`. Fait le 16/10 (a440984), relu et accepté.
- Saisie du résultat, preuve, validation croisée, contestation, écran « Résultats à valider », débrief, écran de fin d'épreuve après validation, historique, création et clôture de saison.

### 2.4 Saison, préparation, reconnaissances, rappels et hors ligne
- Brief : `docs/briefs/2.4-saison-preparation-hors-ligne.md`. Fait le 16/10 (3ee81a2), relu et accepté. Fin de l'étape Saison.
- Panneau « Prêt pour l'épreuve ? » (points absents affichés « pas encore suivi »), reconnaissances, rappels en actions (J-14, J-7, J-3, matin même, lendemain, 48 h) recalculés à l'ouverture du QG, widgets Saison, compte à rebours de la barre haute branché, synchro hors ligne du programme, des spéciales, du débrief et des sorties de reco.

### 2.5 Budget, schéma et services
- Brief : `docs/briefs/2.5-budget-schema-services.md`. Fait le 17/10 (22be414, 7ca4848, 2a14a4c), relu et accepté.
- 8 tables `budget_`, catégories et payeurs par défaut, soldes par membre, remboursements, prévisionnel, propositions venues des autres apps.

### 2.6 Budget, écrans
- Brief : `docs/briefs/2.6-budget-ecrans.md`. Fait le 17/10 (05ce4b6 à efccf38), relu et accepté.
- Mouvements, bouton + « Nouvelle dépense » en 3 champs avec photo du ticket, À confirmer, par épreuve, par membre, prévisionnel, export tableur. Contribution de l'assistance limitée à ses dépenses et à son solde. Le PDF de bilan de saison attend l'outil PDF du lot 3.

### 2.7 Liaisons Saison et Budget
- Brief : `docs/briefs/2.7-liaisons-saison-budget.md`. Fait le 17/10 (8204d81, 65e1587), relu et accepté sous réserve de la 2.8.
- `saison.engagement_paye` vers une dépense proposée, `budget.depense_creee` (catégorie engagement) vers « marquer payé », solde de la barre haute, widgets Budget, dépenses saisies hors ligne en épreuve.

### 2.8 Corrections du lot 2
- Brief : `docs/briefs/2.8-corrections-lot-2.md`. Issu de la vérification complète du lot 2 : caisse de la team en double, prévu visible par l'assistance, synchro des dépenses alignée sur le payeur, espèces dans Saison, filtres du calendrier en tiroir, solde sur téléphone. Fin du lot 2.

## 5 ter. Lot 3, Voiture et Partenaires, découpé en tâches opérateur

Spécifications : articles Odoo 952 (Voiture v1.2) et 951 (Partenaires v1.2), catalogue 962, UI 953. Découpage validé par John le 18/10. Voiture passe avant Partenaires, parce que les contreparties de logo désignent un emplacement sur la voiture.

Décisions de John (18/10) :
- un seul gabarit livré au lot 3, celui de la Saxo (citadine 3 portes, plan `saxo_plan_emplacements.svg` du dossier Koehling) ; les six autres silhouettes viendront plus tard ;
- modèle de convention de base rédigé par l'orchestrateur : `docs/modele-convention.md`, à relire par John avant la tâche 3.5.

### 3.1 Socle : envoi et lecture des fichiers
- Brief : `docs/briefs/3.1-envoi-fichiers.md`. Envoi, stockage (volume `STOCKAGE_DIR`), lecture protégée par team et par droits, compression des photos. Premiers usages : logo de la team (remplace l'icône QG), photo du ticket d'une dépense, fichier de preuve d'un résultat. Fait le 18/10 (15fb8e5 à 36ac8e3), relu et accepté.

### 3.1b Socle : outil PDF
- Brief : `docs/briefs/3.1b-outil-pdf.md`. Outil PDF commun (@react-pdf/renderer, polices Barlow), premier usage : le bilan de saison de Budget. Fait le 18/10 (e7773fa à dbc0410), relu et accepté.

### 3.2 Voiture : schéma et services
- Brief : `docs/briefs/3.2-voiture-schema-services.md`. Gabarits dans le code (Saxo seule, vues droite et gauche en miroir, autres emplacements hors plan), pas de clé étrangère vers Partenaires, historique calculé via une lecture partagée de Saison. Fait le 18/10 (cfd4f8e à 9dc78d6, migration voiture_schema), relu et accepté.
- Tables `voiture_` (fiche, papiers et statut calculé, emplacements et occupations, fiches et réglages de référence), gabarit Saxo dans le catalogue plateforme, événements émis.

### 3.3 Voiture : écrans
- Brief : `docs/briefs/3.3-voiture-ecrans.md`. Déco en liste en attendant le plan (3.4), fiches de réglage hors ligne pour l'assistance au parc, entrées Réglage et Véhicule du bouton +. Fait le 18/10 (5f8bfd9 à 018c4e0), relu et accepté.
- Mes véhicules, fiche en onglets (Identité, Papiers, Réglages, Historique), bouton + en 3 champs, fiches de réglage pré-remplies et comparaison côte à côte.

### 3.4 Voiture : plan de déco
- Brief : `docs/briefs/3.4-voiture-plan-deco.md`. Plan SVG aux couleurs du thème, miroir pour le côté gauche, liste des emplacements comme commande principale sur téléphone, réservation, pose et retrait, déplacement au pointeur et au clavier. Fait le 18/10 (bd4eb00 à d989c20), relu et accepté.
- Silhouette Saxo par vue, emplacements cliquables (libre, réservé, occupé, indisponible), édition des emplacements.

### 3.5 Partenaires : schéma et services
- Brief : `docs/briefs/3.5-partenaires-schema-services.md`. Point 0 : trois retouches du plan de déco. Entreprise en `core_contact`, interlocuteur en `core_person`, jeton de la page partenaire stocké en empreinte, modèle de convention par défaut dans le code et copié par team, recalculs à l'ouverture du QG. Fait le 18/10 (a598624 à 403ed1b), relu et accepté.
- Tables `partenaires_` (partenaires, échanges, modèles, conventions, avenants, contreparties et liste de base, preuves, bilans, lien et messages de la page partenaire), modèle de convention par défaut, champs d'identité manquants dans Réglages (forme juridique, signataire).

### 3.6 Partenaires : écrans
- Brief : `docs/briefs/3.6-partenaires-ecrans.md`. Point 0 : corrections de la relecture 3.5 (index source_cle, dates en jours, jeton côté serveur) et de l'audit Impeccable des écrans du lot 3 (16/20). PDF de la convention, lien de la page partenaire montré une seule fois, choix d'emplacement par une lecture partagée de Voiture. Fait le 18/10 (4a5ccdd à 8017ece), relu et accepté.
- Prospection par statut avec relances, fiche partenaire, fiche convention et document généré, vue globale des contreparties, bouton + en 2 champs.

### 3.7 Page partenaire et bilans
- Brief : `docs/briefs/3.7-page-partenaire-bilans.md`. Point 0 : retouches de la 3.6 (saison en double, PDF, fiche convention), erreurs journalisées dans executer. Page /p/<jeton> hors session (fonction SQL SECURITY DEFINER, contexte public, 404 identique, en-têtes no-referrer/noindex/no-store, exclue du service worker), fichiers revalidés par jeton, bilans PDF, message du partenaire, ipClient() fiable, document de sécurité. Fait le 18/10 (bf59407 à da88d7c), relu et accepté : sécurité relue, limite par IP vérifiée sur dev (en-têtes falsifiés sans effet, 429 au 31e jeton). Reste pour le point 0 de la 3.8 : vouvoiement de la page, résultats du bilan limités à la période, alerte QG du message, puces du PDF, ECONNRESET du journal e2e à expliquer.
- Page sans compte par lien secret révocable (relecture de sécurité dédiée), message du partenaire, bilans PDF.

### 3.8 Liaisons et vérification du lot
- Brief : `docs/briefs/3.8-liaisons-verification-lot-3.md`. Point 0 : retouches de la 3.7 (vouvoiement, bilan par période, alerte du message par un contexte système, document signé et section, PDF, ECONNRESET). Rattachement de fichier entre apps, réservation et libération d'emplacement, recettes prévues et apport reçu, preuve de pose, publications promises, parcours e2e complet du lot.
- Convention signée vers Budget (recette prévue) et Voiture (réservation d'emplacement), logo posé vers preuve, papier qui expire vers l'indice de Saison, épreuve terminée vers l'historique du véhicule et les publications promises. Puis vérification complète du lot 3.
- Fait le 18/10 (5c0e6af à 9786a20, migration budget_suggestion_date_origine), relu et accepté sous réserve de la 3.9.

### 3.9 Corrections du lot 3
- Brief : `docs/briefs/3.9-corrections-lot-3.md`. Issu de la relecture de la 3.8 : contexte système limité à son propre événement (une livraison d'un membre pouvait être perdue), titres de groupe de la boîte d'actions, bouton Encaisser dans Budget, qualité de l'interlocuteur dans la convention, trois vérifications e2e manquantes, bloc Actions de la convention, source des ECONNRESET. Fin du lot 3, avant le test de John.
- Fait le 18/10 (afa2f90 à ec7519b, migration interlocuteur_qualite), relu et accepté. Suites vertes chez l'orchestrateur, sauf un test instable (voiture.spec.ts:86, boîte vide au QG dans le run complet, vert seul) à reprendre au point 0 du lot 4, avec l'AbortController du tirage de synchro (source des ECONNRESET) et les actions serveur coupées. Jeton du mail de connexion dans la console : build de test seulement, accepté.

### 3.10 Finitions de l'audit du lot 3
- Brief : `docs/briefs/3.10-finitions-audit-lot-3.md`. Audit Impeccable des écrans 3.6 à 3.9 (16/20), corrigé à la demande de John avant son test : structure et logo du partenaire sur la page partenaire, actions des contreparties sur une ligne, une seule règle pour boutons et liens, compteur du message.
- Acceptée le 19/10 (f165936, retouches 8991559) : suites vertes chez l'orchestrateur (tsc, 594 tests, rls, bus, synchro, build, e2e 123/123), détecteur Impeccable sans constat, captures sombre et clair vérifiées. Lot 3 prêt pour le test de John sur dev.

## 5 quater. Lot 4, Garage, découpé en tâches opérateur (validé par John le 20/10)

Spécifications : article Odoo 954 (Garage v1.1), catalogue 962, UI 953. Garage requiert Voiture : la silhouette et la liste des véhicules viennent de Voiture par une lecture partagée, jamais par une écriture. Les événements écoutés de Check-lists (`checklist.probleme_signale`) attendent le lot 5 : le gestionnaire sera branché à ce moment-là.

Décisions de John (20/10) :
- durées de vie saisies par la team, aucune valeur inventée : sans durée de vie, l'organe affiche « À renseigner » et ne compte pas dans l'indice ;
- hors ligne : avancement, notes et photos des ordres de travail, et intervention rapide ; commandes et stock en ligne seulement ;
- équipements de la team dans le lot 4, en dernier (4.6).

### 4.0 Stabilité avant le Garage
- Brief : `docs/briefs/4.0-stabilite-avant-garage.md`. ECONNRESET du journal e2e (point d'arrêt avant de toucher au moteur de synchro), `voiture.spec.ts:86` et `liste-john.spec.ts` instables.
- Acceptée le 20/10 (f30ceab..abf87ab) : ECONNRESET expliqués et documentés dans `docs/tests.md` (tirages de synchro coupés au changement de page, sans effet sur les données, aucun AbortController ajouté), double clic sur « Mois » corrigé. Suite complète chez l'orchestrateur : 133/133, voiture.spec.ts:86 vert ; s'il retombe, on lira sa trace avant toute correction. Ouvert : les server actions coupées par une navigation (3.9).

### 4.0b Vérifications sur GitHub Actions
- Brief : `docs/briefs/4.0b-verifications-sur-github.md`. Décision de John (20/10) : son poste ne supporte plus Docker, builds et e2e. Typecheck, tests, vérifications en base, build et e2e tournent sur GitHub Actions (PostgreSQL 18), sur une branche `verif` non déployée ; `dev` ne reçoit que du vert. La 4.3 attend la fin de cette tâche.

### 4.1 Garage : schéma et services
- Brief : `docs/briefs/4.1-garage-schema-services.md`. Point d'arrêt sur le schéma avant la migration.
- Les dix tables `garage_` de l'article 954, RLS, organes par défaut (moteur, boîte, embrayage, transmissions, freins, amortisseurs, pneus) posés à l'ouverture du Garage sur un véhicule. Calcul de l'état (km, épreuves, le plus bas des deux, zones orange et rouge), indice de fiabilité (moyenne pondérée des organes critiques), km restants : fonctions pures, tests Vitest.
- Pose et dépose avec historique ; usure sur `saison.resultat_valide` (km chronométrés et une épreuve à toutes les pièces montées, une seule fois par engagement, non retirée par une annulation) et saisie manuelle d'un roulage. Assistance : contribution sans prix (colonnes de prix jamais servies).
- Événements émis : `garage.piece_zone_rouge` (au franchissement du seuil, une fois), `garage.fiabilite_changee`.

### 4.2 Garage : voiture en atelier
- Brief : `docs/briefs/4.2-garage-voiture-en-atelier.md`. Point 0 : silhouette sortie dans le socle (`src/components/silhouette/`), utilisée par Voiture et Garage. Point d'arrêt sur les captures de l'atelier (positions des repères à valider par John).
- Livrée le 20/10 (ca02ccd..1175ce4) : repères écartés, mot de l'indice sur le pire organe critique, jauges de zone (retours de John). e2e ciblés verts ; suite complète interrompue par l'arrêt de Docker (mémoire du poste de John), 75/75 verts avant l'arrêt. Désormais, suite complète seulement avant une fusion dans main, au moment choisi par John.
- Écran principal façon Motorsport Manager : silhouette du gabarit (lue de Voiture), organes posés et colorés selon leur état (couleur, mot et pourcentage, jamais la couleur seule), indice en grand, une carte par organe. Passage d'une voiture à l'autre.
- Fiche organe : pièce montée, rechanges, historique, « Remplacer ». Stock par voiture (quantité, emplacement atelier ou remorque). Bouton + : Pièce et Roulage. Formulaires en tiroirs.
- Écart avec 954 §2 Stock (relevé le 21/10) : quantité et emplacement (atelier, remorque) absents du modèle ; une ligne par pièce, emplacement en texte libre. À planifier.

### 4.3 Atelier et commandes
- Brief : `docs/briefs/4.3-garage-atelier-commandes.md`. Priorité d'un ordre de travail : basse, normale, haute (décision de John, 20/10). Point d'arrêt sur la conception (fin d'un ordre, hors ligne de l'assistance, propositions vers Budget).
- Intervention rapide du bouton + (organe, ce qui a été fait, pièce utilisée), qui crée un ordre de travail terminé.
- Ordres de travail (révision, réparation, remplacement, contrôle), avancement, personnes affectées, notes et photos ; l'assistance voit et fait avancer les siens. Hors ligne pour le parc d'assistance (registre de synchro).
- Commandes et réception (la réception crée les pièces en stock). `garage.piece_achetee` et `garage.intervention_facturee` vers Budget, qui propose la dépense. `garage.travail_termine`.
- Hors ligne (décision de l'Orchestrateur, 21/10) : une intervention rapide sans pièce s'écrit sur l'appareil et part au retour du réseau ; avec pièce, elle attend le réseau.
- Reporté, noté (21/10) : statut et avancement hors ligne sans écran (la modification serveur existe, aucun écran ne l'écrit) ; lecture locale de Travaux (conséquence pour l'assistance : ouvrir Travaux en ligne avant de partir) ; photos hors ligne, hors périmètre.
- Point ouvert : notes et photos sur les ordres, hors 4.3. Elles demandent un service du socle pour les notes et les fichiers liés à une fiche, à concevoir à part.
- Refus de la synchro invisibles (défaut du socle depuis le lot 1) : tâche 4.3b, brief `docs/briefs/4.3b-synchro-refus-visibles.md`.
- Tâche 4.3c (cause du 418, décision de l'Orchestrateur, 21/10) : diagnostics et tolérance mesurée dans `docs/tests.md`, section « Erreur 418 au premier chargement en ligne de `/qg` ». Points ouverts : 418 au premier chargement de `/qg`, production seulement, cause non établie ; piste suivante : build de test avec React de développement.

### 4.4 Pneus et casses
- Trains de pneus (gomme, type, épreuves, km, usure, statut), montés sur l'organe Pneus. Fiche casse ouverte sur `saison.abandon_declare`, liée à un ordre de travail de réparation.

### 4.5 Plan avant épreuve et liaisons Saison
- Plan avant épreuve préparé sur `saison.engagement_cree` : ce qu'il faut faire pour qu'aucune pièce ne soit en zone rouge, avec coût et temps. Saison reçoit la zone rouge comme point bloquant de l'indice de préparation et la fiabilité dans le panneau « Prêt pour l'épreuve » (Saison écrit chez elle). Widgets Garage déclarés : fiabilité, pièces en zone rouge, travaux et livraisons.
- Tranché par John le 24/10 (954 v1.4) : plan en constat seul, sans proposition d'achat ni de remplacement ; la zone rouge est un point à surveiller dans Saison, jamais bloquant, hors de l'indice de préparation. Brief : `docs/briefs/4.5-plan-avant-epreuve-et-liaisons-saison.md`.

### 4.6 Équipements de la team
- Remorque, outillage, levage, assistance, stand : état, valeur, prochain contrôle, emplacement.
- Brief : `docs/briefs/4.6-garage-equipements.md`. Livré le 24/10 sur verif (985f75a, dc17dca, a65d71e, puis captures et journal). État en texte libre (choix 3 tranché), pas de lien Budget, pas de migration. Run vert 40136799334 (a65d71e) : unitaires 883, e2e 151, `db:verifier-garage` section 16. Sur dev après ce run, à tester par John avec le lot 4.

### 4.7 Vérification du lot 4
- Brief : `docs/briefs/4.7-verification-lot-4.md`. Parcours e2e complet en neuf étapes (`e2e/garage-parcours-complet.spec.ts`), par clics depuis le QG, de la préparation de l'atelier à la casse. Run vert 40150590450 (22dccd5) : unitaires 885, e2e 152, 48,3 s pour le parcours. Vérifications en base faites dans le parcours : usure comptée une fois par pièce montée (km +12,5, épreuves +1, `rev` +1), proposition Budget « Pièces achetées (Garage) » de 25,00 € confirmée, liaison casse, réparation et ordre.
- Captures 1440 et 360 px des étapes 1, 6, 7 et 9 : `docs/captures/garage-parcours-*`, relues.
- Audit des écrans du lot 4 (règles de CLAUDE.md, vocabulaire 954 §4, prix masqués à l'assistance, cibles de 44 px) : aucun prix ni valeur servi hors niveau écriture, aucune couleur seule pour un état. Corrigés : le titre d'un ordre dans Travaux n'avait pas la cible de 44 px (`LIEN`, b3a01f2) ; le placeholder d'état des équipements disait « à changer » (954 §4, remplacé par un exemple neutre, b3a01f2).
- Constats corrigés en 4.7b, avant le test de John (demande de l'orchestrateur) : dans la fiche d'une casse, la liste « Organes touchés » affiche quatre fois « Freins » et deux fois « Transmissions », sans la position (avant gauche, arrière droite…) : on ne sait pas lequel cocher ; à 360 px, le statut d'une carte d'organe au Plan avant épreuve passe sur sa propre ligne (« Amortisseurs · arrière gauche »), là où les autres restent sur une ligne.
- Avertissement de sortie pendant un envoi : fait (`beforeunload` tant que `enCours` dans `FormulaireTiroir`, `src/components/formulaire/tiroir.tsx`, fonction `avertirAvantSortie`, 40c14fd). Ce point était ouvert depuis le 21/10 (cas vécu : `e2e/partenaire-page.spec.ts:198`, run 39523629008).
- Compteurs du run 40150590450 : « 418 toléré » absent du log (0) ; `e2e/voiture-deco.spec.ts:337` vert.
- Parcours, cas perdus : au run 40148965567, le clic sur « Casses » juste après l'arrivée sur l'Atelier n'a pas navigué (l'URL est restée sur l'Atelier, cause non établie) ; même classe de défaut qu'à l'étape 2 (Budget). Le test contrôle maintenant la navigation et relance le clic une fois, en le comptant dans le log (« clic sur « Casses » perdu : relancé ») ; ce compteur n'est pas apparu au run vert. Décision de l'orchestrateur : pas de correction côté app sans cause établie ; entrée dans les intermittents de `docs/tests.md`.
- Reportés (hors lot 4, à inscrire ici) :
  - Stock : écart avec 954 §2, à reprendre ;
  - notes et photos sur les ordres (service du socle à concevoir) ;
  - statut et avancement d'un ordre hors ligne ;
  - lecture locale de Travaux hors ligne ;
  - `checklist.probleme_signale` (lot 5) ;
  - rendu des widgets Garage au Tableau de bord (lot 6) : le widget Garage n'est pas rendu aujourd'hui.
- Limites : le rendu clair et sombre à 1440 et 360 px n'a été vérifié que par les captures CI, pas dans un navigateur sur le poste. Le test de John sur dev reste à faire, avec `docs/test-john-lot-4.md`.

## 6. Méthode de travail

- L'orchestrateur rédige un brief par tâche, l'opérateur exécute, l'orchestrateur relit et teste avant de passer à la suivante.
- Une tâche, un commit. Message de commit en français, impératif, court.
- Aucun nom d'événement, de table ou de rôle inventé : tout vient des articles 948, 960 et 962.
- Vocabulaire de l'interface en français, vocabulaire du rallye, zéro jargon technique à l'écran.
- Tests sur ce qui porte des règles : droits, priorités du bouton Prochaine étape, synchronisation.

## 7. Décisions prises et en attente

Prises le 16/10/2026 :
- Stack confirmée par le relevé d'Elsass Dico (section 2).
- Mails de connexion : par le serveur SMTP d'OVH (ssl0.ovh.net, port 587, STARTTLS), expéditeur info@theelsassisch.com, dont les réponses arrivent dans Odoo. Odoo n'a pas de serveur sortant propre. Via nodemailer, identifiants en variables d'environnement SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM. En développement sans SMTP_HOST, le code s'affiche dans la console.
- Dépôt Git : privé sur GitHub, boudabass/Elsass-racing, branches main et dev, commits signés The Elsassisch.

- Déploiement avant le hors ligne, pour tester sur téléphone au plus tôt.
- Hébergement : Coolify, projet « Elsass Racing », application sur la branche main, PostgreSQL 18, domaine elsass-racing.theelsassisch.com. Déploiement lancé à la main par John après fusion de dev dans main. Guide : `docs/deploiement-coolify.md`.
- Stockage des fichiers : volume Coolify `elsass-racing-fichiers` monté sur `/app/stockage` (variable `STOCKAGE_DIR`). Pas encore utilisé.
- Base de production : deux rôles, propriétaire `postgres` pour les migrations, `elsass_racing_web` (membre de `elsass_racing_app`) pour l'app.
- Mot de passe postgres de production changé le 16/10/2026 au soir, après son passage dans l'historique d'une session. Recopié dans la ressource Coolify et dans `DATABASE_URL_MIGRATION`.
- Première team en production : team de test « The Elsassisch Racing Team ». La Koehling Racing Team réelle sera créée quand Jeoffrey et Aurélie seront prêts.
- Hors ligne : liste blanche des tables synchronisables, la dernière écriture gagne avec journal des conflits, au niveau contribution on ne voit et ne modifie que ses propres lignes.

En attente :
- Création de la Koehling Racing Team en production et invitation de Jeoffrey et Aurélie.

### 3.11 Retours du test de John sur le lot 3
- Brief : `docs/briefs/3.11-retours-test-john-lot-3.md`. Test de John sur dev le 19/10 : interlocuteur impossible à saisir (PDF bloqué), fiches non rafraîchies, réservation et encaissement non remontés, retour arrière, fiche convention réorganisée, message du PDF, « Tenue » devient « Faite », encadré rouge des notifications retiré, texte blanc sur les boutons rouges. À finir avant la fusion dans main.

- Acceptée le 19/10 (9b350d3) : suites vertes chez l'orchestrateur (tsc, 594 tests, rls, bus, synchro, build, e2e 126/126). Bouton flottant « Prochaine étape » retiré sur ordinateur. Suite : 3.13 phase A, puis 3.12.

### 3.12 On décide dans l'app, pas dans les notifications
- Brief : `docs/briefs/3.12-decider-dans-l-app.md`. Décision de John du 19/10 : la boîte d'actions informe et emmène (« Ouvrir ») ; les décisions se prennent dans l'app concernée, par le même service de décision. Inventaire des 18 types validé avant le code. Après la 3.11, avant la fusion dans main.

### 3.13 Tous les formulaires en tiroirs
- Brief : `docs/briefs/3.13-formulaires-en-tiroirs.md`. Décision de John du 19/10 : chaque saisie s'ouvre dans un tiroir (bas sur téléphone, droite sur ordinateur) avec Enregistrer et Annuler, le reste de la page inactif ; plus de formulaires dépliés les uns sous les autres. Phase A (composant, fiche convention, Déco) validée par John sur dev, puis phase B (toute l'app, après inventaire). Ordre : 3.11, 3.13, puis 3.12.
- Phase A validée par John sur dev le 19/10. Phase B : `docs/briefs/3.13b-formulaires-en-tiroirs-phase-b.md` (inventaire d'abord, puis conversion app par app, vérification légère sans serveur).
- Phase A livrée le 19/10 (f5d395e..befa50e) : composant Tiroir, fiche convention et Déco en tiroirs ; modal sur téléphone et ordinateur, sauf l'étape « Déplacer ou redimensionner ». En attente de la validation de John sur dev avant la phase B. Point 0 du lot 4 : liste-john.spec.ts (calendrier, lien « Mois ») instable sous charge, comme voiture.spec.ts:86.

### 3.14 Retours du test de John (19/10, soir)
- Brief : `docs/briefs/3.14-retours-test-john-phase-b.md`. Retours en double (← Calendrier, ← Mouvements), interlocuteur toujours impossible à saisir, liste des recettes absente du Budget, apport du partenaire (ce qu'il doit à la team), Déco : toutes les vues, emplacements par vue, gauche et droite distincts. Après la 3.13b, avant la fusion dans main. Points 4 et 5 : point d'arrêt avec proposition.

### 3.15 Déco : retours de John sur les nouvelles vues (19/10, soir)
- Brief : `docs/briefs/3.15-deco-retours-john.md`. Vues avant, arrière, dessus à redessiner (pas des rectangles), pas d'emplacement sur la lunette arrière, retrait de « Autres emplacements » et « Ajouter sans forme », zone entière déplaçable au doigt, « Modifier l'emplacement » clarifié, véhicules sans gabarit (proposition d'un gabarit générique, point d'arrêt).
