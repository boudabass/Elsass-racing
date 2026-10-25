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

## Résultats, débrief, historique et saisons (tâche 2.3)

### Retouches de la 2.2

- **Marge basse** : l'espace connecté (`src/app/(app)/layout.tsx`) réserve sous le contenu la hauteur du bouton Prochaine étape et de la barre basse (`pb-48`, `md:pb-24`), pour que la dernière ligne reste cliquable.
- **Filtres du calendrier** : appliqués au changement d'une liste (`composants/filtres.tsx`), sans bouton. Le choix reste dans l'URL.
- **Organisateur et ASA** : choisis parmi les contacts de la team (`core_contact`), avec « Aucun ». Le serveur vérifie que le contact appartient à la team. Pas de création de contact ici.

### Onglet Résultats (fiche épreuve)

`?onglet=resultats`. Un bloc par engagement parti ou terminé (`lireResultatsEpreuve`). La saisie tient en statut final, classement général et de classe ; « Plus de détails » déplie le reste (temps en mm:ss,d, stockés en millisecondes via `parserDuree`). La preuve est un lien. Le statut de validation est en couleur, avec « sans preuve » sur un validé sans lien.

- **Valider** : affiché seulement si `transitionResultat` l'autorise pour ce membre. Pour l'auteur qui n'est pas responsable, la phrase « Un autre membre doit valider ce résultat. » remplace le bouton.
- **Contester** : seulement un résultat validé, commentaire obligatoire.
- **Public** : interrupteur `public` sur le résultat.

### Résultats à valider

`/apps/saison/a-valider` : les résultats saisis, à vérifier ou contestés, du plus ancien au plus récent, avec le bouton Valider quand le membre peut le faire. Le compteur figure à côté de l'entrée sur le calendrier.

### Boîte d'actions

- **Saisie ou nouvelle preuve** : `saison.action_requise`, type `resultat_a_valider`, clé `resultat_a_valider:<entryId>`, priorité 3 (article 960), regroupement `resultats_a_valider`, niveau écriture. Les destinataires sont listés **par membership** : responsable et équipage actifs, sans l'auteur de la saisie (sauf s'il est responsable). Le choix évite qu'un auteur voie une action qu'il ne peut pas décider.
- **Validation ou contestation** : `saison.action_levee` avec la même clé.
- **Décision** : gestionnaire de `core.action_decidee` dans Saison (`appliquerDecision`). Il appelle la même règle que le service. Si elle refuse, l'action est rouverte.
- **Clôture proposée** : `saison.action_requise` de type `cloture_saison_proposee`, responsable, clé `cloture_saison:<seasonId>`, priorité 7, niveau gestion. Émise une fois, au recalcul, quand `clotureProposee` est vraie.

### Débrief

Dans la fiche engagement, après l'épreuve : ressenti de 1 à 5 par cinq boutons, points positifs, points à améliorer, problèmes voiture. Un débrief par membre, écrit dans la base locale (`saison_debrief`, synchronisée : voir `docs/synchro.md`). **Privé à l'équipage** : `lireDebriefs` renvoie une liste vide pour l'assistance et l'invité (`peutVoirDebriefs`). La section n'apparaît pas pour un membre qui ne peut ni débriefer ni voir de débrief.

### Écran de fin d'épreuve

Bloc « Débrief de l'épreuve » en tête de la fiche engagement, seulement pour un résultat validé (`lireFinDEpreuve`). Il montre le résultat officiel, les km de l'épreuve, le total de la saison (résultats validés seuls), le rappel de débrief. **Le coût n'apparaît pas** : Budget n'existe pas encore, et un zéro serait trompeur.

### Historique et saisons

`/apps/saison/historique` :

- Chaque saison avec épreuves, engagements partis, arrivées, abandons, km, calculés sur les résultats validés seuls (`bilanSaison`).
- Statistiques par personne (pilote et copilote) et par voiture sur toutes les saisons (`statistiquesCarriere`) : épreuves, arrivées, taux, km, meilleur classement de classe. Un résultat non validé ne compte jamais.
- **Nouvelle saison** (gestion) : année proposée = dernière + 1, dates modifiables (`creerSaison(annee, dates)`).
- **Clôturer la saison** (gestion) : confirmation en deux temps qui dit ce que la clôture change. La saison passe en lecture ; les statistiques restent. Le badge « clôture proposée » apparaît quand `clotureProposee` est vraie.

