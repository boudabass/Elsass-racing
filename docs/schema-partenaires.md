# Partenaires : schéma, règles et services (tâche 3.5)

Schéma, règles pures et services de Partenaires, sans écran (les écrans viennent en 3.6, la page partenaire et les bilans en 3.7, les liaisons avec Budget et Voiture en 3.8). Spécification : article Odoo 951 (Partenaires v1.3). Modèle de convention : article 968, copie dans `docs/modele-convention.md`.

## Décisions d'architecture

- **L'entreprise est un `core_contact`**, avec la catégorie `partenaire` (déjà présente dans `CoreContactCategorie`). **L'interlocuteur est une `core_person`** rattachée au contact par `core_person.contact_id` (déjà présent). Créer un prospect crée les deux s'ils n'existent pas.
- **Jeton de la page partenaire stocké sous forme d'empreinte** (sha256), jamais en clair. L'empreinte est unique sur toute la base (`partenaires_portal_link.jeton_empreinte`), parce que la page publique (3.7) la cherchera sans contexte de team. Le lien n'est montré qu'à sa création ou à son renouvellement.
- **Modèle de convention par défaut dans le code** (`src/apps/partenaires/modele-defaut.ts`, version 1, texte de `docs/modele-convention.md`). Chaque team en reçoit une copie dans `partenaires_template` à sa première lecture (`source_cle = 'defaut_v1'`). La team peut la modifier.
- **Liste de base des contreparties** (spécification, section 5) : créée à la volée dans `partenaires_benefit_catalog`, même principe (`source_cle`).
- **Pas de clé étrangère vers Voiture ni vers Budget.** `partenaires_benefit.slot_id` est un uuid sans relation, avec une copie du nom (`slot_nom`). Voiture a la réciproque : `voiture_slot_assignment.partenaire_id` est un uuid sans relation.
- **Statut de la convention** : `brouillon` → `envoyee` → `signee` à la main ; `signee` → `en_cours` le jour de `date_debut` ; `en_cours` → `terminee` le lendemain de `date_fin` ; `signee` ou `en_cours` → `resiliee` à la main, avec un motif. Les deux passages automatiques se font au recalcul de l'ouverture du QG (`src/apps/recalculs-qg.ts`).

## Tables

