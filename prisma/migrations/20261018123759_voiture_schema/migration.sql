-- CreateEnum
CREATE TYPE "voiture_paper_type" AS ENUM ('passeport_technique', 'fiche_homologation', 'carte_grise', 'assurance', 'controle_technique', 'autre');

-- CreateEnum
CREATE TYPE "voiture_vue" AS ENUM ('droite', 'gauche', 'avant', 'arriere', 'dessus', 'hors_plan');

-- CreateEnum
CREATE TYPE "voiture_slot_statut" AS ENUM ('libre', 'reserve', 'occupe', 'indisponible');

-- CreateEnum
CREATE TYPE "voiture_assignment_statut" AS ENUM ('reserve', 'pose', 'retire');

-- CreateEnum
CREATE TYPE "voiture_conditions" AS ENUM ('sec', 'humide', 'mixte', 'neige');

-- CreateEnum
CREATE TYPE "voiture_revetement" AS ENUM ('asphalte', 'terre', 'mixte');

-- CreateTable
CREATE TABLE "voiture_vehicle" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "gabarit_cle" TEXT,
    "marque" TEXT,
    "modele" TEXT,
    "version" TEXT,
    "annee" INTEGER,
    "cylindree_cm3" INTEGER,
    "puissance_ch" INTEGER,
    "poids_kg" INTEGER,
    "couleur" TEXT,
    "immatriculation" TEXT,
    "numero_serie" TEXT,
    "groupe" TEXT,
    "classe" TEXT,
    "discipline" TEXT,
    "achete_le" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "voiture_vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voiture_paper" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "type" "voiture_paper_type" NOT NULL,
    "libelle" TEXT,
    "numero" TEXT,
    "delivre_le" DATE,
    "valable_jusqu_au" DATE,
    "document_file_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "voiture_paper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voiture_slot" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "vue" "voiture_vue" NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "forme" JSONB,
    "largeur_cm" INTEGER,
    "hauteur_cm" INTEGER,
    "statut" "voiture_slot_statut" NOT NULL DEFAULT 'libre',
    "symetrique" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "voiture_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voiture_slot_assignment" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "partenaire_id" UUID,
    "partenaire_nom" TEXT NOT NULL,
    "logo_file_id" UUID,
    "du" DATE,
    "au" DATE,
    "statut" "voiture_assignment_statut" NOT NULL,
    "photo_pose_file_id" UUID,
    "pose_le" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "voiture_slot_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voiture_setup" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "event_id" UUID,
    "entry_id" UUID,
    "date" DATE NOT NULL,
    "conditions" "voiture_conditions",
    "revetement" "voiture_revetement",
    "valeurs" JSONB NOT NULL DEFAULT '{}',
    "remarques" TEXT NOT NULL DEFAULT '',
    "note" INTEGER,
    "setup_template_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "voiture_setup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voiture_setup_template" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "valeurs" JSONB NOT NULL DEFAULT '{}',
    "cree_depuis_setup_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "voiture_setup_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voiture_team_pref" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "champs_reglage_masques" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "voiture_team_pref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voiture_vehicle_vehicle_id_key" ON "voiture_vehicle"("vehicle_id");

-- CreateIndex
CREATE INDEX "voiture_vehicle_team_id_idx" ON "voiture_vehicle"("team_id");

-- CreateIndex
CREATE INDEX "voiture_vehicle_team_id_deleted_at_idx" ON "voiture_vehicle"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "voiture_paper_team_id_idx" ON "voiture_paper"("team_id");

-- CreateIndex
CREATE INDEX "voiture_paper_team_id_deleted_at_idx" ON "voiture_paper"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "voiture_paper_vehicle_id_idx" ON "voiture_paper"("vehicle_id");

-- CreateIndex
CREATE INDEX "voiture_slot_team_id_idx" ON "voiture_slot"("team_id");

-- CreateIndex
CREATE INDEX "voiture_slot_team_id_deleted_at_idx" ON "voiture_slot"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "voiture_slot_vehicle_id_idx" ON "voiture_slot"("vehicle_id");

-- CreateIndex
CREATE INDEX "voiture_slot_assignment_team_id_idx" ON "voiture_slot_assignment"("team_id");

-- CreateIndex
CREATE INDEX "voiture_slot_assignment_team_id_deleted_at_idx" ON "voiture_slot_assignment"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "voiture_slot_assignment_slot_id_idx" ON "voiture_slot_assignment"("slot_id");

