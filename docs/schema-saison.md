# Saison : schéma, règles et services (lot 2, tâche 2.1)

Cette tâche ne contient aucun écran. Elle pose le schéma, les règles pures et les services serveur que les écrans des tâches 2.2 et 2.3 appelleront. Spécification : article Odoo 949 (Saison v1.3), catalogue 962.

## Tables

Douze tables préfixées `saison_`, toutes avec le bloc commun et `team_id`, le RLS `cloisonnement_team` (même motif que `settings_*`), `@@index([teamId])` et `@@index([teamId, deletedAt])`. Migration `saison_schema`.

| Table | Lien | Notes |
|---|---|---|
| `saison_event_info` | 1 pour 1 avec `core_event` | Tarifs en centimes, devise, dates calendaires |
| `saison_registration` | 1 pour 1 avec `core_event_entry` | Montants, mode de paiement, deux liens vers `core_person` (`concurrent`, `payeur`) |
| `saison_readiness` | n par engagement, unique `(entry_id, point)` | Points de préparation |
| `saison_recce` | 1 pour 1 avec `core_event` | Autorisations de reconnaissance |
| `saison_recce_session` | n par reconnaissance | Personnes et spéciales en `uuid[]` |
| `saison_stage` | n par épreuve, unique `(event_id, numero)` | Spéciales, manches, montées |
| `saison_schedule_item` | n par épreuve | Programme horaire |
| `saison_result` | 1 pour 1 avec `core_event_entry` | Résultat, validation, preuve, auteurs (deux liens vers `core_membership`) |
| `saison_debrief` | n par engagement, unique `(entry_id, auteur_membership_id)` | Ressenti de 1 à 5 (CHECK) |
| `saison_generated_doc` | n par engagement | Table seulement : la génération viendra avec l'app Documents (lot 5) |
| `saison_championship` | n par saison | Suivi de classement |
| `saison_standing` | n par championnat | Points et position d'une personne |

Enums `Saison…` avec `@@map` en snake_case : `SaisonPaiementMode`, `SaisonReadinessPoint`, `SaisonReadinessStatut`, `SaisonResultStatut`, `SaisonResultValidation`, `SaisonStageType`, `SaisonScheduleType`, `SaisonGeneratedDocType`.

Contraintes ajoutées à la main dans la migration : le ressenti vaut de 1 à 5, les montants (`tarif_normal`, `tarif_licencie_asa`, `montant_du`, `montant_paye`) sont positifs ou nuls.

Les listes de `uuid[]` (`personnes`, `speciales` de `saison_recce_session`) n'ont pas de clé étrangère possible : l'application vérifie qu'elles pointent vers des lignes de la team.

## Statuts

**Engagement** (`core_event_entry.statut`), recalculé à partir de l'état et jamais cumulé : `statutEngagement` dans `src/apps/saison/regles.ts`.

- Sans résultat validé : `envisage` → `inscrit` (dossier envoyé) → `paye` (payé le renseigné) → `parti` (jour de l'épreuve atteint, calendrier de Paris).
- Résultat validé : `arrivee`, `abandon` ou `forfait`. Une exclusion validée reste `arrivee` : la sanction est une décision de classement.
- Un résultat non validé ne change pas le statut. Le statut recule quand l'information est retirée.

**Épreuve** (`core_event.statut`) : `statutEpreuve`. Annulée reste annulée ; en cours du premier au dernier jour inclus ; terminée après ; sinon envisagée.

## Cycle de validation d'un résultat

`transitionResultat` (pur, testé) :

```
saisi ──preuve jointe──▶ a_verifier ──valider──▶ valide ──contester──▶ conteste
                              ▲                                          │
                              └──────────────── preuve jointe ───────────┘
```

- Valider : depuis `saisi` ou `a_verifier`. La preuve est souhaitée, jamais bloquante : un résultat validé sans preuve porte la mention « sans preuve » à l'écran et compte dans les statistiques. Le responsable peut valider n'importe quel résultat, y compris le sien. Un autre membre d'équipage peut valider le résultat d'un autre. Celui qui a saisi ne valide pas son propre résultat, sauf s'il est responsable. L'assistance et les invités ne valident pas.
- Contester : seulement depuis `valide`, avec un commentaire non vide.
- Un résultat validé ne se modifie pas (`saisirResultat` le refuse) : il faut le contester.

## Indice de préparation

`indicePreparation(points, maintenant, debutEpreuve)` : réglés ÷ points existants, arrondi à l'entier inférieur (100 n'apparaît que si tout est réglé). Vert à 100 ; rouge si un point ouvert commence dans moins de 48 heures (ou a déjà commencé) ; orange sinon. Aucun point : `null`. Seules les lignes de `saison_readiness` comptent : un point qu'aucune app n'a encore publié n'existe pas.

