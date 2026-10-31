# Schéma Check-lists (tâche 5.5a, point d'arrêt)

**Statut** : proposition, soumise à l'orchestrateur. **Aucune migration écrite** : la migration `checklist_schema` attend le feu vert.

**Sources** : article Odoo 956 v1.3 (§3 tables, §4 règles, §5 événements, §6 droits) et brief `docs/briefs/5.5a-checklist-schema-regles.md`. Aucun nom de table, de colonne d'enum ou d'événement hors de ces sources, sauf les points signalés **(choix)** ci-dessous, à valider.

## 1. Questions à trancher

Chaque question donne la recommandation. Sans réponse contraire, c'est elle qui sera écrite.

**Q1. Discipline de l'épreuve.** L'article 956 parle de discipline (rallye, course de côte, slalom, circuit). Le socle a déjà `core_event.type` (`CoreEventType` : rallye, slalom, course_de_cote, expo, roulage, autre) et aucun champ `discipline` sur l'épreuve. Les vocabulaires ne coïncident pas : `circuit` n'existe pas dans le socle, et `expo`, `roulage`, `autre` n'ont pas d'équivalent dans l'article.
- *Recommandation* : ne rien changer au socle. L'enum `ChecklistDiscipline` garde les 4 valeurs de l'article. La discipline de l'épreuve se lit dans `core_event.type` par correspondance (rallye → rallye, course_de_cote → course_de_cote, slalom → slalom). `expo`, `roulage`, `autre` ne correspondent à aucune discipline : seuls les modèles sans discipline s'y appliquent. `circuit` ne correspond à rien tant que `CoreEventType` ne le porte pas.
- *À décider* : ajouter `circuit` à `CoreEventType` (changement du socle, hors de cette tâche, à faire par une tâche socle et après mise à jour de 948) ?
- Le modèle a une discipline **nullable** : vide = modèle transversal, proposé à toute épreuve.

**Q2. `team_id` vide sur les modèles fournis.** Le test `src/core/schema-conventions.test.ts` exige aujourd'hui `teamId String @map("team_id")` non nul sur tout modèle hors `MODELES_SANS_TEAM`. Les modèles fournis n'ont pas de team.
- *Recommandation* : une nouvelle liste `MODELES_TEAM_OPTIONNEL` dans `src/core/schema-conventions.ts`, qui accepte `teamId String?` pour `ChecklistTemplate`, `ChecklistTemplateSection` et `ChecklistTemplateItem` seulement. Justification en section 6.
- Sections et points de modèle portent `team_id` **recopié** du modèle (NULL pour un modèle fourni), et non une jointure vers le modèle : la RLS et les index restent simples.

**Q3. Règle de « liste terminée ».** `checklist.liste_terminee` est émis au passage à « terminée ». La règle proposée :
- on n'émet pas si le journal `core_domain_event` contient déjà un `checklist.liste_terminee` **pour la même liste** dont la date d'émission (`emis_at`, jour calendaire Europe/Paris) est le jour même ;
- une liste repassée en cours puis terminée un autre jour donne un nouvel événement.
- Pas de colonne ajoutée : le contrôle lit le journal d'événements (`donnees->>'listeId'`).

**Q4. Échéance d'une liste.** L'article donne une échéance relative sur chaque point de modèle (J-7, J-1, jour J) et une échéance sur la liste, mais pas sur le point d'une liste.
- *Recommandation* : `checklist_list.echeance` est une **DATE** (`@db.Date`, comme les dates de calendrier de `CoreEvent`). À la création depuis un modèle, elle vaut la date de l'épreuve (`core_event.date_debut`) moins le plus petit décalage des points du modèle ; un décalage est J-7 = 7 jours, J-1 = 1 jour, jour J = 0. Une liste sans point à échéance relative n'a pas d'échéance.
- L'échéance reste modifiable par la gestion (brief §4). Elle ne se recalcule pas si la date de l'épreuve change : c'est à la gestion de la corriger. *À valider*.

**Q5. « L'épreuve a commencé » (ajout de point pendant l'épreuve).** Je propose : `ajoute_pendant_epreuve = true` si la date du jour (Europe/Paris) est **postérieure ou égale** à `core_event.date_debut`. Le choix par phase (épreuve ou retour) a été écarté : une liste peut rester en « avant départ » le jour de l'épreuve.

