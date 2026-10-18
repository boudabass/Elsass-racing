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
| `partenaires_partner` | Fiche d'un partenaire : `contact_id` (entreprise), interlocuteur, `statut` (`PartenairesStatut`), `source`, suivi, prochaine relance, logo, secteur, notes. Un seul partenaire par entreprise parmi les lignes non supprimées (index partiel). |
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