## Montants et assistance

L'assistance (niveau effectif `lecture`) lit Saison sans les montants. `masquerMontants` retire `montantDu`, `tarifNormal`, `tarifLicencieAsa`, `modePaiement` et `reference`. `lireInscription` applique ce masquage. Testé dans `regles.test.ts`.

## Services

`src/apps/saison/services-serveur.ts`. Chaque fonction publique commence par `exigerAcces("saison", niveau)`. Chaque fonction `…Dans(ctx, …)` fait le travail sans garde : elle sert aux vérifications de bus et ne doit pas être appelée depuis un composant.

| Fonction | Niveau | Émet |
|---|---|---|
| `creerEpreuve`, `modifierEpreuve`, `annulerEpreuve` | écriture | — |
| `creerEngagement` | écriture | `saison.engagement_cree` |
| `enregistrerPaiement` | écriture | `saison.engagement_paye` |
| `saisirResultat`, `joindrePreuve` | écriture | — |
| `validerResultat` | écriture | `saison.resultat_valide`, et `saison.abandon_declare` si abandon |
| `contesterResultat` | écriture | `saison.resultat_annule` |
| `saisirDebrief` | écriture | `saison.debrief_saisi` |
| `creerSaison`, `cloturerSaison` | gestion | `saison.saison_creee`, `saison.saison_cloturee` |
| `recalculerEpreuves` | lecture | `saison.epreuve_terminee` (une fois par épreuve), `saison.prochaine_epreuve_modifiee` |
| `lireInscription` | lecture | — |

Notes d'implémentation :

- `creerEpreuve` cherche une saison ouverte qui couvre les dates. Sans elle, le message dit quelles dates sont en cause.
- `enregistrerPaiement` écrit le montant saisi dans `montant_paye`. `montant_du` (tarif dû) n'est pas modifié par le paiement.
- `recalculerEpreuves` compare la prochaine épreuve à celle du dernier événement `saison.prochaine_epreuve_modifiee` : pas d'état à part. Il passe aussi les engagements au statut calculé.
- Le kilométrage et la cause d'abandon de l'engagement suivent le résultat validé, et restent vides sans résultat validé.
- Aucun nom d'événement hors du catalogue : tous les noms utilisés sont dans `src/core/evenements/catalogue.ts`.

## Ce qui n'est pas branché

- **Clôture proposée** : `clotureProposee` est une règle pure testée. Aucun service ne l'appelle encore ; l'écran de clôture (2.3) la branchera.
- **Résultats, reconnaissances, prêt pour l'épreuve** : tâches 2.3 et 2.4.

## Données de test (team Koehling)

`pnpm donnees:koehling` (idempotent) ajoute :

- une fiche `saison_event_info` pour les neuf épreuves 2026 (aucune donnée réelle connue en plus) ;
- une inscription par engagement, sans montant ;
- pour l'épreuve à venir (Super Slalom de l'Anneau du Rhin), le point paiement ouvert ;
- pour la première épreuve passée (Rallye Régional de Printemps), trois spéciales et un résultat validé.

**Les spéciales et le résultat sont des données de test.** Noms génériques (« Spéciale test 1 »), aucun chrono. Le résultat est écrit validé sans preuve ni auteur : raccourci de test. À remplacer ou retirer avant tout usage réel.