**Q6. Une seule proposition « créer les listes » par engagement.** Index unique partiel écrit à la main dans la migration :
`UNIQUE (team_id, (contenu->>'entryId')) WHERE type = 'creer_listes' AND statut <> 'ignoree' AND deleted_at IS NULL`.
- *Recommandation* : retenue comme écrite. Une proposition ignorée ne bloque pas une nouvelle ; une acceptée ou en attente bloque un doublon. *À valider* : le nom de la clé `entryId` dans `contenu` est un choix de format de la charge, à fixer avec les charges zod de 5.5a.

**Q7. Auteurs et appareil.** Le brief parle de `par`, `coché par`, `traitée par`, `appareil`.
- *Recommandation* : `par`, `coche_par`, `traitee_par` sont des `core_user` (même logique que `created_by`). Ils ne sont pas des `core_person`, car un compte peut agir sans fiche personne.
- `appareil` est un `core_device` (nullable). Le socle a `core_device` à l'échelle du compte (`user_id`), sans team. *À valider* : c'est un choix de ma part, l'article ne dit pas quelle table porte l'appareil.
- `le` (article : « le ») est nommé `le` en base. Pas d'autre nom.

**Q8. Journal des coches en ajout seul.** La convention du bloc commun est tenue (même colonnes `updated_at`, `rev`, `deleted_at`), mais le rôle applicatif ne reçoit ni `UPDATE` ni `DELETE` : `REVOKE` explicite dans la migration, et des politiques RLS `FOR SELECT` et `FOR INSERT` seulement. Les colonnes `updated_*` et `rev` restent vides sur ce modèle. *À valider* : garder le bloc complet (convention testée) plutôt qu'une exception.

**Q9. Avancement et zone.** `avancement` est un `Int` de 0 à 100, arrondi pour l'affichage. La zone est calculée sur le **ratio exact** : 89,5 % sans critique ouvert reste orange même si l'affichage dit 90 %. *À valider*.

## 2. Enums

Valeurs en snake_case, conformes à `docs/conventions-schema.md`. Chaque enum a un `@@map` et un nom préfixé `Checklist`.

| Enum Prisma | Valeurs (dans l'ordre de l'article) |
|---|---|
| `ChecklistPortee` | `engagement`, `epreuve` |
| `ChecklistPhase` | `avant_depart`, `verifications`, `reconnaissances`, `epreuve`, `retour` |
| `ChecklistDiscipline` | `rallye`, `course_de_cote`, `slalom`, `circuit` (voir Q1) |
| `ChecklistRoleSuggere` | `equipage`, `assistance` |
| `ChecklistTypeLien` | `aucun`, `organe_garage`, `train_pneus`, `papier_voiture`, `logo_voiture`, `licence_equipe`, `homologation_equipe`, `contrepartie_partenaires`, `document_documents` |
| `ChecklistEcheanceRelative` | `j_moins_7`, `j_moins_1`, `jour_j` |
| `ChecklistStatutPoint` | `a_faire`, `fait`, `sans_objet`, `probleme` |
| `ChecklistStatutListe` | `a_faire`, `en_cours`, `terminee` |
| `ChecklistZone` | `vert`, `orange` (jamais de rouge) |
| `ChecklistTypeProposition` | `creer_listes`, `ajouter_point`, `cocher_point`, `creer_liste_retour`, `relire_liste` |
| `ChecklistStatutProposition` | `proposee`, `acceptee`, `ignoree` |

Pas d'autre valeur. Le libellé français est affiché par l'interface (5.6), jamais stocké.

## 3. Tables

