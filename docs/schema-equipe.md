# Équipe : schéma (tâche 5.1, point d'arrêt)

Statut : **proposition, avant la migration** (point d'arrêt de la 5.1). Migration prévue `equipe_schema`, non écrite. Spécification : article Odoo 955 (Équipe v1.1, 15/10/2026), §3 « Tables » et §4 « Paliers ». Socle : 948 ; catalogue : 962 ; modèle : `docs/schema-garage.md`, `docs/schema-saison.md`.

## Décisions reprises du brief (orchestrateur, 25/10)

- **Préfixe `equipe_`**, snake_case, bloc commun sur les 8 tables (`team_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `rev`), UUID v7 côté client, RLS `cloisonnement_team` forcée, droits du rôle applicatif comme `garage_`.
- **Pas de clé étrangère vers une autre app.** Personne : `core_person` (une fiche par personne). Épreuve : `core_event`. Engagement : `core_event_entry`. Fichiers (document, photo, justificatif) : `core_attachment` (rôle `document` ou `photo`). Tâches d'assistance : `core_task`.
- **Résultats lus chez Saison, jamais copiés.** Aucune table `equipe_` ne stocke un résultat, un classement ou un km. Les statistiques viennent d'une lecture partagée de Saison (à créer en 5.1, lecture seule).
- **Pas de vue SQL.** 955 §3 parle de « calculs (vues) » : je propose des fonctions pures (`src/apps/equipe/regles.ts`) et des lectures (`lectures-serveur.ts`), comme Garage. À confirmer.
- **Paliers stockés, jamais recalculés à la baisse** : le palier atteint reste dans `equipe_profile.palier`. Le calcul (`palierDepuis(nombre, palierAtteint)`) ne descend jamais sous `palierAtteint`.
- **Statuts de licence et d'équipement jamais stockés** : valide, à renouveler (30 jours ou moins), expirée, calculés à la lecture.
- **Aucune donnée médicale** (955 §3) : pas de groupe sanguin, seul le contact d'urgence est gardé.

## Tables (8)

Bloc commun sur chaque table. Seul montant : celui d'une licence payée (centimes).

### equipe_profile : profil sportif (un par personne)

| Colonne | Type | Règle |
|---|---|---|
| `person_id` | uuid → `core_person` | obligatoire. **Unique** parmi les lignes actives de la team |
| `roles_habituels` | tableau de `equipe_role_habituel` | facultatif (vide accepté). Valeurs : `pilote`, `copilote`, `assistance`, `benevole` |
| `debut_sport_auto` | date | facultative |
| `taille_vetements` | texte | facultatif (pour les tenues) |
| `contact_urgence` | texte | facultatif. Nom et téléphone en texte libre, aucune donnée médicale |
| `palier` | enum `equipe_palier` | obligatoire, défaut `rookie`. Valeurs : `rookie`, `confirme`, `experimente`, `veteran`, `figure`. **Jamais en baisse** |
| `afficher_trophees` | booléen | obligatoire, défaut `false` |

### equipe_licence : licences et adhésions

| Colonne | Type | Règle |
|---|---|---|
| `person_id` | uuid → `core_person` | obligatoire |
| `type` | enum `equipe_type_licence` | obligatoire. Valeurs : `ffsa_regionale`, `ffsa_nationale`, `ffsa_internationale`, `autre` |
| `numero` | texte | facultatif |
| `numero_asa` | texte | facultatif. **À trancher, voir Q2** |
| `saison` | texte | facultative (ex. « 2026 ») |
| `valable_du` | date | facultative |
| `valable_au` | date | facultative. Contrainte : `valable_au >= valable_du` quand les deux sont renseignées |
| `document_attachment_id` | uuid → `core_attachment` | facultatif (photo ou PDF de la licence) |
| `montant_cents` | entier | facultatif, >= 0. Saisi quand la licence est payée : déclenche `equipe.licence_payee` (Budget propose la dépense). Centimes |
| `devise` | texte | défaut `EUR` si `montant_cents` est renseigné |

Statut calculé (jamais stocké) : `valable_au` absente → pas d'expiration ; sinon valide, à renouveler (≤ 30 jours), expirée.

### equipe_gear : équipements homologués personnels

| Colonne | Type | Règle |
|---|---|---|
| `person_id` | uuid → `core_person` | obligatoire |
| `type` | enum `equipe_type_equipement` | obligatoire. Valeurs : `casque`, `hans`, `combinaison`, `gants`, `bottines`, `sous_vetements`, `cagoule` |
| `marque`, `modele` | texte | facultatifs |
| `norme` | texte | facultative (ex. norme d'homologation) |
| `fin_homologation` | date | facultative. Statut calculé à partir de cette date |
| `taille` | texte | facultative |
| `achete_le` | date | facultative |
| `document_attachment_id` | uuid → `core_attachment` | facultatif (photo de l'étiquette ou document) |

Statut calculé : `fin_homologation` absente → pas d'expiration ; sinon valide, à renouveler (≤ 30 jours), expirée.

### equipe_skill : spécialités et formations

| Colonne | Type | Règle |
|---|---|---|
| `person_id` | uuid → `core_person` | obligatoire |
| `specialite` | enum `equipe_specialite` | obligatoire. Valeurs : `mecanique`, `pneus`, `logistique`, `photo`, `secourisme`, `commissaire`, `autre` |
| `niveau_declare` | entier | facultatif, entre 1 et 5. **À trancher, voir Q1** |
| `formation` | texte | facultatif (formation suivie) |
| `date_formation` | date | facultative |
| `justificatif_attachment_id` | uuid → `core_attachment` | facultatif |

### equipe_availability : disponibilité pour une épreuve

| Colonne | Type | Règle |
|---|---|---|
| `person_id` | uuid → `core_person` | obligatoire |
| `event_id` | uuid → `core_event` | obligatoire |
| `reponse` | enum `equipe_reponse_disponibilite` | obligatoire. Valeurs : `vient`, `ne_vient_pas`, `peut_etre` |
| `jours` | tableau de dates (AAAA-MM-JJ) | facultatif. Jours présents |
| `avec_vehicule` | booléen | facultatif (oui ou non, `null` = non dit) |
| `places` | entier | facultatif, >= 0 |
| `commentaire` | texte | facultatif |
| `repondu_le` | timestamptz | obligatoire quand la réponse est saisie |

**Unique** : une disponibilité par `(person_id, event_id)` parmi les lignes actives. Pas de ligne écrite à l'avance : une personne sans ligne n'a pas répondu.

### equipe_assignment : rôle d'une personne sur une épreuve

| Colonne | Type | Règle |
|---|---|---|
| `event_id` | uuid → `core_event` | obligatoire |
| `event_entry_id` | uuid → `core_event_entry` | facultatif (engagement). Obligatoire pour pilote et copilote |
| `person_id` | uuid → `core_person` | obligatoire |
| `role_epreuve` | enum `equipe_role_epreuve` | obligatoire. Valeurs : `pilote`, `copilote`, `chef_assistance`, `assistance`, `logistique`, `photo` |

Le rôle d'épreuve **ne donne aucun droit** (955 §0). Les tâches liées sont des `core_task` rattachées à la fiche de l'affectation (pas de table de liaison).

**Pilote et copilote** : non écrits ici, voir Q8. **Unique** : une seule affectation par `(event_id, person_id, role_epreuve)` parmi les lignes actives.

### equipe_mood : ressenti après un engagement (privé à l'équipage)

| Colonne | Type | Règle |
|---|---|---|
| `person_id` | uuid → `core_person` | obligatoire |
| `event_entry_id` | uuid → `core_event_entry` | obligatoire |
| `ressenti` | entier | obligatoire, entre 1 et 5 |
| `mot_cle` | texte | facultatif |
| `saisi_le` | timestamptz | obligatoire |

**Unique** : un ressenti par `(person_id, event_entry_id)` parmi les lignes actives. Alimenté par `saison.debrief_saisi`. Jamais servi au niveau contribution ni à l'invité.

### equipe_pool : vivier (personnes à solliciter)

| Colonne | Type | Règle |
|---|---|---|
| `person_id` | uuid → `core_person` | obligatoire |
| `role_recherche` | enum `equipe_role_epreuve` | obligatoire. **À trancher, voir Q5** |
| `source` | texte | facultatif. **À trancher, voir Q6** |
| `dernier_contact` | date | facultative |
| `interet` | enum `equipe_interet_vivier` | obligatoire. Valeurs : `faible`, `moyen`, `fort` |
| `notes` | texte | facultatives |

## Contraintes transverses

- Un profil par personne : index unique partiel sur `equipe_profile(person_id)` quand `deleted_at IS NULL`.
- Ressenti entre 1 et 5 : `CHECK (ressenti BETWEEN 1 AND 5)`.
- Validité : `CHECK (valable_au IS NULL OR valable_du IS NULL OR valable_au >= valable_du)` sur `equipe_licence`.
- Disponibilité unique par personne et épreuve, ressenti unique par personne et engagement (index partiels, `deleted_at IS NULL`).

## Questions à trancher (point d'arrêt)

1. **Q1, niveau déclaré** (`equipe_skill.niveau_declare`) : 955 le cite sans échelle. Proposition : entier de 1 à 5, facultatif, comme le ressenti. Ou je le retire.
2. **Q2, « ASA »** (`equipe_licence`) : 955 cite « adhésion ASA » sans précision. Proposition : `numero_asa` texte facultatif à côté de `numero` (une licence FFSA et une adhésion ASA peuvent coexister). Ou une ligne distincte.
3. **Q3, rôles habituels** : tableau d'enum sur `equipe_profile`, sans table de liaison. Ok ?
4. **Q4, tâches liées** : `core_task` rattachée à la fiche de l'affectation, sans table de liaison. À confirmer contre les colonnes de `core_task` (948).
5. **Q5, rôle recherché du vivier** : je réutilise l'enum `equipe_role_epreuve`. 955 ne précise pas. Ok ?
6. **Q6, source du vivier** : texte libre facultatif (955 ne donne pas de valeurs). Ok ?
7. **Q7, « calculs (vues) »** : fonctions pures et lectures, pas de vue SQL, comme Garage. Ok ?
8. **Q8, pilote et copilote en double** : `core_event_entry` porte déjà le pilote et le copilote (brief 5.1). `equipe_assignment` les repète-t-il pour les rôles pilote et copilote, ou ne garde-t-il que les autres rôles d'épreuve ? Proposition : `equipe_assignment` ne reçoit que les rôles chef d'assistance, assistance, logistique et photo ; le pilote et le copilote restent lus dans `core_event_entry` (une seule source, jamais écrits ici). L'enum `equipe_role_epreuve` garde les six valeurs de 955 pour la lisibilité. Ok ?

## Ce qui n'est pas dans ce schéma

- Droits de compte (responsable, équipage, assistance, invité) : viennent de Réglages.
- Résultats, classements, km chronométrés : chez Saison, lus en lecture partagée.
- Événements émis (`equipe.disponibilite_changee`, `equipe.licence_payee`, `equipe.licence_expire_bientot`, `equipe.homologation_expire_bientot`, `equipe.palier_atteint`) : déclarés au catalogue 962 dans une étape ultérieure, après validation de ce schéma.