## Décisions appliquées (orchestrateur, tâche 2.2, point 0)

1. **Statuts passés de Koehling** : la règle gagne. « Parti » sans résultat validé est accepté ; les vrais résultats seront saisis à la main. Un engagement jamais inscrit ni payé reste `envisage` le jour de l'épreuve.
2. **Montant payé** : `montant_paye` (centimes, CHECK ≥ 0), migration `saison_montant_paye`. `montant_du` reste le tarif dû. Le payload de `saison.engagement_paye` porte `montant_paye`.
3. **Validation sans preuve** (décision de John, remplace la précédente) : la preuve est souhaitée, jamais bloquante. Valider est permis depuis « saisi » comme depuis « à vérifier », avec les mêmes règles sur qui valide.
4. **Contesté vers à vérifier** : une nouvelle preuve, ou la correction des champs d'un résultat contesté, le repasse à vérifier.
5. **Exclusion validée** : engagement en `abandon`, cause « Exclusion » si vide. Pas de `saison.abandon_declare` pour une exclusion.
6. **`recalculerEpreuves` au niveau lecture** : accepté, statuts dérivés. Jamais exposé comme Server Action.

## Points tranchés en 2.1 (détail d'origine)

Ces points ne sont pas tranchés dans le brief. Les choix faits sont indiqués, à valider :

1. **Statuts passés de Koehling.** Le script précédent mettait `arrivee` sur toutes les épreuves passées. La règle donne `parti` sans résultat validé. Le recalcul s'exécute après chaque écriture de Saison, comme demandé : la première écriture sur la team Koehling ferait donc repasser ces engagements à `parti`. Je n'ai pas réécrit ces statuts, et je n'ai pas branché le recalcul à l'ouverture du QG, pour éviter le même effet à chaque ouverture. Décision demandée avant la tâche 2.2 : garder `arrivee` (il faut alors saisir les résultats, ou marquer ces épreuves autrement), ou accepter `parti` ?
2. **Montant payé.** La table n'a que `montant_du`. `enregistrerPaiement` y écrit le montant saisi. Faut-il un champ `montant_paye` séparé ?
3. **Validation sans preuve.** Le cycle n'autorise à valider que depuis `a_verifier`, donc un résultat sans preuve ne peut pas être validé. Confirmer.
4. **Conteste → à vérifier.** J'ai retenu : une nouvelle preuve (`joindrePreuve`) fait revenir le résultat à vérifier. Le brief n'indique pas le geste.
5. **Exclusion.** Une exclusion validée donne `arrivee` pour l'engagement. Confirmer, ou prévoir un statut `exclu`.
6. **Recalcul à chaque écriture et à l'ouverture du QG.** `recalculerEpreuves` requiert le niveau `lecture`, car il s'exécute pour tout membre qui voit le QG. Il écrit pourtant des statuts. Confirmer ce niveau.
7. **Clôture de saison.** `cloturerSaison` ne vérifie pas `clotureProposee`. Confirmer qu'une clôture manuelle est libre.
8. **Doublon d'engagement.** Un même véhicule ne peut être engagé deux fois sur une épreuve (refus clair). Confirmer.
9. **Date de session de reconnaissance.** `saison_recce_session.date` est une date calendaire (`@db.Date`), pas un horodatage.
10. **Fin de saison et saison en cours.** `creerSaison` rend la nouvelle saison « en cours » et retire ce statut à l'ancienne.

## Vérifications

- `pnpm db:verifier-rls` : les 12 tables ont le RLS forcé et la politique `cloisonnement_team` ; le rôle applicatif a `SELECT`, `INSERT`, `UPDATE` (droits venus des `ALTER DEFAULT PRIVILEGES` de `core_rls`, non réécrits) ; un championnat de la team B est invisible, intouchable et non créable sous le contexte de la team A.
- `pnpm db:verifier-bus` : création d'un engagement livrée exactement à `checklist`, `equipe`, `garage` ; paiement livré à `budget` seul ; point paiement passé à réglé ; engagement passé à `paye`.
- `pnpm test` : 45 tests sur les règles (`regles.test.ts`), dont les cas limites : jour même de l'épreuve, 48 heures pile, aucun point de préparation, validation par soi-même.

