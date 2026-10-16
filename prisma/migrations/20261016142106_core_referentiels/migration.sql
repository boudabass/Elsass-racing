-- CreateEnum
CREATE TYPE "core_event_type" AS ENUM ('rallye', 'slalom', 'course_de_cote', 'expo', 'roulage', 'autre');

-- CreateEnum
CREATE TYPE "core_event_statut" AS ENUM ('envisagee', 'en_cours', 'terminee', 'annulee');

-- CreateEnum
CREATE TYPE "core_entry_statut" AS ENUM ('envisage', 'inscrit', 'paye', 'parti', 'arrivee', 'abandon', 'forfait');

-- CreateEnum
CREATE TYPE "core_vehicle_type" AS ENUM ('course', 'reco', 'assistance', 'remorque');

-- CreateEnum
CREATE TYPE "core_contact_categorie" AS ENUM ('partenaire', 'fournisseur', 'asa', 'photographe', 'prestataire');

-- CreateTable
CREATE TABLE "core_person" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "date_naissance" DATE,
    "lieu_naissance" TEXT,
    "nationalite" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "photo_file_id" UUID,
    "membre_team" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "contact_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_season" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "annee" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "en_cours" BOOLEAN NOT NULL DEFAULT false,
    "cloturee_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_event" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "type" "core_event_type" NOT NULL,
    "nom" TEXT NOT NULL,
    "edition" INTEGER,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "lieu" TEXT,
    "departement" TEXT,
    "organisateur_contact_id" UUID,
    "statut" "core_event_statut" NOT NULL DEFAULT 'envisagee',
    "lien_officiel" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_event_entry" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "pilote_id" UUID,
    "copilote_id" UUID,
    "numero_course" TEXT,
    "groupe" TEXT,
    "classe" TEXT,
    "statut" "core_entry_statut" NOT NULL DEFAULT 'envisage',
    "cause_abandon" TEXT,
    "km_chronometres" DECIMAL(6,1),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_event_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_vehicle" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "type" "core_vehicle_type" NOT NULL,
    "nom_court" TEXT NOT NULL,
    "photo_file_id" UUID,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_contact" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "site" TEXT,
    "siret" TEXT,
    "categories" "core_contact_categorie"[] DEFAULT ARRAY[]::"core_contact_categorie"[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_tag" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "couleur" TEXT,
    "portee" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "core_person_team_id_idx" ON "core_person"("team_id");

-- CreateIndex
CREATE INDEX "core_person_user_id_idx" ON "core_person"("user_id");

-- CreateIndex
CREATE INDEX "core_person_contact_id_idx" ON "core_person"("contact_id");

-- CreateIndex
CREATE INDEX "core_season_team_id_idx" ON "core_season"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "core_season_team_id_annee_key" ON "core_season"("team_id", "annee");

-- CreateIndex
CREATE INDEX "core_event_team_id_idx" ON "core_event"("team_id");

-- CreateIndex
CREATE INDEX "core_event_season_id_idx" ON "core_event"("season_id");

-- CreateIndex
CREATE INDEX "core_event_team_id_date_debut_idx" ON "core_event"("team_id", "date_debut");

-- CreateIndex
CREATE INDEX "core_event_entry_team_id_idx" ON "core_event_entry"("team_id");

-- CreateIndex
CREATE INDEX "core_event_entry_event_id_idx" ON "core_event_entry"("event_id");

-- CreateIndex
CREATE INDEX "core_event_entry_vehicle_id_idx" ON "core_event_entry"("vehicle_id");

-- CreateIndex
CREATE INDEX "core_event_entry_pilote_id_idx" ON "core_event_entry"("pilote_id");

-- CreateIndex
CREATE INDEX "core_event_entry_copilote_id_idx" ON "core_event_entry"("copilote_id");

-- CreateIndex
CREATE INDEX "core_vehicle_team_id_idx" ON "core_vehicle"("team_id");

-- CreateIndex
CREATE INDEX "core_contact_team_id_idx" ON "core_contact"("team_id");

-- CreateIndex
CREATE INDEX "core_contact_team_id_nom_idx" ON "core_contact"("team_id", "nom");

-- CreateIndex
CREATE INDEX "core_tag_team_id_idx" ON "core_tag"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "core_tag_team_id_nom_portee_key" ON "core_tag"("team_id", "nom", "portee");

-- CreateIndex
CREATE INDEX "core_device_user_id_idx" ON "core_device"("user_id");

-- CreateIndex
CREATE INDEX "core_invitation_envoyee_par_user_id_idx" ON "core_invitation"("envoyee_par_user_id");

-- CreateIndex
CREATE INDEX "core_invitation_person_id_idx" ON "core_invitation"("person_id");

-- CreateIndex
CREATE INDEX "core_membership_person_id_idx" ON "core_membership"("person_id");

-- AddForeignKey
ALTER TABLE "core_invitation" ADD CONSTRAINT "core_invitation_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_membership" ADD CONSTRAINT "core_membership_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_person" ADD CONSTRAINT "core_person_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_person" ADD CONSTRAINT "core_person_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_person" ADD CONSTRAINT "core_person_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "core_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_season" ADD CONSTRAINT "core_season_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_event" ADD CONSTRAINT "core_event_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_event" ADD CONSTRAINT "core_event_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "core_season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_event" ADD CONSTRAINT "core_event_organisateur_contact_id_fkey" FOREIGN KEY ("organisateur_contact_id") REFERENCES "core_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_event_entry" ADD CONSTRAINT "core_event_entry_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_event_entry" ADD CONSTRAINT "core_event_entry_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_event_entry" ADD CONSTRAINT "core_event_entry_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_event_entry" ADD CONSTRAINT "core_event_entry_pilote_id_fkey" FOREIGN KEY ("pilote_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_event_entry" ADD CONSTRAINT "core_event_entry_copilote_id_fkey" FOREIGN KEY ("copilote_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_vehicle" ADD CONSTRAINT "core_vehicle_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_contact" ADD CONSTRAINT "core_contact_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_tag" ADD CONSTRAINT "core_tag_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
