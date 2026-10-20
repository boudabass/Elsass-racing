-- CreateEnum
CREATE TYPE "garage_qualite_piece" AS ENUM ('origine', 'renforcee', 'competition');

-- CreateEnum
CREATE TYPE "garage_statut_piece" AS ENUM ('en_stock', 'montee', 'en_revision', 'usee', 'cassee', 'vendue');

-- CreateEnum
CREATE TYPE "garage_motif_depose" AS ENUM ('usure', 'casse', 'preventif', 'revision');

-- CreateEnum
CREATE TYPE "garage_mode_usure" AS ENUM ('km', 'epreuves', 'les_deux');

-- CreateEnum
CREATE TYPE "garage_source_usure" AS ENUM ('resultat_saison', 'saisie_manuelle');

-- CreateEnum
CREATE TYPE "garage_type_ordre" AS ENUM ('revision', 'reparation', 'remplacement', 'controle');

-- CreateEnum
CREATE TYPE "garage_statut_ordre" AS ENUM ('prevu', 'en_cours', 'termine');

-- CreateEnum
CREATE TYPE "garage_origine_ordre" AS ENUM ('saisie', 'point_checklist');

-- CreateEnum
CREATE TYPE "garage_statut_commande" AS ENUM ('commandee', 'expediee', 'recue');

-- CreateEnum
CREATE TYPE "garage_type_pneus" AS ENUM ('asphalte', 'terre', 'pluie', 'neige');

-- CreateEnum
CREATE TYPE "garage_statut_pneus" AS ENUM ('neuf', 'utilise', 'use');

-- CreateEnum
CREATE TYPE "garage_type_casse" AS ENUM ('casse_mecanique', 'sortie', 'accident');

-- CreateEnum
CREATE TYPE "garage_categorie_equipement" AS ENUM ('remorque', 'outillage', 'levage', 'assistance', 'stand');