## Écrans du calendrier et de la fiche (tâche 2.2)

Routes sous `src/app/(app)/apps/saison/`. Chaque écran passe par `accesEcran` (`src/apps/saison/ecran.ts`) : app activée pour la team, puis niveau minimum, sinon l'écran de refus existant.

- **Calendrier** (`/apps/saison`) : liste par défaut, vue mois en bascule (`?vue=mois&mois=AAAA-MM`). Filtres saison (défaut : saison en cours), type et statut, en formulaires GET (sans JavaScript). Prochaine épreuve en tête avec le compte à rebours (règle `prochaineEpreuve`). Chaque ligne affiche ce qu'il reste à faire (`resteAFaire`, pur, testé). Sans épreuve : une phrase et un seul bouton « Ajouter une épreuve ».
- **Nouvelle épreuve** (`/apps/saison/nouvelle`) : nom, dates, type. Après création, la fiche s'ouvre. Ouverte depuis le calendrier et depuis le bouton + (entrée « Épreuve » pour le responsable et l'équipage, pas en mode terrain, pas pour l'assistance).
- **Fiche épreuve** (`/apps/saison/epreuves/[id]`) en trois onglets, `?onglet=infos|engagements|programme` : infos (dont le détail `saison_event_info`, et « Annuler l'épreuve » en deux temps), engagements (liste, « Engager une voiture »), programme (spéciales avec total des km chronométrés, programme du week-end). Les onglets prêt, reconnaissances et résultats ne sont pas affichés.
- **Fiche engagement** (`/apps/saison/engagements/[id]`) : voiture, équipage, inscription, « Enregistrer le paiement » (montant prérempli avec le montant dû, en euros à l'écran).
- **Assistance** (niveau lecture) : mêmes écrans, aucun bouton d'écriture, aucun montant ni moyen de paiement. Les montants sont retirés côté serveur par `masquerMontants` (jamais par CSS). Test e2e `j-bis`.

Le bouton + passe en tiroir du bas sous md (point 0.7). Au PC, le menu déroulant reste.

### Actions

`src/apps/saison/actions.ts` (`"use server"`) n'exporte que des enveloppes de `services-serveur.ts`, qui renvoient `{ ok: true }` ou `{ ok: false, message }` en français. Un test (`actions.test.ts`) vérifie qu'aucune fonction `…Dans` n'est exportée. Les messages viennent de `ErreurSaison` (refus métier), de la garde (`libelleErreurAcces`) ou de la validation (premier problème zod).

### Recalcul

`recalculerEpreuves` est appelé après chaque écriture de Saison et à l'ouverture du QG (`src/app/(app)/qg/page.tsx`, qui journalise un échec sans bloquer la page). Une seule lecture (épreuves, engagements, inscriptions, résultats) ; seules les lignes qui changent sont écrites. Un membre sans niveau sur Saison ne déclenche rien.

### Tests de la tâche 2.2

- Unitaires : `reste-a-faire.test.ts`, `regles.test.ts` (corrections des points 0.1, 0.3, 0.5 comprises), `actions.test.ts`, `entrees-plus.test.ts`.
- E2E : `e2e/saison.spec.ts` (création par le +, fiche, engagement, paiement, statut « Payé », puis l'assistance sans montant ni bouton) et `e2e/telephone.spec.ts` (tiroir du + à 360×740). Captures dans `docs/captures/saison-*.png`.

### Non fait ou à trancher

- **Organisateur** : `core_event.organisateur_contact_id` existe, mais l'écran ne propose pas encore de choix de contact : le champ est absent de la fiche.
- **Lien d'un contact ASA et fichier de règlement** : `saison_event_info` les porte, sans écran pour l'instant.
- **Voiture à créer** : quand aucune voiture de course n'existe, l'écran le dit et renvoie vers l'app Voiture. Aucune création ici, comme demandé.