Onze tables, préfixe `partenaires_`, bloc commun (`team_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `rev`), index `team_id` et `(team_id, deleted_at)`, RLS forcée `cloisonnement_team`. Migration `20261018144918_partenaires_schema`.

| Table | Rôle |
|---|---|
| `partenaires_partner` | Fiche d'un partenaire : `contact_id` (entreprise), interlocuteur, fonction de l'interlocuteur (`interlocuteur_qualite`, facultatif), `statut` (`PartenairesStatut`), `source`, suivi, prochaine relance, logo, secteur, notes. Un seul partenaire par entreprise parmi les lignes non supprimées (index partiel). |
| `partenaires_interaction` | Échange (appel, mail, rencontre, courrier, autre), avec une prochaine action datée. |
| `partenaires_template` | Modèle de convention : nom, texte (avec champs `{{…}}`), `version`, `actif`, `source_cle`. |
| `partenaires_agreement` | Convention : partenaire, modèle, saison, dates de début et de fin (jours), statut, `precedente_id` (renouvellement), apport financier et apport en nature (centimes), échéancier (JSON), apport reçu, documents, signature, motif de résiliation. |
| `partenaires_amendment` | Avenant : numéro unique par convention, date, motif, changements, document, date de signature. |
| `partenaires_benefit_catalog` | Liste de base des contreparties : nom, type, unité, quantité par défaut, `source_cle`. |
| `partenaires_benefit` | Contrepartie promise : libellé, type, quantité promise et tenue, `slot_id` et `slot_nom` (sans clé étrangère), épreuves (`event_ids`), échéance, statut. |
| `partenaires_proof` | Preuve d'une contrepartie : fichier ou lien, épreuve facultative, commentaire, visible ou non sur la page partenaire. |
| `partenaires_report` | Bilan généré ou envoyé, sur une période. |
| `partenaires_portal_link` | Lien de la page partenaire : empreinte du jeton, actif, expiration, consultations, sections visibles. |
| `partenaires_portal_message` | Message écrit depuis la page partenaire (2 000 caractères au plus), lu et traité. |

Enums : `PartenairesStatut`, `PartenairesSource`, `PartenairesInteractionType`, `PartenairesAgreementStatut`, `PartenairesApportRecu`, `PartenairesBenefitType`, `PartenairesBenefitStatut`, `PartenairesProofType`.

Les dates sans heure sont en `@db.Date` lorsque la spécification le demande (`prochaine_relance`, dates d'interaction, dates de convention, échéance de contrepartie). Les autres dates sont en `Timestamptz(3)`, selon `docs/conventions-schema.md`. Les montants sont des entiers en centimes, avec `devise` (« EUR » par défaut).

## Contraintes écrites à la main (migration)

- `partenaires_agreement` : apports ≥ 0 ; `date_fin >= date_debut`.
- `partenaires_benefit` : `quantite_tenue >= 0`.
- `partenaires_proof` : un fichier ou un lien (`file_id IS NOT NULL OR lien IS NOT NULL`).
- `partenaires_portal_message` : `char_length(texte) <= 2000`.
- `partenaires_partner` : un partenaire par `(team_id, contact_id)` parmi les lignes non supprimées (index unique partiel).
- `partenaires_portal_link` : un seul lien actif par partenaire (index unique partiel sur `actif` et `deleted_at`).
- `partenaires_portal_link.jeton_empreinte` : unique sur toute la base.
- `partenaires_amendment` : `(agreement_id, numero)` unique, avec `@@unique` Prisma.

## Points à connaître

- Le CHECK de `partenaires_proof` interdit une preuve sans fichier ni lien. Si un `core_file` est supprimé en dur alors qu'il sert de preuve, la mise à null par `ON DELETE SET NULL` échoue. Les fichiers de l'app sont supprimés en douceur ; à surveiller si une suppression en dur est ajoutée.
- L'échéancier (JSON) n'est pas contrôlé par la base : les montants qu'il contient sont vérifiés par les services.
- Les tests de conventions (`src/core/schema-conventions.test.ts`) vérifient le bloc commun, le nom des onze tables et les trois colonnes de `core_team`. Les RLS sont vérifiées par `pnpm db:verifier-rls`.

## Écrans (tâche 3.6)

- Routes sous `src/app/(app)/apps/partenaires/` : Prospection (`/`), `nouveau`, fiche `[id]` (onglets Fiche, Échanges, Conventions, Page partenaire, Messages), `[id]/conventions/nouvelle`, `conventions/[id]` (onglets Contreparties, Document, Avenants, Historique), `contreparties`, `modeles` et `modeles/[id]`.
- Accès : `accesEcran` (`src/apps/partenaires/ecran.ts`). Prospection, fiches et conventions au niveau écriture ; Page partenaire, Modèles et actions de signature, résiliation et avenant au niveau gestion.
- Écritures : `src/apps/partenaires/actions.ts`, une enveloppe par fonction gardée des services. Aucune fonction `…Dans` n'est exportée. Le jeton de la page partenaire n'est renvoyé qu'à la création ou au renouvellement, et seule son empreinte est stockée.
- Choix d'un emplacement : `listerEmplacementsPourPartenaires` (Voiture, lecture partagée) : statut libre, réservé, occupé ou indisponible, affiché à côté du choix.
- Vue en colonnes de la Prospection : à partir de `lg` seulement, sans glisser-déposer ; le statut se change par le menu « Changer le statut » de chaque carte.
- Champs connus vides : `remplirModele` renvoie aussi `vides`. Les champs `lieu` et `date` sont remplis à la main à la signature et ne comptent pas. L'encadré « champs à compléter » de la fiche convention liste les autres, avec leur lieu de saisie (Réglages, rubrique Association, ou la fiche du partenaire).

## Génération du PDF de la convention

- `genererDocumentPdf` (`src/apps/partenaires/document-serveur.ts`) : lit le texte du modèle rempli (`genererDocumentDans`), le découpe avec `blocsDuTexte` (`document.ts`, fonction pure), puis rend `ConventionPdf` (`pdf/convention-pdf.tsx`) avec `DocumentTeam` (3.1b).
- Mise en page : titres d'articles en intertitres, paragraphes, puces pour les contreparties, zone de signature à deux colonnes (« Pour l'association », « Pour le partenaire ») avec « Lu et approuvé ».
- Le PDF est enregistré comme fichier de la team (`enregistrerFichier`), rattaché à la convention avec le rôle `document` (`rattacherFichier`), et devient `document_genere_file_id`. Une nouvelle génération remplace l'ancien fichier (`remplacerFichier`). Téléchargement par `/api/fichiers/<id>`.
- Le texte, pas le PDF, est testé en unitaire : `document.test.ts` vérifie la suite des blocs, le modèle par défaut (onze intertitres, signature en fin) et la lettre « mille cinq cents euros ».

## Page partenaire, bilans et messages (tâche 3.7)

- Migration `20261018163000_partenaires_lien_public` : fonction `partenaires_lien_par_empreinte(empreinte text)`, `SECURITY DEFINER`, `SET search_path = public`, `REVOKE ALL … FROM PUBLIC`, `GRANT EXECUTE … TO elsass_racing_app`. Elle renvoie `lien_id, team_id, partner_id, sections` pour un lien actif, non supprimé, non expiré, dont le partenaire existe. Même patron que `core_invitation_en_attente`. Elle ne lit aucune autre table.
- Lien : `partenaires_portal_link` garde `jeton_empreinte` (SHA-256 du jeton), `actif`, `expire_le`, `sections` (les six sections par défaut), `nb_consultations` et `derniere_consultation`. Chaque affichage met la date à l'instant ; le compte monte d'un au plus toutes les 30 minutes (`enregistrerConsultation`).
- Pages publiques : `src/apps/partenaires/page-publique-serveur.ts` (`lirePagePartenaire`, `lireFichierDuLien`), route `src/app/p/[jeton]/page.tsx`, fichiers `src/app/p/[jeton]/fichiers/[id]/route.ts`. Un fichier n'est servi que s'il est logo, document signé d'une convention affichée, preuve visible, ou bilan du lien.
- Bilans : `partenaires_report` (période en jours civils, `agreement_id` facultatif, `file_id`, `genere_le`, `envoye_le` en date). Le PDF est un fichier de la team, rattaché à la fiche `report` (app `partenaires`, rôle `document`). Services : `src/apps/partenaires/bilan-serveur.ts` (`genererBilan`, `marquerBilanEnvoye`, `lireBilansDe`). Données pures : `bilan.ts` (`construireBilan`), PDF : `pdf/bilan-partenaire.tsx`.
- Messages : `partenaires_portal_message` (nom au plus 100, texte au plus 2 000, date, lu, traité). Écrit par `envoyerMessagePartenaireAction` (`src/apps/partenaires/actions-public.ts`), dans le contexte public du lien. Lu et traité par la team, comme les autres messages. L'alerte `partenaires.action_requise` n'est pas émise (voir `docs/securite-page-partenaire.md`).
- Lectures partagées ajoutées à Saison : `listerCalendrierPourPartenaires` et `listerResultatsPublicsPourPartenaires` (`src/apps/saison/lectures-partagees.ts`). Les résultats ne sont lus que publics et validés.
- Accès : onglet Bilans au niveau écriture ; page partenaire au niveau gestion (inchangé).

## Liaisons du lot 3 (brief 3.8, §2 à §7)

- **Apport reçu** : `partenaires_agreement.apport_recu` (`non`, `partiel`, `oui`) est recalculé à chaque recette encaissée (`apportRecuDe`, `src/apps/partenaires/regles.ts`) : `oui` si l'encaissé atteint l'apport attendu, `partiel` s'il y a un encaissement, `non` sinon. Affiché sur la convention et la fiche (« Apport non reçu », « Apport partiel », « Apport reçu »).
- **Preuve de pose** : une photo de pose devient une preuve de type `photo`, visible par le partenaire. Le fichier est rattaché à l'occupation de Voiture par `rattacherDepuisSource` : le rattachement n'est accepté que si le fichier est déjà rattaché à la fiche d'origine, dans la même team. Le rôle utilisé est `photo` ; `CoreAttachmentRole` n'a pas de rôle `logo`.
- **Publications** : une contrepartie `publication_reseaux` porte la liste des épreuves (`eventIds`). Quand une de ces épreuves se termine, les personnes qui suivent le partenaire reçoivent l'action « Publications promises » (une par personne et par épreuve).
- **Emplacement modifié ou supprimé** : le nom de l'emplacement de la contrepartie suit le nom de l'emplacement de Voiture. Un emplacement supprimé vide le lien (`slotId` nul), met « (supprimé) » au nom et propose une action « Compris ».
- Le détail des charges et des clés d'unicité est dans `docs/evenements.md`, section « Liaisons du lot 3 ».

## Fonction de l'interlocuteur et convention (brief 3.9, §4)

- Migration `20261018190000_partenaires_interlocuteur_qualite` (additive) : `partenaires_partner` gagne `interlocuteur_qualite` (TEXT, facultatif, jusqu'à 80 caractères). Par exemple « Gérant ».
- Écrite par `modifierInterlocuteurQualite` (`src/apps/partenaires/services-serveur.ts`, action `modifierInterlocuteurQualiteAction`). Elle exige un interlocuteur : sans nom, le service refuse.
- Fiche du partenaire : champ « Fonction de l'interlocuteur » sous la ligne « Interlocuteur ».
- Convention : le champ `partenaire.representant` affiche « Prénom Nom, Fonction » quand la fonction existe. Sans fonction, `partenaire.qualite` rejoint les champs vides : la page de la convention affiche « 1 champ à compléter » avec « la fonction de l'interlocuteur du partenaire », avant la génération du document.
- `e2e/lot3-parcours.spec.ts`, étape 3 : le champ manquant est signalé, la fonction « Gérant » est saisie sur la fiche, puis le document est généré sans champ à compléter. Capture `lot3-fiche-qualite-1440x900.png`. `convention-exemple.pdf` est régénéré. Le texte du PDF n'a pas été relu à l'image (pas d'outil de rendu PDF sur le poste) : la présence de la fonction est vérifiée par le contrôle de champs de l'e2e et par le code de la convention.