-- CreateTable
CREATE TABLE "garage_component_type" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "cle" TEXT,
    "icone" TEXT NOT NULL,
    "critique" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL,
    "positions" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_component_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_vehicle_component" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "component_type_id" UUID NOT NULL,
    "position" TEXT,
    "mode_usure" "garage_mode_usure" NOT NULL,
    "duree_vie_reference_km" INTEGER,
    "duree_vie_reference_epreuves" INTEGER,
    "seuil_orange_pct" INTEGER NOT NULL DEFAULT 30,
    "seuil_rouge_pct" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_vehicle_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_part" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "component_type_id" UUID NOT NULL,
    "designation" TEXT NOT NULL,
    "marque" TEXT,
    "reference" TEXT,
    "numero_serie" TEXT,
    "qualite" "garage_qualite_piece" NOT NULL DEFAULT 'origine',
    "duree_vie_km" INTEGER,
    "duree_vie_epreuves" INTEGER,
    "achetee_le" TIMESTAMPTZ(3),
    "prix_cents" INTEGER,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "fournisseur_contact_id" UUID,
    "statut" "garage_statut_piece" NOT NULL DEFAULT 'en_stock',
    "emplacement" TEXT,
    "km_cumules" DECIMAL(8,1) NOT NULL DEFAULT 0,
    "epreuves_cumulees" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_part_mount" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "vehicle_component_id" UUID NOT NULL,
    "posee_le" TIMESTAMPTZ(3) NOT NULL,
    "km_pose" DECIMAL(8,1) NOT NULL DEFAULT 0,
    "deposee_le" TIMESTAMPTZ(3),
    "motif_depose" "garage_motif_depose",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_part_mount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_wear_log" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "part_id" UUID,
    "tyre_set_id" UUID,
    "event_id" UUID,
    "event_entry_id" UUID,
    "km_ajoutes" DECIMAL(8,1) NOT NULL DEFAULT 0,
    "epreuve_comptee" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "source" "garage_source_usure" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_wear_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_work_order" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "vehicle_component_id" UUID,
    "type" "garage_type_ordre" NOT NULL,
    "titre" TEXT NOT NULL,
    "a_faire_avant_event_id" UUID,
    "duree_estimee_minutes" INTEGER,
    "statut" "garage_statut_ordre" NOT NULL DEFAULT 'prevu',
    "avancement_pct" INTEGER NOT NULL DEFAULT 0,
    "cout_main_oeuvre_cents" INTEGER,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "prestataire_contact_id" UUID,
    "origine" "garage_origine_ordre" NOT NULL DEFAULT 'saisie',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_work_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_purchase" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "supplier_contact_id" UUID NOT NULL,
    "statut" "garage_statut_commande" NOT NULL DEFAULT 'commandee',
    "commandee_le" TIMESTAMPTZ(3) NOT NULL,
    "livraison_prevue_le" DATE,
    "recue_le" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_tyre_set" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "vehicle_component_id" UUID,
    "marque" TEXT NOT NULL,
    "modele" TEXT,
    "gomme" TEXT,
    "type" "garage_type_pneus" NOT NULL,
    "dimensions" TEXT,
    "achete_le" TIMESTAMPTZ(3),
    "nombre_epreuves" INTEGER NOT NULL DEFAULT 0,
    "km_speciale" DECIMAL(8,1) NOT NULL DEFAULT 0,
    "usure_estimee_pct" INTEGER,
    "statut" "garage_statut_pneus" NOT NULL DEFAULT 'neuf',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_tyre_set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_incident" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "event_id" UUID,
    "event_entry_id" UUID,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "speciale_nom" TEXT,
    "stage_id" UUID,
    "type" "garage_type_casse" NOT NULL,
    "cause" TEXT,
    "reparation_work_order_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_equipment" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" "garage_categorie_equipement" NOT NULL,
    "etat" TEXT,
    "achete_le" TIMESTAMPTZ(3),
    "valeur_cents" INTEGER,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "prochain_controle_le" DATE,
    "emplacement" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_purchase_line" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "part_id" UUID,
    "designation" TEXT NOT NULL,
    "reference" TEXT,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "prix_unitaire_cents" INTEGER NOT NULL DEFAULT 0,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_purchase_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_work_order_part" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_work_order_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_work_order_person" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_work_order_person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_incident_component" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "vehicle_component_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_incident_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_incident_part" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_incident_part_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "garage_component_type_team_id_idx" ON "garage_component_type"("team_id");

-- CreateIndex
CREATE INDEX "garage_component_type_team_id_deleted_at_idx" ON "garage_component_type"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "garage_vehicle_component_team_id_idx" ON "garage_vehicle_component"("team_id");

-- CreateIndex
CREATE INDEX "garage_vehicle_component_team_id_deleted_at_idx" ON "garage_vehicle_component"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "garage_vehicle_component_vehicle_id_idx" ON "garage_vehicle_component"("vehicle_id");

-- CreateIndex
CREATE INDEX "garage_vehicle_component_component_type_id_idx" ON "garage_vehicle_component"("component_type_id");

-- CreateIndex
CREATE INDEX "garage_part_team_id_idx" ON "garage_part"("team_id");

-- CreateIndex
CREATE INDEX "garage_part_team_id_deleted_at_idx" ON "garage_part"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "garage_part_vehicle_id_idx" ON "garage_part"("vehicle_id");

-- CreateIndex
CREATE INDEX "garage_part_component_type_id_idx" ON "garage_part"("component_type_id");

-- CreateIndex
CREATE INDEX "garage_part_fournisseur_contact_id_idx" ON "garage_part"("fournisseur_contact_id");

-- CreateIndex
CREATE INDEX "garage_part_mount_team_id_idx" ON "garage_part_mount"("team_id");

-- CreateIndex
CREATE INDEX "garage_part_mount_team_id_deleted_at_idx" ON "garage_part_mount"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "garage_part_mount_part_id_idx" ON "garage_part_mount"("part_id");

-- CreateIndex
CREATE INDEX "garage_part_mount_vehicle_component_id_idx" ON "garage_part_mount"("vehicle_component_id");

-- CreateIndex
CREATE INDEX "garage_wear_log_team_id_idx" ON "garage_wear_log"("team_id");

