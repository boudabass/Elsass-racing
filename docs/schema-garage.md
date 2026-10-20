# Garage : schéma (tâche 4.1, point d'arrêt)

Statut : **proposition, aucune migration écrite**. Le schéma sera écrit dans `prisma/schema.prisma` et `prisma/migrations/<date>_garage_schema/` après le feu vert de l'orchestrateur sur ce document. Spécification : article Odoo 954 (Garage v1.1, 15/10/2026), catalogue 962, brief `docs/briefs/4.1-garage-schema-services.md`. Modèle : `docs/schema-voiture.md`.

## Décisions d'architecture (reprises du brief)

- **Préfixe `garage_`**, snake_case, bloc commun sur les 15 tables (`team_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `rev`), identifiants UUID v7 côté client.
- **Pas de clé étrangère vers une autre app.** Véhicule : `core_vehicle`. Personne : `core_person`. Fournisseur et prestataire : `core_contact`. Engagement : `core_event_entry`. Épreuve : `core_event`. Photos et factures : `core_attachment`. Notes : `core_note`.
- **RLS** : `cloisonnement_team` forcée sur les 15 tables, droits du rôle applicatif comme `voiture_`. Vérifié par `pnpm db:verifier-rls`.
- **Aucune vue, aucune table d'événements.** Les calculs (état, zone, indice, km restants) sont des fonctions pures dans `src/apps/garage/regles.ts`.
- **Silhouette lue chez Voiture** par `silhouetteDuVehicule`, jamais par une table `voiture_`.

## Tables de l'article 954 (10)

### garage_component_type : types d'organes de la team

| Colonne | Type | Règle |
|---|---|---|
| `nom` | texte | obligatoire ; unique parmi les lignes actives de la team |
| `cle` | texte | facultative ; clé de l'organe par défaut (`moteur`, `boite`, `embrayage`, `transmissions`, `freins`, `amortisseurs`, `pneus`). Relie la copie à sa position dans le code. Unique parmi les lignes actives |
| `icone` | texte | obligatoire ; nom d'icône du code |
| `critique` | booléen | obligatoire, défaut `true` (faux pour amortisseurs et pneus) |
| `ordre` | entier | obligatoire |
| `positions` | JSON | facultative ; `{ "<cle_gabarit>": { "x": n, "y": n } }` en coordonnées de la `viewBox` de la vue droite. Renseignée seulement pour un organe ajouté par la team |

### garage_vehicle_component : un organe sur une voiture

| Colonne | Type | Règle |
|---|---|---|
| `vehicle_id` | uuid → `core_vehicle` | obligatoire |
| `component_type_id` | uuid → `garage_component_type` | obligatoire |
| `position` | texte | facultative (« avant gauche », « arrière droit ») ; une team peut avoir deux « Freins » |
| `mode_usure` | enum `garage_mode_usure` | obligatoire |
| `duree_vie_reference_km` | entier | facultative, > 0. Saisie par la team, jamais inventée |
| `duree_vie_reference_epreuves` | entier | facultative, > 0. Idem |
| `seuil_orange_pct` | entier | obligatoire, défaut 30 |
| `seuil_rouge_pct` | entier | obligatoire, défaut 10 |

Contrainte : `0 <= seuil_rouge_pct < seuil_orange_pct <= 100`. Retrait logique (`deleted_at`), refusé par le service si une pièce est montée.

### garage_part : une pièce physique

| Colonne | Type | Règle |
|---|---|---|
| `vehicle_id` | uuid → `core_vehicle` | obligatoire (stock propre à chaque voiture) |
| `component_type_id` | uuid → `garage_component_type` | obligatoire |
| `designation` | texte | obligatoire |
| `marque`, `reference`, `numero_serie` | texte | facultatives |
| `qualite` | enum `garage_qualite_piece` | obligatoire, défaut `origine` |
| `duree_vie_km`, `duree_vie_epreuves` | entier | facultatives, > 0. Saisies par la team |
| `achetee_le` | timestamptz | facultative |
| `prix_cents`, `devise` | entier, texte | facultatifs ; `devise` défaut `EUR`. Jamais servis à l'assistance (service) |
| `fournisseur_contact_id` | uuid → `core_contact` | facultative |
| `statut` | enum `garage_statut_piece` | obligatoire, défaut `en_stock` |
| `emplacement` | texte | facultatif (atelier, remorque…) |
| `km_cumules` | décimal(8,1) | obligatoire, défaut 0, >= 0 (correction A) |
| `epreuves_cumulees` | entier | obligatoire, défaut 0, >= 0. `km_cumules` et `epreuves_cumulees` sont mis à jour dans la même transaction que `garage_wear_log` |

### garage_part_mount : pose et dépose

| Colonne | Type | Règle |
|---|---|---|
| `part_id` | uuid → `garage_part` | obligatoire |
| `vehicle_component_id` | uuid → `garage_vehicle_component` | obligatoire |
| `posee_le` | timestamptz | obligatoire |
| `km_pose` | décimal(8,1) | obligatoire, défaut 0, >= 0 (km cumulés de la pièce à la pose) |
| `deposee_le` | timestamptz | facultative, >= `posee_le` |
| `motif_depose` | enum `garage_motif_depose` | facultatif ; obligatoire si `deposee_le` est renseigné |

Contraintes : `(deposee_le IS NULL) = (motif_depose IS NULL)` ; `deposee_le >= posee_le`. **Index uniques partiels** (pose active = `deposee_le IS NULL AND deleted_at IS NULL`) : une seule pose active par `vehicle_component_id`, une seule par `part_id`.

### garage_wear_log : usure ajoutée à chaque épreuve ou roulage

| Colonne | Type | Règle |
|---|---|---|
| `part_id` | uuid → `garage_part` | facultative (correction B) |
| `tyre_set_id` | uuid → `garage_tyre_set` | facultative (correction B) |
| `event_id` | uuid → `core_event` | facultative (l'épreuve) |
| `event_entry_id` | uuid → `core_event_entry` | facultative (l'engagement) |
| `km_ajoutes` | décimal(8,1) | obligatoire, défaut 0, >= 0 (0 si Saison n'a pas de km chronométrés) |
| `epreuve_comptee` | booléen | obligatoire, défaut faux |
| `date` | timestamptz | obligatoire |
| `source` | enum `garage_source_usure` | obligatoire |

Contraintes :
- **Exactement un des deux** : `(part_id IS NULL) <> (tyre_set_id IS NULL)`. Une ligne d'usure va à une pièce ou à un train de pneus, jamais aux deux.
- **Index unique** `(part_id, event_entry_id, source)` quand `event_entry_id IS NOT NULL AND part_id IS NOT NULL` (sans filtre `deleted_at`) : une validation de résultat n'ajoute l'usure qu'une fois à une pièce.
- **Second index unique** `(tyre_set_id, event_entry_id, source)` quand `event_entry_id IS NOT NULL AND tyre_set_id IS NOT NULL` : même garantie pour le train monté sur l'organe Pneus.

### garage_work_order : ordre de travail

| Colonne | Type | Règle |
|---|---|---|
| `vehicle_id` | uuid → `core_vehicle` | obligatoire |
| `vehicle_component_id` | uuid → `garage_vehicle_component` | facultative |
| `type` | enum `garage_type_ordre` | obligatoire |
| `titre` | texte | obligatoire |
| `a_faire_avant_event_id` | uuid → `core_event` | facultative (épreuve) |
| `duree_estimee_minutes` | entier | facultative, >= 0 |
| `statut` | enum `garage_statut_ordre` | obligatoire, défaut `prevu` |
| `avancement_pct` | entier | obligatoire, défaut 0, entre 0 et 100 |
| `cout_main_oeuvre_cents`, `devise` | entier, texte | facultatifs ; jamais servis à l'assistance (service) |
| `prestataire_contact_id` | uuid → `core_contact` | facultative |
| `origine` | enum `garage_origine_ordre` | obligatoire, défaut `saisie` |

Affectations, pièces utilisées : tables de lignes ci-dessous. Notes : `core_note` (fiche `work_order`). Photos : `core_attachment` (rôle `photo`).

### garage_purchase : commande de pièces

| Colonne | Type | Règle |
|---|---|---|
| `vehicle_id` | uuid → `core_vehicle` | obligatoire |
| `supplier_contact_id` | uuid → `core_contact` | obligatoire |
| `statut` | enum `garage_statut_commande` | obligatoire, défaut `commandee` |
| `commandee_le` | timestamptz | obligatoire |
| `livraison_prevue_le` | date | facultative (date sans heure) |
| `recue_le` | timestamptz | facultative ; obligatoire si `statut = 'recue'` |

Facture : `core_attachment` (rôle `document`, fiche `purchase`). Lignes : `garage_purchase_line`.

### garage_tyre_set : train de pneus

| Colonne | Type | Règle |
|---|---|---|
| `vehicle_id` | uuid → `core_vehicle` | obligatoire |
| `vehicle_component_id` | uuid → `garage_vehicle_component` | facultative : organe Pneus sur lequel le train est monté |
| `marque`, `modele`, `gomme`, `dimensions` | texte | obligatoires `marque` ; les autres facultatifs |
| `type` | enum `garage_type_pneus` | obligatoire |
| `achete_le` | timestamptz | facultative |
| `nombre_epreuves` | entier | obligatoire, défaut 0, >= 0 |
| `km_speciale` | décimal(8,1) | obligatoire, défaut 0, >= 0. Mis à jour, avec `nombre_epreuves`, dans la même transaction que `garage_wear_log` (correction B) |
| `usure_estimee_pct` | entier | facultatif, entre 0 et 100 |
| `statut` | enum `garage_statut_pneus` | obligatoire, défaut `neuf` |

### garage_incident : casse ou sortie de route

| Colonne | Type | Règle |
|---|---|---|
| `vehicle_id` | uuid → `core_vehicle` | obligatoire |
| `event_id` | uuid → `core_event` | facultative |
| `event_entry_id` | uuid → `core_event_entry` | facultative (engagement, issu de l'abandon déclaré) |
| `date` | timestamptz | obligatoire |
| `speciale_nom` | texte | facultatif : copie du nom de la spéciale d'abandon (Saison n'est pas lue par la table) |
| `stage_id` | uuid | facultatif, **sans clé étrangère** : la spéciale d'abandon de Saison (`stageAbandonId`), sur le modèle de `partenaire_id` dans Voiture (correction D) |
| `type` | enum `garage_type_casse` | obligatoire |
| `cause` | texte | facultatif |
| `reparation_work_order_id` | uuid → `garage_work_order` | facultative |

Organes touchés : `garage_incident_component`. Pièces cassées : `garage_incident_part`. Notes : `core_note` (fiche `incident`). Photos : `core_attachment` (rôle `photo`).

### garage_equipment : équipements de la team

| Colonne | Type | Règle |
|---|---|---|
| `nom` | texte | obligatoire |
| `categorie` | enum `garage_categorie_equipement` | obligatoire |
| `etat` | texte | facultatif (voir choix à valider) |
| `achete_le` | timestamptz | facultative |
| `valeur_cents`, `devise` | entier, texte | facultatifs ; jamais servis à l'assistance |
| `prochain_controle_le` | date | facultative |
| `emplacement` | texte | facultatif |

Pas de `vehicle_id` : la table appartient à la team.

## Tables de lignes (5)

Chacune porte le bloc commun. Noms selon la convention `<table>_line` ou `<table>_<objet>` demandée par le brief.

| Table | Lignes de | Colonnes |
|---|---|---|
| `garage_purchase_line` | `garage_purchase` (lignes de commande) | `purchase_id` obligatoire ; `part_id` facultatif (rempli à la réception, qui crée la pièce) ; `designation` obligatoire ; `reference` facultative ; `quantite` défaut 1, >= 1 ; `prix_unitaire_cents` défaut 0, >= 0 ; `devise` |
| `garage_work_order_part` | `garage_work_order` (pièces utilisées) | `work_order_id`, `part_id` ; unique `(work_order_id, part_id)` |
| `garage_work_order_person` | `garage_work_order` (personnes affectées) | `work_order_id`, `person_id` → `core_person` ; unique `(work_order_id, person_id)` |
| `garage_incident_component` | `garage_incident` (organes touchés) | `incident_id`, `vehicle_component_id` ; unique `(incident_id, vehicle_component_id)` |
| `garage_incident_part` | `garage_incident` (pièces cassées) | `incident_id`, `part_id` ; unique `(incident_id, part_id)` |

## Enums

Valeurs en minuscules, sans accent, pour rester en snake_case. Les libellés français viennent du code.

| Enum | Valeurs (article 954) |
|---|---|
| `garage_qualite_piece` | `origine`, `renforcee`, `competition` |
| `garage_statut_piece` | `en_stock`, `montee`, `en_revision`, `usee`, `cassee`, `vendue` |
| `garage_motif_depose` | `usure`, `casse`, `preventif`, `revision` |
| `garage_mode_usure` | `km`, `epreuves`, `les_deux` |
| `garage_source_usure` | `resultat_saison`, `saisie_manuelle` |
| `garage_type_ordre` | `revision`, `reparation`, `remplacement`, `controle` |
| `garage_statut_ordre` | `prevu`, `en_cours`, `termine` |
| `garage_origine_ordre` | `saisie`, `point_checklist` |
| `garage_statut_commande` | `commandee`, `expediee`, `recue` |
| `garage_type_pneus` | `asphalte`, `terre`, `pluie`, `neige` |
| `garage_statut_pneus` | `neuf`, `utilise`, `use` |
| `garage_type_casse` | `casse_mecanique`, `sortie`, `accident` |
| `garage_categorie_equipement` | `remorque`, `outillage`, `levage`, `assistance`, `stand` |

## Contraintes écrites à la main (migration)

Prisma ne les exprime pas : elles vont en SQL dans la migration.

1. Pose active unique par organe et par pièce (index partiels, décrits plus haut).
2. `garage_wear_log` unique sur `(part_id, event_entry_id, source)` quand l'engagement est renseigné.
3. Seuils : `0 <= seuil_rouge_pct < seuil_orange_pct <= 100`.
4. Durées de vie strictement positives quand elles sont renseignées (`duree_vie_*`, `duree_vie_km` et `duree_vie_epreuves` des pièces).
5. Avancement d'un ordre de travail entre 0 et 100.
6. Dépose : `(deposee_le IS NULL) = (motif_depose IS NULL)` et `deposee_le >= posee_le`.
7. Commande reçue : `recue_le` renseigné si `statut = 'recue'`.
8. Noms uniques parmi les types d'organes actifs de la team (index partiel), clé par défaut unique parmi les actifs.
9. Index `team_id` et `(team_id, deleted_at)` sur les 15 tables, index sur chaque clé étrangère.
10. `garage_wear_log` : exactement un de `part_id` et `tyre_set_id` ; second index unique partiel sur `(tyre_set_id, event_entry_id, source)` (correction B).

Ce que le schéma ne contrôle pas, et que porte le service (dans la même transaction) : une pièce `montee` a une pose active, et une seule ; une pièce d'un autre véhicule ou d'un autre type d'organe ne se pose pas ; `km_cumules` et `epreuves_cumulees` suivent la somme des `garage_wear_log`.

## Choix à valider (point d'arrêt)

Ces points ne sont pas tranchés par l'article, ou l'article les laisse ouverts. Je propose une solution pour chacun, et je ne l'écris pas avant ton feu vert.

1. **Durées de vie.** Deux colonnes par organe et par pièce (km, épreuves) au lieu d'une « durée de vie de référence » unique : le mode « les deux » en a besoin. Pas de valeur par défaut.
2. **Priorité d'un ordre de travail.** L'article la cite sans valeurs. Je ne l'ajoute pas en 4.1 : elle arrive en 4.3 avec les valeurs confirmées par toi ou John.
3. **État d'un équipement.** L'article ne donne pas de valeurs. Proposition : texte libre en 4.1, enum en 4.6.
4. **Emplacement de stock** (pièces, équipements) : texte libre (atelier, remorque, comme dans l'écran).
5. **Pneus montés** : colonne `vehicle_component_id` sur `garage_tyre_set`, sans table de pose pour les trains.
6. **Positions** : `positions` en JSON sur les types d'organes ajoutés ; les organes par défaut ont leur position dans `src/apps/garage/positions.ts`, relié par `cle`.
7. **`km_pose`** : km cumulés de la pièce au moment de la pose. Il n'y a pas d'odomètre de la voiture dans le socle.
8. **Cumuls** `km_cumules` et `epreuves_cumulees` stockés sur la pièce, mis à jour avec le journal d'usure. L'article les liste comme champs. L'autre solution, les sommes à la lecture, ne change rien au reste.
9. **Spéciale** : texte (`speciale_nom`), sans lien vers Saison, qui n'est pas lue.
10. **Origine « point de check-list »** : valeur d'enum seulement. La référence au point viendra avec le lot 5, quand la table de check-lists existera.
11. **Seuils** : défauts de base 30 et 10, égaux à la constante unique de `regles.ts`. Un test vérifie l'égalité.
12. **Pièces jointes et notes** : factures en `core_attachment` (rôle `document`), photos (rôle `photo`), notes en `core_note` (fiches `work_order`, `incident`, `purchase`).
13. **Unités** : durée estimée en minutes, coûts et prix en centimes, devise `EUR` par défaut.

## Corrections validées le 20/10 (A à D)

Le schéma ci-dessus intègre ces quatre corrections de l'orchestrateur. Les choix 1 à 13 sont validés tels quels ; la priorité d'un ordre de travail (2) arrive en 4.3 et l'état d'un équipement (3) en 4.6, avec leurs valeurs.

**A. Km en décimal.** Saison stocke `km_chronometres` en `Decimal(6,1)` ; en entiers, l'arrondi s'accumulerait épreuve après épreuve. Passent en `décimal(8,1)` : `garage_wear_log.km_ajoutes`, `garage_part.km_cumules`, `garage_part_mount.km_pose`, `garage_tyre_set.km_speciale`. Les durées de vie en km restent entières. Les règles calculent sur ces décimaux, avec des tests sur des valeurs à virgule (par exemple 12,3 km sur 3 épreuves).

**B. Usure des pneus sans double comptage.** Le train monté sur l'organe Pneus reçoit lui aussi les km et l'épreuve à la validation d'un résultat, avec la même garantie d'unicité que les pièces : `garage_wear_log.tyre_set_id` (facultatif), `part_id` devient facultatif, `CHECK` « exactement un des deux », second index unique partiel `(tyre_set_id, event_entry_id, source)`. `nombre_epreuves` et `km_speciale` du train sont mis à jour dans la même transaction que les cumuls d'une pièce.

**C. État de l'organe Pneus.** Il se calcule sur le train monté : `état = 100 − usure_estimee_pct`, « À renseigner » si l'usure n'est pas saisie ou s'il n'y a pas de train monté. L'organe n'est pas critique : il n'entre pas dans l'indice. La règle est dans `src/apps/garage/regles.ts`, avec ses tests. Conséquence à connaître : `usure_estimee_pct` est saisie à la main ; les km et épreuves du train ne la modifient pas. Le train les enregistre pour l'historique.

**D. Spéciale d'une casse.** `speciale_nom` (copie du nom) et `stage_id` (uuid, sans clé étrangère), sur le modèle de `partenaire_id` dans Voiture. Charges utiles réelles, vérifiées dans `src/apps/saison/services-serveur.ts` :
- `saison.abandon_declare`, émis seulement quand `statutFinal = abandon` : `{ entryId, eventId, causeAbandon, stageAbandonId }`. C'est la source de `stage_id` (4.4).
- `saison.resultat_valide` : `{ entryId, eventId, statutFinal, classementGeneral, tempsTotalMs, penalitesMs }`. **Elle ne porte pas les km chronométrés.** Garage les lit donc par une lecture partagée en lecture seule, `lireUsureEngagement(ctx, entryId)` dans `src/apps/saison/lectures-partagees.ts`, qui renvoie `km_chronometres` et l'épreuve de l'engagement. Garage n'écrit jamais dans les tables de Saison.

## Ce qui n'est pas fait

- Aucune migration, aucune modification de `prisma/schema.prisma`, aucun service, aucune règle. Ce document est le seul livrable de ce point.
- Pas de table de synchro (4.3 traitera le parc d'assistance).
- Pas de table de check-lists (lot 5).