Toutes portent le bloc commun (`team_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `rev`) **sauf** les exceptions de la section 6. Index `(team_id)` et `(team_id, deleted_at)` sur chaque table. Clés étrangères vers le socle uniquement : pas de clé vers `garage_`, `voiture_`, etc.

### 3.1 `checklist_template` : modèle de liste

| Colonne | Type | Contrainte | Source |
|---|---|---|---|
| `id` | uuid | PK | bloc |
| `team_id` | uuid | **nullable** : NULL = modèle fourni (Q2) | 956 §3 « team (vide pour les modèles fournis) » |
| `nom` | text | obligatoire | 956 §3 |
| `icone` | text | nullable | 956 §3 « icône » |
| `portee` | `ChecklistPortee` | obligatoire | 956 §3 |
| `phase` | `ChecklistPhase` | nullable (phase par défaut) | 956 §3 |
| `discipline` | `ChecklistDiscipline` | nullable : vide = transversal (Q1) | 956 §3 |
| `fourni` | boolean | défaut false | 956 §3 « fourni par la plateforme » |
| `modele_origine_id` | uuid | nullable, FK `checklist_template` | 956 §3 « modèle d'origine » |
| `version` | int | défaut 1 | 956 §3 |
| `ordre` | int | défaut 0 | 956 §3 |

Contrainte SQL (migration) : `CHECK ((fourni AND team_id IS NULL) OR (NOT fourni AND team_id IS NOT NULL))`. Un modèle fourni n'a pas de team, un modèle de team en a une.

### 3.2 `checklist_template_section` : section d'un modèle

| Colonne | Type | Contrainte | Source |
|---|---|---|---|
| `id` | uuid | PK | bloc |
| `team_id` | uuid | nullable, **recopié** du modèle (Q2) | choix, Q2 |
| `modele_id` | uuid | obligatoire, FK `checklist_template` | 956 §3 « modèle » |
| `titre` | text | obligatoire | 956 §3 |
| `ordre` | int | défaut 0 | 956 §3 |

### 3.3 `checklist_template_item` : point d'un modèle

| Colonne | Type | Contrainte | Source |
|---|---|---|---|
| `id` | uuid | PK | bloc |
| `team_id` | uuid | nullable, **recopié** de la section (Q2) | choix, Q2 |
| `section_id` | uuid | obligatoire, FK `checklist_template_section` | 956 §3 « section » |
| `libelle` | text | obligatoire | 956 §3 |
| `aide` | text | nullable | 956 §3 « aide » |
| `critique` | boolean | défaut false | 956 §3 |
| `role_suggere` | `ChecklistRoleSuggere` | nullable | 956 §3 |
| `lien_type` | `ChecklistTypeLien` | obligatoire, défaut `aucun` | 956 §3 |
| `echeance_relative` | `ChecklistEcheanceRelative` | nullable | 956 §3 |
| `ordre` | int | défaut 0 | 956 §3 |

### 3.4 `checklist_list` : liste réelle d'une épreuve

| Colonne | Type | Contrainte | Source |
|---|---|---|---|
| `id` | uuid | PK | bloc |
| `team_id` | uuid | obligatoire | bloc |
| `epreuve_id` | uuid | **obligatoire**, FK `core_event` | 956 §3 « épreuve » |
| `engagement_id` | uuid | nullable, FK `core_event_entry` ; NULL = liste commune | 956 §3 « engagement (vide pour une liste commune) » |
| `vehicule_id` | uuid | nullable, FK `core_vehicle` ; repris de l'engagement à la création | 956 §3 « véhicule (repris de l'engagement) » |
| `modele_source_id` | uuid | nullable, FK `checklist_template` | 956 §3 « modèle source » |
| `titre` | text | obligatoire | 956 §3 |
| `phase` | `ChecklistPhase` | obligatoire, sans défaut en base | 956 §3 |
| `echeance` | date | nullable, `@db.Date` (Q4) | 956 §3 « échéance » |
| `statut` | `ChecklistStatutListe` | défaut `a_faire`, recalculé (§4 du brief) | 956 §3 et §4 |
| `avancement` | int | défaut 0, `CHECK (0..100)`, recalculé | 956 §3 et §4 |
| `zone` | `ChecklistZone` | défaut `orange`, recalculée | 956 §3 et §4 |
| `ouverte_assistance` | boolean | défaut false | 956 §3 « ouverte à l'assistance » |

Le nombre de points critiques ouverts n'est **pas** stocké : c'est un calcul de service (956 §3 « calculs »).

### 3.5 `checklist_section` : section d'une liste

| Colonne | Type | Contrainte | Source |
|---|---|---|---|
| `id` | uuid | PK | bloc |
| `team_id` | uuid | obligatoire | bloc |
| `liste_id` | uuid | obligatoire, FK `checklist_list` | 956 §3 « liste » |
| `titre` | text | obligatoire | 956 §3 |
| `ordre` | int | défaut 0 | 956 §3 |

### 3.6 `checklist_item` : point d'une liste

| Colonne | Type | Contrainte | Source |
|---|---|---|---|
| `id` | uuid | PK | bloc |
| `team_id` | uuid | obligatoire | bloc |
| `section_id` | uuid | obligatoire, FK `checklist_section` | 956 §3 « section » |
| `libelle` | text | obligatoire | 956 §3 |
| `critique` | boolean | défaut false | 956 §3 |
| `personne_id` | uuid | nullable, FK `core_person` | 956 §3 « personne affectée (core_person) » |
| `statut` | `ChecklistStatutPoint` | défaut `a_faire` | 956 §3 |
| `coche_par_id` | uuid | nullable, FK `core_user` (Q7) | 956 §3 « coché par » |
| `coche_le` | timestamptz(3) | nullable | 956 §3 « coché le » |
| `note` | text | nullable | 956 §3 |
| `lien_type` | `ChecklistTypeLien` | obligatoire, défaut `aucun` | 956 §3 |
| `lien_id` | uuid | nullable : identifiant de l'objet lié, **lecture seule**, sans FK | 956 §3 « identifiant de l'objet lié » |
| `point_modele_origine_id` | uuid | nullable, FK `checklist_template_item` | 956 §3 |
| `ajoute_pendant_epreuve` | boolean | défaut false (Q5) | 956 §3 |
| `ordre` | int | défaut 0 | 956 §3 |

Contrainte SQL : `CHECK ((lien_type = 'aucun') = (lien_id IS NULL))`. Un point lié a un identifiant, un autre n'en a pas.

L'auteur d'un point est `created_by` (bloc commun). La règle « l'assistance ne modifie que ses propres points » s'appuie dessus.

### 3.7 `checklist_check_log` : historique des coches (ajout seul, Q8)

| Colonne | Type | Contrainte | Source |
|---|---|---|---|
| `id` | uuid | PK | bloc |
| `team_id` | uuid | obligatoire | bloc |
| `point_id` | uuid | obligatoire, FK `checklist_item` | 956 §3 « point » |
| `ancien_statut` | `ChecklistStatutPoint` | obligatoire | 956 §3 |
| `nouveau_statut` | `ChecklistStatutPoint` | obligatoire, `CHECK (nouveau_statut <> ancien_statut)` | 956 §3 |
| `par_id` | uuid | obligatoire, FK `core_user` (Q7) | 956 §3 « par » |
| `le` | timestamptz(3) | obligatoire, défaut now() | 956 §3 « le » |
| `appareil_id` | uuid | nullable, FK `core_device` (Q7) | 956 §3 « appareil » |
| `hors_ligne` | boolean | obligatoire, défaut false | 956 §3 « saisi hors ligne » |

Le rôle applicatif n'a que `SELECT` et `INSERT` (section 5).

### 3.8 `checklist_proposal` : propositions reçues

| Colonne | Type | Contrainte | Source |
|---|---|---|---|
| `id` | uuid | PK | bloc |
| `team_id` | uuid | obligatoire | bloc |
| `evenement_source_id` | uuid | obligatoire, FK `core_domain_event` | 956 §3 « événement source (core_domain_event) » |
| `type` | `ChecklistTypeProposition` | obligatoire | 956 §3 |
| `contenu` | json | obligatoire : ce qui est proposé (ex. `entryId` pour `creer_listes`) | 956 §3 « contenu proposé » |
| `statut` | `ChecklistStatutProposition` | défaut `proposee` | 956 §3 |
| `action_id` | uuid | nullable, FK `core_action` | 956 §3 « action liée (core_action) » |
| `traitee_par_id` | uuid | nullable, FK `core_user` | 956 §3 « traitée par » |
| `traitee_le` | timestamptz(3) | nullable | 956 §3 « traitée le » |

Index unique partiel (Q6) : `UNIQUE (team_id, (contenu->>'entryId')) WHERE type = 'creer_listes' AND statut <> 'ignoree' AND deleted_at IS NULL`.

Une proposition est créée par Check-lists, qui émet `checklist.action_requise` (motif générique autorisé par le socle, `docs/evenements.md`). Le socle crée la `core_action` et la lie. La décision revient par `core.action_decidee`, comme le veut la règle 2.

## 4. Index

- `(team_id)` et `(team_id, deleted_at)` sur chaque table.
- `checklist_list` : `(team_id, epreuve_id)` et `(team_id, engagement_id)`, pour « les listes d'une épreuve » et « la liste d'un engagement ».
- `checklist_item` : `(section_id)` et `(team_id, personne_id)`, pour « mes points » et « points affectés à un membre ».
- `checklist_check_log` : `(point_id, le)`, pour l'historique d'un point.
- `checklist_proposal` : `(team_id, statut)`, pour « propositions en attente ».

## 5. RLS et droits

- `cloisonnement_team` (`FOR ALL`, `USING` et `WITH CHECK` sur `team_id = core_team_courante()`) sur toutes les tables, **sauf** les deux cas ci-dessous.
- **Modèles fournis** : `checklist_template`, `checklist_template_section`, `checklist_template_item` ont une politique `SELECT` supplémentaire : `fourni = true AND team_id IS NULL` (lisibles par toute team). Aucune politique d'écriture ne les touche : `team_id = core_team_courante()` est faux pour une ligne sans team, donc le rôle applicatif ne peut pas les écrire.
- **`checklist_check_log`** : `REVOKE UPDATE, DELETE ON checklist_check_log FROM elsass_racing_app`, après `ALTER DEFAULT PRIVILEGES` qui donne tout ; politiques `FOR SELECT` et `FOR INSERT` seules.
- Droits par rôle de compte (956 §6) : **dans les services**, pas dans la RLS, comme pour Équipe. Responsable : gestion. Équipage : écriture. Assistance : contribution, limitée aux listes `ouverte_assistance = true`, à ses propres points, sans accès aux modèles. Invité : aucun.

## 6. Justification du `team_id` vide

Le bloc commun dit « chaque ligne porte `team_id` », avec les exceptions déjà documentées (`CoreTeam`, `CoreUser`, `CoreAuthToken`, `CoreDevice`, `CoreApp`, `CoreRoleDefault`). Les modèles fournis sont des **catalogues de la plateforme** : même statut que les référentiels du socle. Ils appartiennent à aucune team, les mêmes lignes servent à toutes. Leur `team_id` vide est donc un choix de conception et non un oubli.

Exception retenue (Q2) : `MODELES_TEAM_OPTIONNEL = ["ChecklistTemplate", "ChecklistTemplateSection", "ChecklistTemplateItem"]` dans `src/core/schema-conventions.ts`, avec `teamId String?`. Le test vérifie que ces trois modèles ont bien un `team_id` nullable, et rien d'autre.

## 7. Migrations prévues (après feu vert)

1. `checklist_schema` : enums, 8 tables, index, clés, contraintes SQL, politiques RLS, `REVOKE` du journal, index unique partiel.
2. `core_catalogue` : manifeste Check-lists en `0.2.0` (même flux que `20261025190000_core_catalogue`), si la version du catalogue l'exige.

Les modèles fournis ne sont **pas** écrits ici : c'est la 5.5b, après réception des listes de John, dans une migration de données.

## 8. Ce qui reste hors de ce schéma

- Écrans : 5.6. Écoutes de `saison.programme_publie`, `saison.epreuve_terminee`, `saison.abandon_declare`, `garage.*`, `voiture.*`, `equipe.*`, `documents.*`, `partenaires.*` : 5.7. Gestionnaires côté Garage et `core_task` : 5.7.
- Liaisons de 5.5a : `saison.engagement_cree` (propositions `creer_listes`) et `settings.membre_retire` (propositions de réassignation).
- Le schéma ne contrôle pas l'appartenance d'un `vehicule_id` à l'engagement, ni l'égalité `epreuve_id` entre une liste d'engagement et son engagement : c'est au service et à `db:verifier-checklist` de le garantir (`docs/conventions-schema.md`, « Ce que le schéma ne contrôle pas »).
