-- Check-lists (tâche 5.5a) : les huit tables de l'article 956 §3, en suivant docs/schema-checklist.md.
-- Écrite à la main (pas de Docker sur le poste), sur le modèle de equipe_schema.
-- Exceptions au bloc commun : checklist_template, checklist_template_section et checklist_template_item portent un team_id
-- vide pour les modèles fournis par la plateforme (Q2). checklist_check_log est en ajout seul (Q8).

-- CreateEnum
CREATE TYPE "checklist_portee" AS ENUM ('engagement', 'epreuve');
CREATE TYPE "checklist_phase" AS ENUM ('avant_depart', 'verifications', 'reconnaissances', 'epreuve', 'retour');
CREATE TYPE "checklist_discipline" AS ENUM ('rallye', 'course_de_cote', 'slalom', 'circuit');
CREATE TYPE "checklist_role_suggere" AS ENUM ('equipage', 'assistance');
CREATE TYPE "checklist_type_lien" AS ENUM ('aucun', 'organe_garage', 'train_pneus', 'papier_voiture', 'logo_voiture', 'licence_equipe', 'homologation_equipe', 'contrepartie_partenaires', 'document_documents');
CREATE TYPE "checklist_echeance_relative" AS ENUM ('j_moins_7', 'j_moins_1', 'jour_j');
CREATE TYPE "checklist_statut_point" AS ENUM ('a_faire', 'fait', 'sans_objet', 'probleme');
CREATE TYPE "checklist_statut_liste" AS ENUM ('a_faire', 'en_cours', 'terminee');
CREATE TYPE "checklist_zone" AS ENUM ('vert', 'orange');
CREATE TYPE "checklist_type_proposition" AS ENUM ('creer_listes', 'ajouter_point', 'cocher_point', 'creer_liste_retour', 'relire_liste');
CREATE TYPE "checklist_statut_proposition" AS ENUM ('proposee', 'acceptee', 'ignoree');