-- CreateIndex
CREATE INDEX "garage_wear_log_team_id_deleted_at_idx" ON "garage_wear_log"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "garage_wear_log_part_id_idx" ON "garage_wear_log"("part_id");

-- CreateIndex
CREATE INDEX "garage_wear_log_tyre_set_id_idx" ON "garage_wear_log"("tyre_set_id");

-- CreateIndex
CREATE INDEX "garage_wear_log_event_id_idx" ON "garage_wear_log"("event_id");

-- CreateIndex
CREATE INDEX "garage_wear_log_event_entry_id_idx" ON "garage_wear_log"("event_entry_id");

-- CreateIndex
CREATE INDEX "garage_work_order_team_id_idx" ON "garage_work_order"("team_id");

-- CreateIndex
CREATE INDEX "garage_work_order_team_id_deleted_at_idx" ON "garage_work_order"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "garage_work_order_vehicle_id_idx" ON "garage_work_order"("vehicle_id");

-- CreateIndex
CREATE INDEX "garage_work_order_vehicle_component_id_idx" ON "garage_work_order"("vehicle_component_id");

-- CreateIndex
CREATE INDEX "garage_work_order_a_faire_avant_event_id_idx" ON "garage_work_order"("a_faire_avant_event_id");

-- CreateIndex
CREATE INDEX "garage_work_order_prestataire_contact_id_idx" ON "garage_work_order"("prestataire_contact_id");

-- CreateIndex
CREATE INDEX "garage_purchase_team_id_idx" ON "garage_purchase"("team_id");

-- CreateIndex
CREATE INDEX "garage_purchase_team_id_deleted_at_idx" ON "garage_purchase"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "garage_purchase_vehicle_id_idx" ON "garage_purchase"("vehicle_id");

-- CreateIndex
CREATE INDEX "garage_purchase_supplier_contact_id_idx" ON "garage_purchase"("supplier_contact_id");

-- CreateIndex
CREATE INDEX "garage_tyre_set_team_id_idx" ON "garage_tyre_set"("team_id");

-- CreateIndex
CREATE INDEX "garage_tyre_set_team_id_deleted_at_idx" ON "garage_tyre_set"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "garage_tyre_set_vehicle_id_idx" ON "garage_tyre_set"("vehicle_id");

-- CreateIndex
CREATE INDEX "garage_tyre_set_vehicle_component_id_idx" ON "garage_tyre_set"("vehicle_component_id");

-- CreateIndex
CREATE INDEX "garage_incident_team_id_idx" ON "garage_incident"("team_id");

-- CreateIndex
CREATE INDEX "garage_incident_team_id_deleted_at_idx" ON "garage_incident"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "garage_incident_vehicle_id_idx" ON "garage_incident"("vehicle_id");

-- CreateIndex
CREATE INDEX "garage_incident_event_id_idx" ON "garage_incident"("event_id");

-- CreateIndex
CREATE INDEX "garage_incident_event_entry_id_idx" ON "garage_incident"("event_entry_id");

-- CreateIndex
CREATE INDEX "garage_incident_reparation_work_order_id_idx" ON "garage_incident"("reparation_work_order_id");

-- CreateIndex
CREATE INDEX "garage_equipment_team_id_idx" ON "garage_equipment"("team_id");

-- CreateIndex
CREATE INDEX "garage_equipment_team_id_deleted_at_idx" ON "garage_equipment"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "garage_purchase_line_team_id_idx" ON "garage_purchase_line"("team_id");

-- CreateIndex
CREATE INDEX "garage_purchase_line_purchase_id_idx" ON "garage_purchase_line"("purchase_id");

-- CreateIndex
CREATE INDEX "garage_purchase_line_part_id_idx" ON "garage_purchase_line"("part_id");

-- CreateIndex
CREATE INDEX "garage_work_order_part_team_id_idx" ON "garage_work_order_part"("team_id");

-- CreateIndex
CREATE INDEX "garage_work_order_part_part_id_idx" ON "garage_work_order_part"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "garage_work_order_part_work_order_id_part_id_key" ON "garage_work_order_part"("work_order_id", "part_id");

