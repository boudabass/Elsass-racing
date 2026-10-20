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
  boutons: { cle: string, libelle: string }[],                    // de 1 à 4
  priorite: 1..9,
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
4. La ligne « pourquoi » vient d'une table par priorité (`pourquoi`).
5. Sans action : compte à rebours « J-n <épreuve> » (« Aujourd'hui <épreuve> » le jour même), sinon rien.

## Charges utiles

Chaque événement porte un objet `donnees`. Les champs non décrits ici ne sont pas lus. Une charge utile invalide est ignorée par le gestionnaire, sans erreur.

### Préparation de l'épreuve (Saison)

Quatre événements disent qu'un point de préparation d'une épreuve à venir est en retard. Saison les écoute (`enregistrerGestionnaire`, `src/apps/saison/services-serveur.ts`) et tient une ligne par engagement et par point.

| Événement | Émis par | Point de préparation |
|---|---|---|
| `equipe.licence_expire_bientot` | Équipe | `licences` |
| `equipe.homologation_expire_bientot` | Équipe | `homologations` |
| `voiture.papier_expire_bientot` | Voiture | `papiers` |
| `garage.piece_zone_rouge` | Garage | `pieces` |

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

Charges utiles des événements de Budget : voir `docs/schema-budget.md` (section Événements). Le mouvement à confirmer est une demande de la boîte d'actions : `{ type: "mouvement_a_confirmer", cleUnicite: "budget_suggestion:<id>", ficheType: "mouvement", ficheId, destinataires, boutons: [confirmer, ignorer], priorite: 5 }`.

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