-- CreateTable : modèle de liste (team_id vide = fourni par la plateforme)
CREATE TABLE "checklist_template" (
    "id" UUID NOT NULL,
    "team_id" UUID,
    "nom" TEXT NOT NULL,
    "icone" TEXT,
    "portee" "checklist_portee" NOT NULL,
    "phase" "checklist_phase",
    "discipline" "checklist_discipline",
    "fourni" BOOLEAN NOT NULL DEFAULT false,
    "modele_origine_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklist_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable : section d'un modèle (team_id recopié du modèle)
CREATE TABLE "checklist_template_section" (
    "id" UUID NOT NULL,
    "team_id" UUID,
    "modele_id" UUID NOT NULL,
    "titre" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklist_template_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable : point d'un modèle (team_id recopié de la section)
CREATE TABLE "checklist_template_item" (
    "id" UUID NOT NULL,
    "team_id" UUID,
    "section_id" UUID NOT NULL,
    "libelle" TEXT NOT NULL,
    "aide" TEXT,
    "critique" BOOLEAN NOT NULL DEFAULT false,
    "role_suggere" "checklist_role_suggere",
    "lien_type" "checklist_type_lien" NOT NULL DEFAULT 'aucun',
    "echeance_relative" "checklist_echeance_relative",
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklist_template_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable : liste réelle d'une épreuve (engagement vide = liste commune)
CREATE TABLE "checklist_list" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "epreuve_id" UUID NOT NULL,
    "engagement_id" UUID,
    "vehicule_id" UUID,
    "modele_source_id" UUID,
    "titre" TEXT NOT NULL,
    "phase" "checklist_phase" NOT NULL,
    "echeance" DATE,
    "statut" "checklist_statut_liste" NOT NULL DEFAULT 'a_faire',
    "avancement" INTEGER NOT NULL DEFAULT 0,
    "zone" "checklist_zone" NOT NULL DEFAULT 'orange',
    "ouverte_assistance" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklist_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable : section d'une liste
CREATE TABLE "checklist_section" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "liste_id" UUID NOT NULL,
    "titre" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklist_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable : point d'une liste (lien_id : lecture seule, sans clé étrangère)
CREATE TABLE "checklist_item" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "libelle" TEXT NOT NULL,
    "critique" BOOLEAN NOT NULL DEFAULT false,
    "personne_id" UUID,
    "statut" "checklist_statut_point" NOT NULL DEFAULT 'a_faire',
    "coche_par_id" UUID,
    "coche_le" TIMESTAMPTZ(3),
    "note" TEXT,
    "lien_type" "checklist_type_lien" NOT NULL DEFAULT 'aucun',
    "lien_id" UUID,
    "point_modele_origine_id" UUID,
    "ajoute_pendant_epreuve" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklist_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable : historique des coches (ajout seul, voir plus bas)
CREATE TABLE "checklist_check_log" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "point_id" UUID NOT NULL,
    "ancien_statut" "checklist_statut_point" NOT NULL,
    "nouveau_statut" "checklist_statut_point" NOT NULL,
    "par_id" UUID NOT NULL,
    "le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appareil_id" UUID,
    "hors_ligne" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklist_check_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable : propositions reçues des autres apps
CREATE TABLE "checklist_proposal" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "evenement_source_id" UUID NOT NULL,
    "type" "checklist_type_proposition" NOT NULL,
    "contenu" JSONB NOT NULL,
    "statut" "checklist_statut_proposition" NOT NULL DEFAULT 'proposee',
    "action_id" UUID,
    "traitee_par_id" UUID,
    "traitee_le" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklist_proposal_pkey" PRIMARY KEY ("id")
);

-- Contraintes de cohérence
ALTER TABLE "checklist_template" ADD CONSTRAINT "checklist_template_fourni_team_check" CHECK (("fourni" AND "team_id" IS NULL) OR (NOT "fourni" AND "team_id" IS NOT NULL));
ALTER TABLE "checklist_list" ADD CONSTRAINT "checklist_list_avancement_check" CHECK ("avancement" BETWEEN 0 AND 100);
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_lien_check" CHECK (("lien_type" = 'aucun') = ("lien_id" IS NULL));
ALTER TABLE "checklist_check_log" ADD CONSTRAINT "checklist_check_log_changement_check" CHECK ("nouveau_statut" <> "ancien_statut");

-- Clés étrangères (vers le socle et entre tables de l'app)
ALTER TABLE "checklist_template" ADD CONSTRAINT "checklist_template_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_template" ADD CONSTRAINT "checklist_template_modele_origine_id_fkey" FOREIGN KEY ("modele_origine_id") REFERENCES "checklist_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checklist_template_section" ADD CONSTRAINT "checklist_template_section_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_template_section" ADD CONSTRAINT "checklist_template_section_modele_id_fkey" FOREIGN KEY ("modele_id") REFERENCES "checklist_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "checklist_template_item" ADD CONSTRAINT "checklist_template_item_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_template_item" ADD CONSTRAINT "checklist_template_item_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "checklist_template_section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "checklist_list" ADD CONSTRAINT "checklist_list_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_list" ADD CONSTRAINT "checklist_list_epreuve_id_fkey" FOREIGN KEY ("epreuve_id") REFERENCES "core_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_list" ADD CONSTRAINT "checklist_list_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "core_event_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_list" ADD CONSTRAINT "checklist_list_vehicule_id_fkey" FOREIGN KEY ("vehicule_id") REFERENCES "core_vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklist_list" ADD CONSTRAINT "checklist_list_modele_source_id_fkey" FOREIGN KEY ("modele_source_id") REFERENCES "checklist_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checklist_section" ADD CONSTRAINT "checklist_section_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_section" ADD CONSTRAINT "checklist_section_liste_id_fkey" FOREIGN KEY ("liste_id") REFERENCES "checklist_list"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "checklist_section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_personne_id_fkey" FOREIGN KEY ("personne_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_coche_par_id_fkey" FOREIGN KEY ("coche_par_id") REFERENCES "core_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_point_modele_origine_id_fkey" FOREIGN KEY ("point_modele_origine_id") REFERENCES "checklist_template_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checklist_check_log" ADD CONSTRAINT "checklist_check_log_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_check_log" ADD CONSTRAINT "checklist_check_log_point_id_fkey" FOREIGN KEY ("point_id") REFERENCES "checklist_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_check_log" ADD CONSTRAINT "checklist_check_log_par_id_fkey" FOREIGN KEY ("par_id") REFERENCES "core_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_check_log" ADD CONSTRAINT "checklist_check_log_appareil_id_fkey" FOREIGN KEY ("appareil_id") REFERENCES "core_device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checklist_proposal" ADD CONSTRAINT "checklist_proposal_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_proposal" ADD CONSTRAINT "checklist_proposal_evenement_source_id_fkey" FOREIGN KEY ("evenement_source_id") REFERENCES "core_domain_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_proposal" ADD CONSTRAINT "checklist_proposal_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "core_action"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklist_proposal" ADD CONSTRAINT "checklist_proposal_traitee_par_id_fkey" FOREIGN KEY ("traitee_par_id") REFERENCES "core_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index (team_id, deleted_at) et team_id sur chaque table, comme le veut docs/conventions-schema.md
CREATE INDEX "checklist_template_team_id_idx" ON "checklist_template"("team_id");
CREATE INDEX "checklist_template_team_id_deleted_at_idx" ON "checklist_template"("team_id", "deleted_at");
CREATE INDEX "checklist_template_section_team_id_idx" ON "checklist_template_section"("team_id");
CREATE INDEX "checklist_template_section_team_id_deleted_at_idx" ON "checklist_template_section"("team_id", "deleted_at");
CREATE INDEX "checklist_template_section_modele_id_idx" ON "checklist_template_section"("modele_id");
CREATE INDEX "checklist_template_item_team_id_idx" ON "checklist_template_item"("team_id");
CREATE INDEX "checklist_template_item_team_id_deleted_at_idx" ON "checklist_template_item"("team_id", "deleted_at");
CREATE INDEX "checklist_template_item_section_id_idx" ON "checklist_template_item"("section_id");
CREATE INDEX "checklist_list_team_id_idx" ON "checklist_list"("team_id");
CREATE INDEX "checklist_list_team_id_deleted_at_idx" ON "checklist_list"("team_id", "deleted_at");
CREATE INDEX "checklist_list_team_id_epreuve_id_idx" ON "checklist_list"("team_id", "epreuve_id");
CREATE INDEX "checklist_list_team_id_engagement_id_idx" ON "checklist_list"("team_id", "engagement_id");
CREATE INDEX "checklist_section_team_id_idx" ON "checklist_section"("team_id");
CREATE INDEX "checklist_section_team_id_deleted_at_idx" ON "checklist_section"("team_id", "deleted_at");
CREATE INDEX "checklist_section_liste_id_idx" ON "checklist_section"("liste_id");
CREATE INDEX "checklist_item_team_id_idx" ON "checklist_item"("team_id");
CREATE INDEX "checklist_item_team_id_deleted_at_idx" ON "checklist_item"("team_id", "deleted_at");
CREATE INDEX "checklist_item_section_id_idx" ON "checklist_item"("section_id");
CREATE INDEX "checklist_item_team_id_personne_id_idx" ON "checklist_item"("team_id", "personne_id");
CREATE INDEX "checklist_check_log_team_id_idx" ON "checklist_check_log"("team_id");
CREATE INDEX "checklist_check_log_team_id_deleted_at_idx" ON "checklist_check_log"("team_id", "deleted_at");
CREATE INDEX "checklist_check_log_point_id_le_idx" ON "checklist_check_log"("point_id", "le");
CREATE INDEX "checklist_proposal_team_id_idx" ON "checklist_proposal"("team_id");
CREATE INDEX "checklist_proposal_team_id_deleted_at_idx" ON "checklist_proposal"("team_id", "deleted_at");
CREATE INDEX "checklist_proposal_team_id_statut_idx" ON "checklist_proposal"("team_id", "statut");

-- Une seule proposition « créer les listes » non ignorée par engagement (Q6). Index partiel écrit à la main.
CREATE UNIQUE INDEX "checklist_proposal_creer_listes_engagement_key" ON "checklist_proposal"("team_id", (("contenu"->>'entryId')))
  WHERE "type" = 'creer_listes' AND "statut" <> 'ignoree' AND "deleted_at" IS NULL;

-- Cloisonnement par team (RLS), comme equipe_ et garage_.
ALTER TABLE "checklist_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_template" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "checklist_template" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
-- Modèles fournis : lisibles par toutes les teams, jamais écrits par le rôle applicatif (team_id vide ne passe pas WITH CHECK).
CREATE POLICY modeles_fournis ON "checklist_template" FOR SELECT TO elsass_racing_app
  USING (fourni AND team_id IS NULL);

ALTER TABLE "checklist_template_section" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_template_section" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "checklist_template_section" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
CREATE POLICY modeles_fournis ON "checklist_template_section" FOR SELECT TO elsass_racing_app
  USING (team_id IS NULL);

ALTER TABLE "checklist_template_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_template_item" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "checklist_template_item" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
CREATE POLICY modeles_fournis ON "checklist_template_item" FOR SELECT TO elsass_racing_app
  USING (team_id IS NULL);

ALTER TABLE "checklist_list" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_list" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "checklist_list" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "checklist_section" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_section" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "checklist_section" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "checklist_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_item" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "checklist_item" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

-- Journal des coches : ajout seul. Lecture et ajout par la team, ni mise à jour ni suppression (Q8).
ALTER TABLE "checklist_check_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_check_log" FORCE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE ON "checklist_check_log" FROM elsass_racing_app;
CREATE POLICY cloisonnement_team ON "checklist_check_log" FOR SELECT TO elsass_racing_app
  USING (team_id = core_team_courante());
CREATE POLICY cloisonnement_team_ajout ON "checklist_check_log" FOR INSERT TO elsass_racing_app
  WITH CHECK (team_id = core_team_courante());

ALTER TABLE "checklist_proposal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_proposal" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "checklist_proposal" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