-- CreateIndex
CREATE INDEX "garage_work_order_person_team_id_idx" ON "garage_work_order_person"("team_id");

-- CreateIndex
CREATE INDEX "garage_work_order_person_person_id_idx" ON "garage_work_order_person"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "garage_work_order_person_work_order_id_person_id_key" ON "garage_work_order_person"("work_order_id", "person_id");

-- CreateIndex
CREATE INDEX "garage_incident_component_team_id_idx" ON "garage_incident_component"("team_id");

-- CreateIndex
CREATE INDEX "garage_incident_component_vehicle_component_id_idx" ON "garage_incident_component"("vehicle_component_id");

-- CreateIndex
CREATE UNIQUE INDEX "garage_incident_component_incident_id_vehicle_component_id_key" ON "garage_incident_component"("incident_id", "vehicle_component_id");

-- CreateIndex
CREATE INDEX "garage_incident_part_team_id_idx" ON "garage_incident_part"("team_id");

-- CreateIndex
CREATE INDEX "garage_incident_part_part_id_idx" ON "garage_incident_part"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "garage_incident_part_incident_id_part_id_key" ON "garage_incident_part"("incident_id", "part_id");

-- AddForeignKey
ALTER TABLE "garage_component_type" ADD CONSTRAINT "garage_component_type_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_vehicle_component" ADD CONSTRAINT "garage_vehicle_component_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_vehicle_component" ADD CONSTRAINT "garage_vehicle_component_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_vehicle_component" ADD CONSTRAINT "garage_vehicle_component_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "garage_component_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_part" ADD CONSTRAINT "garage_part_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_part" ADD CONSTRAINT "garage_part_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_part" ADD CONSTRAINT "garage_part_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "garage_component_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_part" ADD CONSTRAINT "garage_part_fournisseur_contact_id_fkey" FOREIGN KEY ("fournisseur_contact_id") REFERENCES "core_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_part_mount" ADD CONSTRAINT "garage_part_mount_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_part_mount" ADD CONSTRAINT "garage_part_mount_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "garage_part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_part_mount" ADD CONSTRAINT "garage_part_mount_vehicle_component_id_fkey" FOREIGN KEY ("vehicle_component_id") REFERENCES "garage_vehicle_component"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_wear_log" ADD CONSTRAINT "garage_wear_log_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_wear_log" ADD CONSTRAINT "garage_wear_log_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "garage_part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_wear_log" ADD CONSTRAINT "garage_wear_log_tyre_set_id_fkey" FOREIGN KEY ("tyre_set_id") REFERENCES "garage_tyre_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_wear_log" ADD CONSTRAINT "garage_wear_log_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_wear_log" ADD CONSTRAINT "garage_wear_log_event_entry_id_fkey" FOREIGN KEY ("event_entry_id") REFERENCES "core_event_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_work_order" ADD CONSTRAINT "garage_work_order_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_work_order" ADD CONSTRAINT "garage_work_order_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_work_order" ADD CONSTRAINT "garage_work_order_vehicle_component_id_fkey" FOREIGN KEY ("vehicle_component_id") REFERENCES "garage_vehicle_component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_work_order" ADD CONSTRAINT "garage_work_order_a_faire_avant_event_id_fkey" FOREIGN KEY ("a_faire_avant_event_id") REFERENCES "core_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_work_order" ADD CONSTRAINT "garage_work_order_prestataire_contact_id_fkey" FOREIGN KEY ("prestataire_contact_id") REFERENCES "core_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_purchase" ADD CONSTRAINT "garage_purchase_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_purchase" ADD CONSTRAINT "garage_purchase_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_purchase" ADD CONSTRAINT "garage_purchase_supplier_contact_id_fkey" FOREIGN KEY ("supplier_contact_id") REFERENCES "core_contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_tyre_set" ADD CONSTRAINT "garage_tyre_set_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_tyre_set" ADD CONSTRAINT "garage_tyre_set_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_tyre_set" ADD CONSTRAINT "garage_tyre_set_vehicle_component_id_fkey" FOREIGN KEY ("vehicle_component_id") REFERENCES "garage_vehicle_component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_incident" ADD CONSTRAINT "garage_incident_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_incident" ADD CONSTRAINT "garage_incident_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_incident" ADD CONSTRAINT "garage_incident_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_incident" ADD CONSTRAINT "garage_incident_event_entry_id_fkey" FOREIGN KEY ("event_entry_id") REFERENCES "core_event_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_incident" ADD CONSTRAINT "garage_incident_reparation_work_order_id_fkey" FOREIGN KEY ("reparation_work_order_id") REFERENCES "garage_work_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_equipment" ADD CONSTRAINT "garage_equipment_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_purchase_line" ADD CONSTRAINT "garage_purchase_line_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_purchase_line" ADD CONSTRAINT "garage_purchase_line_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "garage_purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_purchase_line" ADD CONSTRAINT "garage_purchase_line_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "garage_part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_work_order_part" ADD CONSTRAINT "garage_work_order_part_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_work_order_part" ADD CONSTRAINT "garage_work_order_part_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "garage_work_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_work_order_part" ADD CONSTRAINT "garage_work_order_part_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "garage_part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_work_order_person" ADD CONSTRAINT "garage_work_order_person_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_work_order_person" ADD CONSTRAINT "garage_work_order_person_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "garage_work_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_work_order_person" ADD CONSTRAINT "garage_work_order_person_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_incident_component" ADD CONSTRAINT "garage_incident_component_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_incident_component" ADD CONSTRAINT "garage_incident_component_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "garage_incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_incident_component" ADD CONSTRAINT "garage_incident_component_vehicle_component_id_fkey" FOREIGN KEY ("vehicle_component_id") REFERENCES "garage_vehicle_component"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_incident_part" ADD CONSTRAINT "garage_incident_part_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_incident_part" ADD CONSTRAINT "garage_incident_part_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "garage_incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_incident_part" ADD CONSTRAINT "garage_incident_part_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "garage_part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Instructions ajoutées à la main (Prisma ne sait pas les décrire) : CHECK et index partiels.