**Saison clôturée** : toute écriture sur ses épreuves, engagements, inscriptions, résultats et débriefs est refusée avec `MESSAGE_SAISON_CLOTUREE` (`garderSaisonOuverte`, test `regles-resultats.test.ts`).

### Conversion et règles pures

`src/apps/saison/regles-resultats.ts` : `parserDuree` / `formaterDuree` (mm:ss,d ↔ millisecondes), `statistiquesCarriere`, `bilanSaison`, `refusEcritureSaison`, `peutVoirDebriefs`, `ressentiValide`, priorités, libellés de validation. Testé dans `regles-resultats.test.ts`.

### Vérifications

- `db:verifier-bus` : la demande ne va pas à l'auteur ; l'auteur ne peut pas la décider depuis la boîte ; la validation par l'autre membre passe par la boîte et valide le résultat ; l'action sort de la boîte.
- E2E `e2e/saison-resultats.spec.ts` : filtres sans bouton ; paiement puis saisie par l'équipier A ; A ne valide pas ; B valide depuis `a-valider` ; le débrief de B ; l'assistance ne voit ni ressenti ni boutons ; clôture ; refus d'écriture sur la saison clôturée. Captures dans `docs/captures/saison-resultats-*`, `saison-historique-*`, `saison-a-valider-*`.

### Non fait ou à trancher

- **Captures de fichiers** : la capture d'écran de la preuve attend l'envoi de fichiers (lot 5). Seul le lien est saisi.
- **Recalcul de « clôture proposée »** : émise au recalcul, sans relance. Si le responsable écarte l'action, elle ne revient pas.
- **Entrée « Résultats à valider » dans le menu de l'app** : le compteur et le lien sont sur le calendrier ; le menu d'app du manifeste n'est pas modifié.
- **Rouverture de l'action** : si la règle refuse une décision, l'action redevient en attente, sans message à l'écran. Le membre la verra revenir.

## Préparation, reconnaissances, rappels, widgets et hors ligne (tâche 2.4)

### Retouches de la 2.3 (section 0 du brief)

- **Clôture proposée sur une saison clôturée** : la clôture lève l'action `cloture_saison:<seasonId>`, et `clotureProposee(epreuves, saisonCloturee)` renvoie faux pour une saison clôturée (test dans `regles.test.ts`).
- **Écritures sur une saison clôturée** : `lireEpreuve`, `lireEngagement` et `lireReconnaissances` renvoient `saisonCloturee`. Les écrans n'affichent aucun bouton d'écriture, Contester et Valider compris (`droitsResultat` reçoit l'état d'ouverture). Les services refusaient déjà.
- **Libellés** : `src/apps/saison/libelles.ts` porte tous les libellés (statuts, types, modes de paiement, points, rôles). `libelles.test.ts` lit `prisma/schema.prisma` et vérifie que chaque valeur d'énumération Saison a son libellé.
- **Onglets** : `composants/onglets.tsx` défile horizontalement ; l'onglet actif est ramené dans la vue.
- **Refus de décision** : la règle refusée écrit son motif dans `core_action.message_refus` (migration `action_message_refus`) et remet l'action en attente. La carte de la boîte affiche le motif en alerte. Une nouvelle décision ou une réouverture efface le motif.
- **Menu d'app** : Calendrier (`/`), Résultats à valider (`/a-valider`), Historique (`/historique`).
- **Correctif** : les lectures figeaient le rôle de l'acteur à « responsable », ce qui donnait à l'équipage le droit de valider sa propre saisie dans l'écran. Le rôle réel est lu désormais.
- **Correctif** : l'heure saisie (`instantParis`) suit l'heure d'été et d'hiver. Le décalage fixe à +02:00 était faux après le 25 octobre.

### Prêt pour l'épreuve ?

