# Voiture : schéma, gabarits et services (tâche 3.2)

Schéma, gabarits, règles pures et services de Voiture, sans écran (les écrans viennent en 3.3, le plan de déco en 3.4). Spécification : article Odoo 952 (Voiture v1.3), découpage `docs/plan-developpement.md` section 5 ter, brief `docs/briefs/3.2-voiture-schema-services.md`. Modèle : Budget (`docs/schema-budget.md`).

## Décisions d'architecture

- **Gabarits dans le code, pas en base.** Un gabarit est un catalogue de la plateforme, sans team, comme le catalogue des apps. Il vit dans `src/apps/voiture/gabarits/`, un fichier par gabarit. `voiture_vehicle.gabarit_cle` le désigne par sa clé. La table `voiture_template` de la spécification n'est pas créée.
- **Un seul gabarit au lot 3 : la Saxo** (décision de John du 18/10). Clé `citadine_3p_saxo`, nom « Citadine 3 portes (Saxo) ».
- **Vues de la Saxo** : le plan ne montre que le profil droit. Le gabarit déclare la vue `droite`, et la vue `gauche` qui en est le miroir (`vuesDessinees`, `miroirDe`). Les vues `avant`, `arriere` et `dessus` n'existent pas encore. Les emplacements qui s'y trouveraient sont en vue `hors_plan` : ils ont un nom, mais pas de forme.
- **Pas de clé étrangère vers une autre app.** `voiture_slot_assignment` garde `partenaire_id` (uuid, sans relation) et `partenaire_nom`, une copie du nom. Partenaires n'existe pas encore.
- **Historique et kilomètres calculés, pas stockés.** Pas d'écoute de `saison.epreuve_terminee` : l'historique se lit à la demande.

## Tables