-- Seuils d'un organe : 0 <= rouge < orange <= 100.
ALTER TABLE "garage_vehicle_component" ADD CONSTRAINT "garage_vehicle_component_seuils_check" CHECK ("seuil_rouge_pct" >= 0 AND "seuil_rouge_pct" < "seuil_orange_pct" AND "seuil_orange_pct" <= 100);

-- Durées de vie strictement positives quand elles sont renseignées.
ALTER TABLE "garage_vehicle_component" ADD CONSTRAINT "garage_vehicle_component_duree_check" CHECK (("duree_vie_reference_km" IS NULL OR "duree_vie_reference_km" > 0) AND ("duree_vie_reference_epreuves" IS NULL OR "duree_vie_reference_epreuves" > 0));
ALTER TABLE "garage_part" ADD CONSTRAINT "garage_part_duree_check" CHECK (("duree_vie_km" IS NULL OR "duree_vie_km" > 0) AND ("duree_vie_epreuves" IS NULL OR "duree_vie_epreuves" > 0));

-- Cumuls et prix positifs.
ALTER TABLE "garage_part" ADD CONSTRAINT "garage_part_cumuls_check" CHECK ("km_cumules" >= 0 AND "epreuves_cumulees" >= 0 AND ("prix_cents" IS NULL OR "prix_cents" >= 0));

-- Pose : la dépose a un motif et ne précède pas la pose.
ALTER TABLE "garage_part_mount" ADD CONSTRAINT "garage_part_mount_depose_check" CHECK (("deposee_le" IS NULL) = ("motif_depose" IS NULL) AND ("deposee_le" IS NULL OR "deposee_le" >= "posee_le"));

-- Une seule pose active par organe, une seule par pièce.
CREATE UNIQUE INDEX "garage_part_mount_organe_actif_key" ON "garage_part_mount"("vehicle_component_id") WHERE "deposee_le" IS NULL AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "garage_part_mount_piece_active_key" ON "garage_part_mount"("part_id") WHERE "deposee_le" IS NULL AND "deleted_at" IS NULL;