-- CreateIndex
CREATE INDEX "voiture_setup_team_id_idx" ON "voiture_setup"("team_id");

-- CreateIndex
CREATE INDEX "voiture_setup_team_id_deleted_at_idx" ON "voiture_setup"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "voiture_setup_vehicle_id_idx" ON "voiture_setup"("vehicle_id");

-- CreateIndex
CREATE INDEX "voiture_setup_template_team_id_idx" ON "voiture_setup_template"("team_id");

-- CreateIndex
CREATE INDEX "voiture_setup_template_team_id_deleted_at_idx" ON "voiture_setup_template"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "voiture_setup_template_vehicle_id_idx" ON "voiture_setup_template"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "voiture_team_pref_team_id_key" ON "voiture_team_pref"("team_id");

-- CreateIndex
CREATE INDEX "voiture_team_pref_team_id_idx" ON "voiture_team_pref"("team_id");

-- CreateIndex
CREATE INDEX "voiture_team_pref_team_id_deleted_at_idx" ON "voiture_team_pref"("team_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "voiture_vehicle" ADD CONSTRAINT "voiture_vehicle_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_vehicle" ADD CONSTRAINT "voiture_vehicle_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_paper" ADD CONSTRAINT "voiture_paper_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_paper" ADD CONSTRAINT "voiture_paper_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_paper" ADD CONSTRAINT "voiture_paper_document_file_id_fkey" FOREIGN KEY ("document_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_slot" ADD CONSTRAINT "voiture_slot_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_slot" ADD CONSTRAINT "voiture_slot_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_slot_assignment" ADD CONSTRAINT "voiture_slot_assignment_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_slot_assignment" ADD CONSTRAINT "voiture_slot_assignment_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "voiture_slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_slot_assignment" ADD CONSTRAINT "voiture_slot_assignment_logo_file_id_fkey" FOREIGN KEY ("logo_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_slot_assignment" ADD CONSTRAINT "voiture_slot_assignment_photo_pose_file_id_fkey" FOREIGN KEY ("photo_pose_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_setup" ADD CONSTRAINT "voiture_setup_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_setup" ADD CONSTRAINT "voiture_setup_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_setup" ADD CONSTRAINT "voiture_setup_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_setup" ADD CONSTRAINT "voiture_setup_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "core_event_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_setup" ADD CONSTRAINT "voiture_setup_setup_template_id_fkey" FOREIGN KEY ("setup_template_id") REFERENCES "voiture_setup_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_setup_template" ADD CONSTRAINT "voiture_setup_template_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_setup_template" ADD CONSTRAINT "voiture_setup_template_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_setup_template" ADD CONSTRAINT "voiture_setup_template_cree_depuis_setup_id_fkey" FOREIGN KEY ("cree_depuis_setup_id") REFERENCES "voiture_setup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiture_team_pref" ADD CONSTRAINT "voiture_team_pref_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Instructions ajoutées à la main (Prisma ne sait pas les décrire) : CHECK et index partiel.
ALTER TABLE "voiture_setup" ADD CONSTRAINT "voiture_setup_note_check" CHECK ("note" IS NULL OR ("note" >= 1 AND "note" <= 5));
ALTER TABLE "voiture_paper" ADD CONSTRAINT "voiture_paper_libelle_autre_check" CHECK ("type" <> 'autre' OR ("libelle" IS NOT NULL AND btrim("libelle") <> ''));

-- Un seul enregistrement actif par emplacement (statut différent de retiré, non supprimé).
CREATE UNIQUE INDEX "voiture_slot_assignment_actif_key" ON "voiture_slot_assignment"("slot_id") WHERE "statut" <> 'retire' AND "deleted_at" IS NULL;

-- Cloisonnement par team (RLS), comme budget_ et saison_.
ALTER TABLE "voiture_vehicle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voiture_vehicle" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "voiture_vehicle" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "voiture_paper" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voiture_paper" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "voiture_paper" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "voiture_slot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voiture_slot" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "voiture_slot" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "voiture_slot_assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voiture_slot_assignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "voiture_slot_assignment" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "voiture_setup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voiture_setup" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "voiture_setup" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "voiture_setup_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voiture_setup_template" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "voiture_setup_template" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "voiture_team_pref" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voiture_team_pref" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "voiture_team_pref" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