Sept tables, préfixe `voiture_`, bloc commun (`team_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `rev`), RLS `cloisonnement_team` forcé. Migration `20261018123759_voiture_schema`, purement additive : aucune table existante n'est modifiée (seules des relations inverses sont ajoutées côté Prisma sur `core_team`, `core_vehicle`, `core_event`, `core_event_entry` et `core_file`).

| Table | Rôle |
|---|---|
| `voiture_vehicle` | Fiche technique d'un `core_vehicle` (1 pour 1, `vehicle_id` unique). Gabarit, marque, modèle, puissance, immatriculation, groupe, classe, discipline, date d'achat. Les photos passent par `core_attachment` (rôle `photo`). |
| `voiture_paper` | Papier du véhicule. `type` (enum), `libelle` obligatoire si `autre`, échéance facultative, document rattaché par `core_file`. Pas de statut stocké : il se calcule. |
| `voiture_slot` | Emplacement de logo. `vue`, `nom`, `ordre`, `forme` (JSON, coordonnées du gabarit), dimensions facultatives, `statut`, `symetrique`. |
| `voiture_slot_assignment` | Occupation d'un emplacement : partenaire (uuid et nom), logo, période, statut (`reserve`, `pose`, `retire`), photo de pose. |
| `voiture_setup` | Fiche de réglage : épreuve et engagement facultatifs, date, conditions, revêtement, `valeurs` (JSON), remarques, note 1 à 5. |
| `voiture_setup_template` | Modèle de réglage, éventuellement créé depuis une fiche (`cree_depuis_setup_id`). |
| `voiture_team_pref` | Préférences de la team : `champs_reglage_masques` (tableau de texte). Une ligne par team. |

Les dates sans heure (`delivre_le`, `valable_jusqu_au`, `du`, `au`, `pose_le`, `date`) sont en `@db.Date`, selon `docs/conventions-schema.md`. `achete_le` est en `Timestamptz`, comme la spécification le demande.

## Contraintes écrites à la main (migration)

- `voiture_setup.note` entre 1 et 5 (CHECK, `NULL` autorisé).
- `voiture_paper` : `libelle` non vide quand `type = 'autre'`.
- `voiture_slot_assignment` : un seul enregistrement actif par emplacement, par index unique partiel `WHERE statut <> 'retire' AND deleted_at IS NULL`.

## Gabarits (`src/apps/voiture/gabarits/`)

- `types.ts` : `Gabarit`, `ElementDessin` (`path`, `circle`, `line`, avec un rôle de couleur : `caisse`, `vitre`, `roue`, `jante`, `detail`, `sol`), `EmplacementType`, `FormeEmplacement`, `VueGabarit`.
- `saxo.ts` : le gabarit de la Saxo, transcrit du plan du dossier Koehling (`travail/saxo_plan_emplacements.svg`, hors du dépôt). Les métadonnées, les pastilles, les zones pointillées et la légende ne sont pas reprises. Les couleurs deviennent des rôles : la 3.4 les associera au thème.
- `index.ts` : `GABARITS` et `gabarit(cle)`.
- `gabarits.test.ts` : clés uniques, formes présentes pour les vues dessinées, aucune forme hors plan, ordres de la légende.

## Règles pures (`src/apps/voiture/regles.ts`, testées dans `regles.test.ts`)

- **Papiers** : `statutPapier(valableJusquAu, maintenant)` renvoie `valide` (sans échéance, ou à plus de 30 jours), `a_renouveler` (30 jours ou moins, jour de l'échéance compris) ou `expire` (échéance passée). Les jours se comptent à Paris. `etatPapiers` donne le pire statut d'un véhicule.
- **Emplacements** : `emplacementsDepuisGabarit` crée les emplacements d'un véhicule ; un emplacement symétrique est recopié dans la vue miroir. `statutEmplacement` déduit `libre`, `reserve` ou `occupe` de l'occupation active ; `indisponible` est posé à la main. `verifierTransitionOccupation` n'autorise que réservé vers posé ou retiré, et posé vers retiré.
- **Fiches de réglage** : `CHAMPS_REGLAGE` (vingt-deux champs, dix essentiels et douze avancés), `validerValeurs` (clé inconnue refusée, pression de 0,5 à 4 bar), `preremplir` (référence, sinon dernière fiche, sinon vide), `comparer` (deux fiches, champ par champ).

## Services (`src/apps/voiture/services-serveur.ts`)

Même forme que Budget : chaque fonction publique passe par `accesVoiture(niveau)`, et les fonctions `…Dans(ctx, …)` font le travail sans garde (vérifications de bus, scripts). Erreurs : `ErreurVoiture`, héritée de `ErreurMetier`.

| Fonction | Niveau | Événement émis |
|---|---|---|
| `creerVehicule` | écriture | `voiture.emplacement_modifie`, une fois |
| `modifierFiche` | écriture | `voiture.fiche_modifiee` |
| `ficheVoiture` | écriture | aucun (crée la ligne `voiture_vehicle` à la volée) |
| `creerPapier`, `modifierPapier`, `supprimerPapier` | écriture | `voiture.action_levee` à la modification ou à la suppression |
| `ajouterEmplacement`, `modifierEmplacement`, `supprimerEmplacement`, `marquerIndisponible` | écriture | `voiture.emplacement_modifie` |
| `reserverEmplacement` | écriture | `voiture.emplacement_modifie` |
| `poserLogo` | écriture | `voiture.logo_pose` et `voiture.emplacement_modifie` |
| `retirerLogo` | écriture | `voiture.emplacement_modifie` |
| `creerReglage`, `modifierReglage` | contribution (ses propres fiches seulement) | aucun |
| `supprimerReglage`, `enregistrerCommeReference` | écriture | aucun |
| `masquerChamps` | gestion | aucun |
| `valeursDeDepart` | contribution | aucun |
| `recalculerPourQg` | selon le niveau sur Voiture | `voiture.papier_expire_bientot` et `voiture.action_requise` |

Charges utiles validées par zod dans `src/apps/voiture/charges.ts`. Les noms viennent du catalogue (`src/core/evenements/catalogue.ts`), jamais écrits ailleurs.

## Échéances des papiers (recalcul au QG)

`src/apps/recalculs-qg.ts` est la couche de composition : la page du QG n'appelle plus que `recalculerQg`, qui lance le recalcul de Saison puis celui de Voiture. Chaque app isole ses erreurs.

Pour un papier `a_renouveler`, Voiture émet `voiture.papier_expire_bientot` puis `voiture.action_requise` (titre « Renouveler <type> : <véhicule>, expire le JJ/MM/AAAA », destinataires : les responsables). Une seule fois par papier et par échéance : le recalcul vérifie d'abord l'événement déjà émis, en base. Un papier déjà expiré n'entre pas dans ce rappel. Un papier sans échéance n'émet rien. Le bouton « Vu » ferme la notification ; Voiture n'écoute encore aucun événement, donc il ne modifie rien d'autre.

## Lectures (`src/apps/voiture/lectures-serveur.ts`)

- `listerVehicules` : nom, type, photo (rattachement `photo` de l'app `voiture`), groupe, classe, état des papiers.
- `lireVehicule` : la fiche, les papiers avec leur statut, les emplacements avec leur occupation active.
- `historiqueVehicule` : les résultats validés et les kilomètres de spéciale, lus par la fonction partagée de Saison `lireResultatsValidesParVehicule` (`src/apps/saison/lectures-partagees.ts`). Voiture ne lit jamais une table `saison_`.
- `lireReglages`, `lireReglage` : fiches et références, avec les champs et leurs valeurs.

## Vérifications

- `src/core/schema-conventions.test.ts` : les sept tables respectent le bloc commun et `@@index([teamId])`.
- Dérive : `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` renvoie une migration vide.
- `pnpm db:verifier-rls` : RLS forcée, politique et droits sur les sept tables ; cloisonnement en lecture, modification et création.
- `pnpm db:verifier-bus` : création d'un véhicule (un événement), pose d'un logo, rappel de papier une seule fois après deux ouvertures du QG, rien pour un papier sans échéance.

## Plan de déco (tâche 3.4)

Le plan remplace la liste de l'onglet Déco. Il est lu par `lireVehicule` et dessiné côté client ; les règles de géométrie sont pures et testées (`src/apps/voiture/plan.ts`, `plan.test.ts`).

- **Rendu.** Le plan est un `<svg>` au `viewBox` du gabarit, sans aucun texte : les noms sont dans la liste sous le plan. Les éléments de `gabarit.dessin` sont rendus en React, avec un style par rôle (`STYLE_ROLE` dans `plan-vehicule.tsx`). Les couleurs sont des variables du thème, donc le plan suit le thème clair et le thème sombre.
- **Rôles de couleur.** `caisse` : `--surface-2` avec contour `--bordure`. `vitre` : un ton entre `--surface` et `--bordure`. `roue` : `--fond`, contour `--texte-discret`. `jante` : `--texte-discret`. `detail` : contour `--bordure` ; le trait épais (filet, épaisseur 4 et plus) prend `--marque`, la couleur de la team. `sol` : `--bordure`. `--texte-doux` n'existe pas dans le thème : la jante prend `--texte-discret`.
- **Miroir.** La vue gauche est le dessin de la vue droite retourné autour de l'axe vertical du viewBox : `<g transform="translate(L 0) scale(-1 1)">` avec `L = x minimal + largeur`. Les formes des emplacements symétriques ne passent pas par ce `<g>` : elles sont recalculées en coordonnées d'affichage (`miroirDeForme`), pour que le logo (`<image>`) et son découpage ne soient jamais retournés. Un emplacement n'a qu'une forme, stockée à droite ; la vue gauche la calcule.
- **Emplacements dessinés.** Vue droite : les emplacements `vue = droite` avec une forme (six pour la Saxo). Vue gauche : ceux qui sont `symetrique` (cinq pour la Saxo ; le bandeau de pare-brise ne l'est pas). Les hors plan (capot, hayon, lunette, toit) n'ont pas de forme : ils sont dans la liste, sous « Autres emplacements ».
- **Statut à trois lectures.** Libre : fond transparent, contour pointillé `--marque`. Réservé : fond `--marque` à 15 %, contour plein. Occupé : fond `--texte` à 20 % sans logo, ou le logo du partenaire (`<image href="/api/fichiers/<id>">`, `preserveAspectRatio="xMidYMid meet"`, découpé à la forme pour un polygone). Indisponible : hachures (`<pattern>`), contour gris. Le libellé écrit du statut est dans le nom accessible et dans la liste.
- **Logo sur une réservation.** Le logo s'affiche dès la réservation, et reste après la pose : la fiche le montre dans les deux cas.
- **Édition.** Le mode « Déplacer ou redimensionner » ne fonctionne que côté droit : la forme stockée est celle du gabarit. Glisser au pointeur (`setPointerCapture`), poignée carrée de 12 unités au coin bas-droit, polygone déplacé d'un bloc. Clavier : flèches sur la forme choisie (1 unité, 10 avec Maj), champs X, Y, Largeur, Hauteur dans le panneau. Limites : le viewBox, et 8 unités de côté minimum (contrôlé aussi par le schéma serveur, `schemaForme`).
- **Services.** `modifierEmplacementDans` accepte `symetrique` (seulement pour la vue droite). `reserverEmplacementDans` rattache le logo, et `poserLogoDans` la photo de pose, à l'occupation : app `voiture`, fiche `slot_assignment`, rôle `photo`.
- **Lecture seule.** Sous le niveau écriture, la liste et le plan restent, sans aucun bouton d'action ni champ d'édition.

## Liaisons avec Partenaires (brief 3.8, §2 à §5)

- **Réservation** : une convention signée avec une contrepartie logo propose « Réserver <emplacement> pour <partenaire> ? » (`cleUnicite` `reserver:<benefitId>`). Décider « Réserver » appelle `reserverEmplacementDans` avec la source du logo : le fichier éventuel est rattaché comme dans le reste de Partenaires.
- **Libération** : une convention terminée ou résiliée propose « Libérer <emplacement> ? » (`cleUnicite` `liberer:<assignmentId>`). Décider « Libérer » appelle `retirerLogoDans`.
- **Pose** : `voiture.logo_pose` porte `partenaireId`, `poseLe` et `photoFileId`. Avec une photo, Partenaires propose de l'ajouter comme preuve.
- **Emplacement modifié** : `voiture.emplacement_modifie` porte `vehicleId` et `slotId`. Partenaires relit le nom de l'emplacement, ou signale sa suppression.
- Partenaires lit Voiture par les lectures partagées `listerEmplacementsPourPartenaires` et `lireOccupationPourPartenaires` (`src/apps/voiture/lectures-partagees.ts`), et n'écrit jamais dans ses tables. Le test `src/apps/cloisonnement-ecritures.test.ts` le vérifie.
