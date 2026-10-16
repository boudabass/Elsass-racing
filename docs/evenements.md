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

`choisirProchaineEtape` (`src/core/actions/prochaine-etape.ts`), règles de l'article 960, section 5 :

1. Les actions proposées sont celles du membre, non reportées, et en mode terrain seulement les actions `terrain`.
2. Tri : priorité croissante (1 à 9), puis échéance la plus proche (sans échéance en dernier), puis ancienneté.
3. À moins de 48 heures de l'épreuve (et pas plus de 24 heures passées), les priorités 1 puis 7 passent devant tout le reste.
4. La ligne « pourquoi » vient d'une table par priorité (`pourquoi`).
5. Sans action : compte à rebours « J-n <épreuve> » (« Aujourd'hui <épreuve> » le jour même), sinon rien.

## Vérifier

```bash
pnpm db:verifier-bus   # bus, livraisons, boîte d'actions, décision, levée, cloisonnement
pnpm test
```