- Onglet de la fiche épreuve, un panneau par engagement (`composants/preparation.tsx`). Indice en grand, quatre points (paiement, licences, homologations, papiers), « Pas encore suivi » ; depuis 4.5, un bloc « À surveiller » (zone rouge de Garage, hors indice) et la fiabilité de la voiture quand la ligne n'existe pas, et les éléments « à côté » (fiabilité, check-lists, présents) affichés « Pas encore suivi ».
- Règle pure `preparation.ts` : le paiement existe toujours (lu sur l'inscription) ; un point non suivi n'entre pas dans l'indice. Pas d'indice sans point suivi.
- Aucun signal ne pose plus de point depuis 5.2b. Les licences et homologations se lisent chez Équipe (`equipe.licence_expire_bientot` et `equipe.homologation_expire_bientot` n'ont pas de gestionnaire), les papiers chez Voiture (`voiture.papier_expire_bientot` n'a pas de gestionnaire), à la date de l'épreuve (`preparation-equipe-serveur.ts`, `preparation-voiture-serveur.ts`, règles dans `preparation.ts`). `garage.piece_zone_rouge` n'a plus de gestionnaire depuis 4.5 (954 v1.4). Les lignes posées par les anciens signaux restent en base, ignorées par `pointsDePreparation`. Point Papiers : réglé si chaque type de papier a au moins un papier non expiré à la date de l'épreuve (statut « expiré » de Voiture, `statutPapier`) ; un papier sans échéance ne bloque pas ; aucun papier saisi : ouvert. « Régler » mène à l'onglet Papiers de la fiche véhicule.
- **À confirmer par les apps Équipe et Voiture** : cette charge utile est une convention de Saison. Le catalogue ne la décrit pas.

### Reconnaissances

- `saison_recce` : une par épreuve (créneau, passages, vitesse, véhicule de reco, plaque, consignes). Le véhicule doit être de type `reco`, actif, de la team.
- `saison_recce_session` : sorties (date, présents, spéciales reconnues, passages, notes). Écrites par la synchro (voir hors ligne). Hors créneau : une information affichée, jamais un blocage (`reconnaissances.ts`).

### Rappels

- Règle pure `rappels.ts` (`rappelsDues`) : renvoie les clés attendues. `recalculerRappels`, appelée par `recalculerDans`, crée celles qui manquent et lève les autres (`action_levee`).
- Une clé déjà présente, même décidée, n'est jamais recréée. Seule la relance de validation met à jour son action.
- Fenêtres : clôture des engagements J-14 (de J-14 à J-8), puis J-7 (de J-7 au jour de clôture), tant qu'un engagement n'est pas payé ; reconnaissance J-3 ; programme du jour, le matin (ou dès qu'il existe) ; résultat à saisir à partir du lendemain de la fin, tant qu'il n'y a pas de résultat ; relance de validation 48 heures après la saisie, tant que le résultat n'est pas validé (même clé que la demande de validation, priorité 6).
- Priorités : clôture et résultat à saisir 2, validation 3, reconnaissance et programme 7, relance 6 (table de l'article 960, `prochaine-etape.ts`).

### Widgets et prochaine épreuve

- `widgets-serveur.ts` : prochaine épreuve, préparation de la prochaine épreuve, résultats à valider, bilan de la saison. Pas d'affichage (le Tableau de bord arrive au lot 6). Les résumés sont dans `widgets.ts`.
- **Source unique de la prochaine épreuve** : `prochaineEpreuveDeLEquipe` sert au QG (compte à rebours de la barre haute, bouton Prochaine étape) et au calendrier. Le QG ne fait plus sa propre requête.

### Hors ligne (synchro)

Déclarations dans `synchro-serveur.ts`, registre dans `registre.ts` :

| Table | Lecture | Écriture | Note |
|---|---|---|---|
| `core_event` | lecture | non | lecture seule (`lectureSeule`) |
| `saison_stage` | lecture | non | lecture seule |
| `saison_schedule_item` | lecture | non | lecture seule |
| `saison_recce` | lecture | non | lecture seule (les règles de reco s'écrivent en ligne) |
| `saison_recce_session` | lecture | contribution propre | refusée si la saison est clôturée |
| `saison_debrief` | niveau `contribution` | contribution propre | l'assistance ne reçoit jamais le débrief |

- `lectureSeule` : `pousser.ts` refuse toute opération sur ces tables, avec un message en français.
- Un refus métier levé dans la transaction (`RefusSynchro`) rend `refusee` avec son message ; rien n'est écrit.
- Le client (`base.ts`) passe en version 2 de la base locale : les nouveaux magasins sont ajoutés à une base existante.
- Écrans : programme et spéciales lus dans la base locale (`composants/programme-hors-ligne.tsx`, repli sur le rendu serveur) ; sorties de reco lues et écrites dans la base locale (`composants/reconnaissances.tsx`).
- Préchargement du service worker : les pages `?onglet=programme` et `?onglet=reconnaissances` de la prochaine épreuve (`layout.tsx`, `enregistrement-sw.tsx`).

### Vérifications

- `pnpm test` : règles pures (préparation, rappels, reconnaissances, widgets, libellés, heure de Paris).
- `db:verifier-bus` : papiers lus chez Voiture à la date de l'épreuve (expiré, renouvelé, aucun papier), signal de papier sans effet, pièces, licence, signal pour une autre voiture sans effet, refus d'une décision (action en attente, motif gardé), relance de validation après 48 heures.
- `db:verifier-synchro` : registre, lecture seule refusée, sortie écrite par l'équipage, sortie refusée à l'assistance, débrief privé (jamais reçu par l'assistance), saison clôturée refusée.
- `db:verifier-rls` : inchangé, aucune nouvelle table.
- E2E `e2e/saison-hors-ligne.spec.ts` (projet « hors-ligne ») : programme affiché en mode avion ; sortie de reco saisie hors ligne, affichée tout de suite, puis en base au retour du réseau. Ce même fichier produit les captures `docs/captures/saison-pret-*` et `saison-reconnaissances-*`.

### Non fait ou à trancher

- **Débrief hors ligne** : fait (section 0 de la 2.5). Le formulaire écrit dans la base locale ; l'événement `saison.debrief_saisi` part de la synchro. Détails : `docs/synchro.md`.
- **Widgets** : les lectures sont écrites et leurs résumés testés ; les lectures en base ne sont pas couvertes par un test dédié (elles passent par le QG, couvert par les e2e).
- **Charge utile des signaux de préparation** : à confirmer avec les apps Équipe et Voiture (voir plus haut).
- **Destinataires figés par membership** : un équipier ajouté après l'émission ne reçoit pas les rappels déjà émis (accepté, limite connue).
- **Clôture écartée** : la proposition de clôture n'est pas relancée une fois écartée (accepté, limite connue).
- **Fichiers de preuve** : hors périmètre tant que le lot 5 n'envoie pas de fichiers.

## Liaisons avec Budget (tâche 2.7)

- Saison propose à Budget un paiement d'engagement (`saison.engagement_paye`) : Budget propose une dépense d'engagement, une seule en attente par engagement.
- Budget demande à Saison de marquer un engagement payé quand une dépense d'engagement est saisie (`budget.depense_creee`) : action `marquer_engagement_paye`, clé `marquer_paye:<entryId>`. La décision enregistre le paiement avec la date, le montant, le mode et le payeur de la dépense, lus par une fonction de Budget (`lireDepenseEngagementDans`). Tout paiement enregistré dans Saison, saisie directe comprise, lève l'action `marquer_paye:<entryId>` restée en attente (`saison.action_levee`, dans `enregistrerPaiementDans`).
- Mode de paiement : `especes` (valeur de `saison_paiement_mode`, migration `saison_paiement_especes`, libellé « Espèces »). Budget transmet les espèces telles quelles.
- Pas de boucle (détails dans `docs/schema-budget.md`, section Liaisons).
- Fiche épreuve : onglet « Dépenses » quand Budget est activée et que le membre a la contribution (contrat d'onglets, `src/core/sdk/onglets.ts`). Le composant est fourni par Budget.
- Fin d'épreuve : ligne « Coût de l'épreuve » (Budget), seulement s'il existe une dépense.
- Par épreuve (Budget) : km chronométrés validés lus par `lireKmChronometresValides` (Saison).
