# Bus d'événements, boîte d'actions, Prochaine étape

## Bus

- Une app émet un événement avec `emettre(ctx, nom, donnees)` (`src/core/evenements/bus-serveur.ts`). Le contexte `ctx` vient de la garde (`exigerAcces`).
- Le nom doit être dans le catalogue (`src/core/evenements/catalogue.ts`), ou être un motif `<app>.action_requise` / `<app>.action_levee` d'une app du catalogue. Sinon `ErreurEvenement`.
- L'app émettrice est le préfixe du nom.
- L'événement est écrit dans `core_domain_event`, puis une livraison par destinataire dans `core_event_delivery`.
- Destinataires : les apps écrites dans le catalogue ; `*` s'étend aux apps **activées** de la team, sauf l'émetteur ; `core` reste `core`. Les motifs génériques vont au socle.
- `core.action_decidee` n'a pas de destinataire fixe : il est livré à l'app d'origine de l'action, passée explicitement par `decider`.

## Traitement : choix provisoire du lot 1

Il n'y a pas de worker. Le traitement s'exécute **dans la requête qui vient d'émettre**, après l'écriture (`traiterEnAttente`). Quand un worker existera, ce point sera remplacé sans changer les gestionnaires.

- Un gestionnaire est enregistré par app destinataire et par nom exact, ou par motif `*.action_requise` / `*.action_levee` (`src/core/evenements/gestionnaires.ts`).
- Les livraisons de la team sont traitées par ordre d'émission.
- Sans gestionnaire : la livraison passe à `traite`, avec `derniereErreur = "aucun gestionnaire"`. C'est normal tant que les apps ne sont pas écrites.
- Gestionnaire qui échoue : `erreur`, `tentatives + 1`, `derniereErreur` = le message. Le traitement continue avec la suivante. Une livraison en erreur est retentée aux appels suivants, jusqu'à 5 tentatives, puis laissée en erreur.
- Un gestionnaire n'écrit que dans ses propres tables, ou par les fonctions du socle.
- Un gestionnaire peut émettre à son tour. Le traitement imbriqué ne reprend ni la livraison en cours, ni une livraison déjà traitée entre-temps (`traitement-serveur.ts`).

## Boîte d'actions (`core_action`)

Un événement `<app>.action_requise` est traité par le socle (`src/core/actions/gestionnaires-serveur.ts`). Forme du payload :

```ts
{
  type: string,                       // ex. "depense_a_confirmer"
  cleUnicite: string,                 // une seule action par team et par cleUnicite
  titre: string,
  contexte?: string,
  ficheType?: string, ficheId?: uuid, eventId?: uuid,
  destinataires: { roles?: CoreRole[], memberships?: string[] },  // au moins un
  boutons: { cle: string, libelle: string, lien?: string }[],     // de 1 à 4 ; lien : voir « Boutons-liens »
  priorite: 1..9, // rang nommé de la table PRIORITE (src/core/actions/priorites.ts) : une app passe le rang, jamais un chiffre
  bloquant?: boolean,
  echeance?: date ISO,
  cleRegroupement?: string,
  niveauRequis?: "lecture" | "contribution" | "ecriture" | "gestion",  // défaut ecriture
  terrain?: boolean,                  // défaut false
}
```

- Répéter la même `cleUnicite` **met à jour** l'action en attente : jamais de doublon.
- Une action déjà décidée, annulée ou expirée est **réouverte** (statut en_attente, décision effacée). Choix du lot 1 : l'unicité par team empêche de créer une seconde ligne.
- `niveauRequis` et `terrain` sont stockés dans `destinataires` (Json), à côté des destinataires.
- `<app>.action_levee` avec la même `cleUnicite` passe l'action en attente à `annulee`.

### Boutons-liens (5.6 §0)