-- Usure : exactement une cible, pièce ou train de pneus (correction B).
ALTER TABLE "garage_wear_log" ADD CONSTRAINT "garage_wear_log_cible_check" CHECK (("part_id" IS NULL) <> ("tyre_set_id" IS NULL));
ALTER TABLE "garage_wear_log" ADD CONSTRAINT "garage_wear_log_km_check" CHECK ("km_ajoutes" >= 0);

-- Une validation de résultat n'ajoute l'usure qu'une fois, à une pièce et à un train.
CREATE UNIQUE INDEX "garage_wear_log_piece_engagement_key" ON "garage_wear_log"("part_id", "event_entry_id", "source") WHERE "event_entry_id" IS NOT NULL AND "part_id" IS NOT NULL;
CREATE UNIQUE INDEX "garage_wear_log_train_engagement_key" ON "garage_wear_log"("tyre_set_id", "event_entry_id", "source") WHERE "event_entry_id" IS NOT NULL AND "tyre_set_id" IS NOT NULL;

-- Ordres de travail : avancement entre 0 et 100, durée et coût positifs.
ALTER TABLE "garage_work_order" ADD CONSTRAINT "garage_work_order_avancement_check" CHECK ("avancement_pct" BETWEEN 0 AND 100);
ALTER TABLE "garage_work_order" ADD CONSTRAINT "garage_work_order_duree_check" CHECK ("duree_estimee_minutes" IS NULL OR "duree_estimee_minutes" >= 0);
ALTER TABLE "garage_work_order" ADD CONSTRAINT "garage_work_order_cout_check" CHECK ("cout_main_oeuvre_cents" IS NULL OR "cout_main_oeuvre_cents" >= 0);

-- Commande reçue : une date de réception.
ALTER TABLE "garage_purchase" ADD CONSTRAINT "garage_purchase_recue_check" CHECK ("statut" <> 'recue' OR "recue_le" IS NOT NULL);

-- Lignes de commande : quantité au moins 1, prix positif.
ALTER TABLE "garage_purchase_line" ADD CONSTRAINT "garage_purchase_line_check" CHECK ("quantite" >= 1 AND "prix_unitaire_cents" >= 0);

-- Pneus : usure entre 0 et 100, compteurs positifs (correction B).
ALTER TABLE "garage_tyre_set" ADD CONSTRAINT "garage_tyre_set_usure_check" CHECK ("usure_estimee_pct" IS NULL OR ("usure_estimee_pct" BETWEEN 0 AND 100));
ALTER TABLE "garage_tyre_set" ADD CONSTRAINT "garage_tyre_set_cumuls_check" CHECK ("km_speciale" >= 0 AND "nombre_epreuves" >= 0);

-- Équipements : valeur positive.
ALTER TABLE "garage_equipment" ADD CONSTRAINT "garage_equipment_valeur_check" CHECK ("valeur_cents" IS NULL OR "valeur_cents" >= 0);

-- Types d'organes : nom et clé par défaut uniques parmi les lignes actives de la team.
CREATE UNIQUE INDEX "garage_component_type_nom_actif_key" ON "garage_component_type"("team_id", "nom") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "garage_component_type_cle_active_key" ON "garage_component_type"("team_id", "cle") WHERE "cle" IS NOT NULL AND "deleted_at" IS NULL;

-- Cloisonnement par team (RLS), comme voiture_.
ALTER TABLE "garage_component_type" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_component_type" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_component_type" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_vehicle_component" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_vehicle_component" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_vehicle_component" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_part" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_part" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_part" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_part_mount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_part_mount" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_part_mount" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_wear_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_wear_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_wear_log" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_work_order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_work_order" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_work_order" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_purchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_purchase" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_purchase" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_purchase_line" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_purchase_line" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_purchase_line" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_tyre_set" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_tyre_set" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_tyre_set" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_incident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_incident" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_incident" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_incident_component" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_incident_component" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_incident_component" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_incident_part" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_incident_part" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_incident_part" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_equipment" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_equipment" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_work_order_part" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_work_order_part" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_work_order_part" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "garage_work_order_person" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_work_order_person" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_work_order_person" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