- Un bouton avec `lien` (chemin relatif sous `/apps/<app>/...`, de la même app que l'événement) **ouvre la fiche sans décider**. La boîte le rend en lien ; `decider` le refuse avec une raison.
- Un chemin hors de l'app, une adresse absolue ou un « .. » fait refuser **l'émission** entière (`motifLienRefuse`, `src/core/actions/liens.ts`).
- **Règle : une action-lien a une levée.** Toute action dont un bouton est un lien doit être levée par son app (`<app>.action_levee`, même `cleUnicite`) à la fin de ce qu'elle demande (renouvellement, réponse, réassignation). Sans levée, elle reste en attente jusqu'à l'expiration de 30 jours après son échéance, comme toute action non traitée. Rien ne le vérifie automatiquement : la règle tient au code de chaque app, et le test de `liens.test.ts` la documente.
- Actions-liens connues : Équipe « Renouveler » (licence, homologation : levée au renouvellement), Équipe « Répondre » (disponibilités : levée à la réponse), Check-lists « Voir les listes » (réassignation : levée quand plus rien n'est à faire).
- `decider(ctx, actionId, cleBouton)` : vérifie que l'action est en attente, que le membre en est destinataire, qu'il a le niveau requis sur l'app d'origine, et que le bouton existe. Passe l'action à `decidee`, puis émet `core.action_decidee` vers l'app d'origine.
- `reporter(ctx, actionId, jusquAu)` : l'action sort de la liste jusqu'à cette date.
- `listerActionsEnAttente(ctx)` : expire d'abord les actions dont l'échéance dépasse de plus de 30 jours (passage à `expiree`), puis renvoie les actions en attente, non reportées, visibles par le membre, groupées par `cleRegroupement`.

### Filtrage et regroupement

- `actionsPourMembre` : le membre est destinataire (rôle ou membership) et son niveau sur l'app d'origine couvre `niveauRequis`.
- `grouperActions` : une action sans `cleRegroupement` forme son groupe. Le titre d'un groupe de plusieurs actions vient de `LIBELLES_TYPES`, sinon « n actions : <type> ».

## Bouton « Prochaine étape »

Le bouton flottant n'est plus affiché (brief 3.11, §9, 19/10) : ni sur ordinateur ni sur téléphone. La logique ci-dessous reste, pour les écrans qui s'en servent.

`choisirProchaineEtape` (`src/core/actions/prochaine-etape.ts`), règles de l'article 960, section 5 :

1. Les actions proposées sont celles du membre, non reportées, et en mode terrain seulement les actions `terrain`.
2. Tri : priorité croissante (1 à 9), puis échéance la plus proche (sans échéance en dernier), puis ancienneté.
3. À moins de 48 heures de l'épreuve (et pas plus de 24 heures passées), les priorités 1 puis 7 passent devant tout le reste.
4. La ligne « pourquoi » vient d'une table par priorité (`pourquoi`, dans `src/core/actions/priorites.ts`).
5. Sans action : compte à rebours « J-n <épreuve> » (« Aujourd'hui <épreuve> » le jour même), sinon rien.

### Priorités (table unique `PRIORITE`, article 960 section 5)

Une app passe un rang nommé de `src/core/actions/priorites.ts`, jamais un chiffre. `db:verifier-priorites` contrôle la base contre cette table.

| Rang | Nom | Types (émis par) |
|---|---|---|
| 1 | `bloquant` | aucun émis (reporté après le lot 5, plan §5.8) |
| 2 | `echeance_depassee` | échéance passée ou du jour : `cloture_engagements` (action à échéance), et les obligations `licence_a_renouveler`, `homologation_a_renouveler`, `papier_a_renouveler`, `renouveler_document` (rang de la date de leur fiche, sans échéance d'action) |
| 3 | `resultat` | `resultat_a_saisir`, `resultat_a_valider` (relance comprise) |
| 4 | `mouvement_a_confirmer` | Budget |
| 5 | `contrepartie` | `preuve_pose`, `publications_promises`, `contrepartie_en_retard` (Partenaires) |
| 6 | `relance` | `tache_relance` (Partenaires) |
| 7 | `suggestion` | `point_critique`, `tache_probleme` (Check-lists), `reconnaissance`, `programme_du_jour` (Saison), `disponibilite_a_repondre` (Équipe) |
| 8 | `proposition` | propositions Check-lists (`ajouter_point`, `cocher_point`, `creer_liste_retour`, `relire_liste`, `creer_listes`, `reassigner_points`), `ordre_depuis_point` (Garage), `message_partenaire`, `emplacement_pris`, `emplacement_supprime`, `reserver_emplacement`, `liberer_emplacement` (Voiture et Partenaires), `cloture_saison_proposee`, `marquer_engagement_paye` (Saison, proposition après une dépense d'engagement de Budget) |
| 9 | `echeance_proche` | échéance à venir, ou sans date |

Une échéance est réémise à chaque recalcul de son app (même `cleUnicite`) tant que l'action est en attente : son rang passe de 9 à 2 le jour J. Une action décidée, expirée ou levée ne revient pas toute seule (`actionEcheanceProposable`).

Deux manières de porter une date (5.8, option c) :
- **Action à échéance** (`core_action.echeance`) : `cloture_engagements`. Elle expire 30 jours après sa date (`src/core/actions/expiration.ts`). Une clôture passée n'a plus rien à faire.
- **Obligation** (`licence_a_renouveler`, `homologation_a_renouveler`, `papier_a_renouveler`, `renouveler_document`) : pas d'échéance sur l'action, donc pas d'expiration. Son app calcule le rang à partir de la date de la fiche (`prioriteEcheance`) à chaque émission. À rang égal, pas de départage par date.

## Charges utiles

Chaque événement porte un objet `donnees`. Les champs non décrits ici ne sont pas lus. Une charge utile invalide est ignorée par le gestionnaire, sans erreur.

### Préparation de l'épreuve (Saison)

Quatre événements disent qu'un point de préparation d'une épreuve à venir est en retard. Saison les écoute (`enregistrerGestionnaire`, `src/apps/saison/services-serveur.ts`) et tient une ligne par engagement et par point.

| Événement | Émis par | Point de préparation |
|---|---|---|
| `equipe.licence_expire_bientot` | Équipe | `licences` |
| `equipe.homologation_expire_bientot` | Équipe | `homologations` |
| `voiture.papier_expire_bientot` | Voiture | aucun (5.2b) : plus de point `papiers`, Saison lit les papiers chez Voiture à la date de l'épreuve |
| `garage.piece_zone_rouge` | Garage | aucun (4.5) : plus de point `pieces`, Saison lit l'état chez Garage en point à surveiller |

Charge utile, la même pour les quatre :

```ts
{
  detail?: string,      // jusqu'à 300 caractères, affiché tel quel sur le point
  regle?: boolean,      // absent ou faux : le point est ouvert ; vrai : il est réglé
  vehicleId?: uuid,     // limite aux engagements de cette voiture
  personId?: uuid,      // limite aux engagements où cette personne est pilote ou copilote
}
```

Sans `vehicleId` ni `personId`, l'événement vise tous les engagements à venir de la team. Les engagements visés : épreuve « envisagée » ou « en cours », engagement « envisagé », « inscrit » ou « payé ».

Ce format est une convention de Saison, pas une description du catalogue. Les apps Équipe, Voiture et Garage doivent l'émettre tel quel ; à confirmer avec leurs responsables lors de leur lot.

### Débrief (Saison)

`saison.debrief_saisi` : `{ entryId: uuid, eventId: uuid, auteurMembershipId: uuid }`. Émis à chaque écriture de débrief, en ligne comme hors ligne, une fois l'écriture validée par le serveur (crochet `apresApplication` de la synchro, `src/apps/saison/synchro-serveur.ts`). Le texte du débrief n'est pas dans l'événement : il est privé à l'équipage.

### Budget

Charges utiles des événements de Budget : voir `docs/schema-budget.md` (section Événements). Le mouvement à confirmer est une demande de la boîte d'actions : `{ type: "mouvement_a_confirmer", cleUnicite: "budget_suggestion:<id>", ficheType: "mouvement", ficheId, destinataires, boutons: [confirmer, ignorer], priorite: PRIORITE.mouvement_a_confirmer (4) }`.

## Vérifier

```bash
pnpm db:verifier-bus   # bus, livraisons, boîte d'actions, décision, levée, cloisonnement
pnpm test
```

## Liaisons Saison et Budget (tâche 2.7)

- `saison.engagement_paye` (Saison vers Budget) : Budget propose une dépense d'engagement. Charge utile lue : `{ entryId, eventId, montant_paye, payeurPersonId? }`. Une seule proposition en attente par `entryId`.
- `budget.depense_creee` (Budget vers Saison) : Saison demande « marquer payé » pour une dépense d'engagement. Charge utile : `{ depenseId, montant, date, categoryId, categorieCle, payerId, personneId, eventId, seasonId, entryId, origineRef }`. `categorieCle` vaut `engagement` pour la catégorie d'engagement ; `origineRef` vaut `saison:<entryId>` pour une proposition venant de Saison.
- Action `marquer_engagement_paye` (Saison) : `cleUnicite` `marquer_paye:<entryId>`, boutons `marquer_paye` et `ignorer`.
- Budget émet `budget.depense_creee` par `emettreDepenseCreee` (une seule source, en ligne comme en synchro). Une modification ou une suppression émet `budget.solde_modifie`.

## Liaisons du lot 3 (brief 3.8, §2 à §7)

Chaque liaison a une clé d'unicité : un événement rejoué deux fois ne crée ni proposition ni action en plus (`scripts/verifier-bus.ts`, section 13).

| Événement | Vers | Effet | Clé d'unicité | Charge lue |
|---|---|---|---|---|
| `partenaires.convention_signee` | Budget | une proposition de recette par versement (`partenaires:<agreementId>:<rang>`, datée du versement) | `origineRef` (dédoublonnage) | voir `chargeConventionSignee` (`src/apps/partenaires/charges.ts`) |
| `partenaires.convention_signee` | Voiture | action « Réserver » pour chaque contrepartie logo | `reserver:<benefitId>` | voir `chargeConventionSignee` |
| `partenaires.convention_terminee` | Voiture | action « Libérer » pour chaque occupation de logo | `liberer:<assignmentId>` | `agreementId`, `motif` (`terminee` ou `resiliee`), `slotIds` |
| `voiture.logo_pose` | Partenaires | action « Ajouter la photo de pose comme preuve » (avec photo), ou « Marquer le logo comme posé » (sans photo) | `preuve_pose:<assignmentId>` | `assignmentId`, `partenaireId`, `poseLe`, `photoFileId` |
| `voiture.emplacement_modifie` | Partenaires | renomme l'emplacement sur la contrepartie ; si l'emplacement n'existe plus, le lien est vidé, le nom passe à « (supprimé) » et une action « Compris » est proposée | `emplacement_supprime:<contrepartieId>` | `vehicleId`, `slotId` (sans `slotId`, rien ne se passe) |
| `saison.epreuve_terminee` | Partenaires | action « Publications promises après <épreuve> » pour chaque personne qui suit un partenaire ayant des publications sur l'épreuve | `publications:<eventId>:<personneId>` | `eventId`, `seasonId` |
| `saison.epreuve_terminee` | Voiture | aucun gestionnaire : l'historique est calculé à la lecture | — | — |
| `budget.recette_encaissee` | Partenaires | recalcule l'apport reçu de la convention (`non`, `partiel`, `oui`) | — | `origineRef` |
| `core.action_decidee` | Voiture, Partenaires | applique la décision (réserver, libérer, ajouter la preuve, publications reportées) | — | `type`, `cleUnicite`, `decision`, `ficheId` |

Précisions :

- `budget.recette_encaissee` porte `origineRef` (même valeur que la proposition d'origine). Partenaires ne réagit que si la valeur commence par `partenaires:`.
- L'action « Plus tard » des publications est reportée de 3 jours (`reporteeJusquAu`), puis revient en attente.
- Une publication sans personne qui suit le partenaire, ou dont la personne n'a pas d'adhésion active, ne donne pas d'action « Publications promises ». Une contrepartie déjà tenue n'est pas comptée.
- `saison.resultat_valide` et `saison.resultat_annule` sont listés dans le catalogue pour Partenaires, mais aucun gestionnaire n'existe dans le lot 3 : les lectures de la page partenaire et du bilan lisent les résultats à l'affichage. À reprendre si un gestionnaire devient nécessaire.

## Liaisons de Check-lists (tâche 5.7a)

| Événement | Écouté par | Effet | Clé d'unicité | Charge lue |
|---|---|---|---|---|
| `checklist.probleme_signale` | Garage | si le point est lié à un organe (`lienType` = `organe_garage`, `lienId` posé) : propose un ordre de travail (`garage.action_requise`, type `ordre_depuis_point`, boutons « Créer l'ordre » et « Ignorer ») ; rien n'est créé avant l'acceptation | `ordre_point:<pointId>` | `pointId`, `lienType`, `lienId`, `listeTitre`, `epreuveId` |
| `checklist.probleme_signale` | Check-lists (même appel, 5.8 §3.3) | si le point n'est pas lié à un organe : action `checklist.action_requise` de type `tache_probleme` (clé `tache_point:<pointId>`, priorité 7, responsables et personne affectée). Levée quand le point sort de problème ou est retiré ; la levée termine la tâche | — | — |
| `checklist.probleme_signale` | core (socle) | sinon, ouvre une tâche `core_task` (app `checklist`, fiche `point`, titre « Problème : <libellé> (<liste>) », assignée à `personneId` s'il existe). Une seule tâche à faire par point | — | `pointId`, `epreuveId`, `libelle`, `listeTitre`, `personneId`, `lienType`, `lienId` |
| `checklist.point_critique_ouvert` | Saison | aucun gestionnaire : Saison lit l'état des listes à l'affichage (panneau « Prêt pour l'épreuve ? », hors indice) | — | — |
| `checklist.avancement_change` | Saison | aucun gestionnaire : même lecture à l'affichage | — | — |
| `checklist.liste_terminee` | core | aucun gestionnaire : la notification aux responsables est reportée (pas de service de notification ni de lecture QG à ce jour) | — | — |
| `settings.membre_rejoint` | Check-lists | aucun effet : l'événement est au catalogue mais absent de 956 §5 | — | — |
| `core.action_decidee` (type `ordre_depuis_point`) | Garage | Accepter ouvre l'ordre de réparation sur l'organe (`creerOrdreDans`) ; Ignorer ne fait rien. Un organe disparu rouvre l'action avec son motif | `ordre_point:<pointId>` | `type`, `decision`, `cleUnicite`, `ficheId` |

Précisions :

- `probleme_signale` porte le point et son lien. Les champs `libelle`, `listeTitre`, `lienType`, `lienId`, `personneId` sont nullables ou absents : un événement émis avant 5.7a reste lisible, et le gestionnaire ignore ce qui manque.
- Le titre de l'ordre se construit depuis le nom de l'organe (« Problème signalé : <organe> »), jamais depuis le libellé du point.
- Action « point critique » (`checklist.action_requise`, type `point_critique`, clé `point_critique:<pointId>`) : un point critique à faire ou en problème, dans une liste à 7 jours ou moins de son échéance. Elle n'a pas de décision : son bouton « Ouvrir la liste » est un lien. Émise au changement du point, et à l'ouverture du QG pour rattraper l'approche de l'échéance (sans réémettre une action déjà en attente).
- Levées (`checklist.action_levee`, même `cleUnicite`) : `ordre_point:<pointId>` quand le problème disparaît ou que le point est retiré ; `point_critique:<pointId>` quand le point est fait, sans objet, ou retiré. Une levée n'est émise que s'il existe une action en attente.
- Types de boîte ajoutés (`src/core/actions/regroupement.ts`) : `ordre_depuis_point`, `point_critique`.
- Lectures partagées d'objets liés (pas d'événement) : chaque app propriétaire expose sa liste et sa lecture unitaire (`lectures-partagees.ts`). Un objet n'est visible que si son app est ouverte au membre (niveau autre que « aucun »).
- Lien d'un point : `lienType` et `lienId` sont écrits par Check-lists seul, dans sa table. Un lien ne coche jamais le point.
- Check-lists 0.5.0 : migration `20261101150000_core_catalogue` (seule la version change).

## Propositions des écoutes de Check-lists (tâche 5.7b)

Check-lists 0.6.0 : migration `20261102100000_core_catalogue` (seule la version change). Chaque écoute crée une `checklist_proposal` et son action (`checklist.action_requise`, boutons Accepter et Ignorer, pour les responsables). Accepter écrit dans Check-lists seulement ; Ignorer ne fait rien. La décision revient par `core.action_decidee` (`ficheType` `proposition`, `ficheId` = identifiant de la proposition).

| Événement | Effet à l'émission | Liste cible | Type de proposition | Effet à l'acceptation |
|---|---|---|---|---|
| `saison.epreuve_terminee` | une proposition par épreuve : liste retour pour chaque engagement qui n'en a pas, et la commune si elle manque | phase retour, par engagement ou commune de l'épreuve | `creer_liste_retour` | crée les listes depuis les modèles de phase retour |
| `saison.abandon_declare` | liste retour après abandon, pour cet engagement | phase retour de l'engagement | `creer_liste_retour` | idem |
| `saison.programme_publie` | aucune écoute (reporté) | — | — | — |
| `garage.piece_zone_rouge` | point critique « Remplacer la pièce : <organe> », lié à l'organe | avant départ de l'engagement du véhicule, prochaine épreuve | `ajouter_point` | ajoute le point, dans la première section |
| `garage.travail_termine` | cocher le point lié à l'organe de l'ordre (à faire ou en problème) | listes de l'engagement du véhicule, prochaine épreuve | `cocher_point` | coche le point, sauf s'il est fait ou sans objet |
| `voiture.logo_pose` | cocher le point lié à l'emplacement du logo (`lienId` = `slotId`, 5.7a) | idem | `cocher_point` | idem |
| `voiture.papier_expire_bientot` | point critique « Papier à renouveler : <papier> » | vérifications de l'engagement du véhicule, prochaine épreuve | `ajouter_point` | idem |
| `equipe.licence_expire_bientot` | point critique « Licence à renouveler : <licence> » | vérifications de l'engagement où la personne est pilote ou copilote ; sans un tel engagement, rien | `ajouter_point` | idem |
| `equipe.homologation_expire_bientot` | point critique « Homologation à renouveler : <équipement> » | idem | `ajouter_point` | idem |
| `documents.document_expire_bientot` | point critique « Document à renouveler : <titre> » | vérifications de la liste commune de la prochaine épreuve | `ajouter_point` | idem |
| `documents.reglement_publie` | une seule proposition par règlement | avant départ de la liste commune de la prochaine épreuve | `relire_liste` | point non critique « Relire le règlement : <titre> », lié au document |
| `partenaires.contrepartie_en_retard` | point critique « Contrepartie en retard : <libellé> » | avant départ de la liste commune de la prochaine épreuve | `ajouter_point` | idem |

Précisions :

- Épreuve visée : la prochaine épreuve où l'objet compte (pour un véhicule, la prochaine où il est engagé ; pour une personne, la prochaine où elle est pilote ou copilote ; pour la team, la prochaine épreuve non terminée). Pour `saison.epreuve_terminee` et `saison.abandon_declare`, l'épreuve qui vient de se terminer.
- Pas de liste cible, pas de proposition. Pas de repli sur la liste commune pour une licence ou une homologation, qui sont personnelles.
- Doublon : une proposition existante pour le même type, le même objet et la même liste bloque la suivante, quel que soit son statut (proposée, acceptée ou ignorée). Clé d'objet : `contenu.cle` (`epreuve:`, `engagement:`, `organe:`, `papier:`, `licence:`, `homologation:`, `document:`, `contrepartie:`, `point:`, `reglement:`).
- Action : clé d'unicité `proposition:<propositionId>`, groupe `propositions_<type>`. Le titre du point proposé se construit depuis le libellé de l'objet de l'autre app, jamais inventé.
- Un point proposé porte son type et l'identifiant de son objet : il affiche son état dès sa création (5.7a).
- Cocher ne coche jamais sans acceptation, et ne repasse pas un point fait ou sans objet.
- Types d'action ajoutés (`chargeActionRequise`) : `ajouter_point`, `cocher_point`, `creer_liste_retour`, `relire_liste`. Libellés de groupe dans `src/core/actions/regroupement.ts`.
- Lecture partagée ajoutée dans Garage : `organeDeOrdrePourChecklist` (l'organe d'un ordre), sans écriture.
- Variante après abandon : mêmes modèles de phase retour, pas de modèle spécial.
- Non écouté, avec motif : `saison.programme_publie` (Saison n'émet pas l'événement, et le type « caler les échéances » n'est pas dans 956 §3), `settings.membre_rejoint` (aucun effet, absent de 956 §5), `checklist.liste_terminee` (reporté : pas de service de notification dans le socle).

## Tâches du socle et actions « tache_ » (tâche 5.8, §3.2 et §3.3)

- `partenaires.relance_due` (ecoutePar `core`) : le gestionnaire de `src/core/taches/taches-serveur.ts` crée la tâche « Relancer <partenaire> », assignée à `suiviParPersonId` (charge), échéance = date de la relance. Une seule tâche à faire par partenaire. L'événement est émis une fois par partenaire et par date ; l'action de relance ne dépend pas de cette garde.
- `partenaires.action_requise` de type `tache_relance` (priorité 6, clé `tache_relance:<partnerId>:<date>`, destinataires : le suivi, sinon les responsables). Une action en attente, décidée ou expirée ne se repose pas. Levée au passage du QG quand la relance n'est plus due à cette date (date changée, statut sorti du suivi, partenaire retiré).
- `checklist.action_requise` de type `tache_probleme` : voir le tableau de Check-lists plus haut.
- Levée d'une action dont le type commence par `tache_` : le socle termine les tâches à faire de sa fiche (`src/core/actions/gestionnaires-serveur.ts`). Une action `point_critique` levée sur le même point ne touche pas à la tâche.
- Équipe n'émet aucun événement pour ses tâches d'affectation : création, retrait et statut passent par les fonctions de `src/core/taches/ecriture.ts`, dans la transaction de l'affectation (règle 6, pas d'événement inventé).
