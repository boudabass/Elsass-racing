-- CreateEnum
CREATE TYPE "core_attachment_role" AS ENUM ('ticket', 'preuve', 'photo', 'document');

-- CreateEnum
CREATE TYPE "core_task_statut" AS ENUM ('a_faire', 'fait');

-- CreateEnum
CREATE TYPE "core_alert_niveau" AS ENUM ('info', 'orange', 'rouge');

-- CreateEnum
CREATE TYPE "core_alert_statut" AS ENUM ('ouverte', 'traitee', 'ignoree');

-- CreateEnum
CREATE TYPE "core_action_statut" AS ENUM ('en_attente', 'decidee', 'expiree', 'annulee');

-- CreateEnum
CREATE TYPE "core_canal" AS ENUM ('app', 'push', 'mail', 'sms');

-- CreateEnum
CREATE TYPE "core_regroupement" AS ENUM ('immediat', 'quotidien');

-- CreateEnum
CREATE TYPE "core_delivery_statut" AS ENUM ('en_attente', 'traite', 'erreur');

-- CreateEnum
CREATE TYPE "core_export_statut" AS ENUM ('en_attente', 'en_cours', 'pret', 'erreur');

-- CreateTable
CREATE TABLE "core_file" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "empreinte" TEXT NOT NULL,
    "largeur" INTEGER,
    "hauteur" INTEGER,
    "credit" TEXT,
    "prise_de_vue_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_attachment" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "app" TEXT NOT NULL,
    "fiche_type" TEXT NOT NULL,
    "fiche_id" UUID NOT NULL,
    "role" "core_attachment_role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_activity" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "app" TEXT NOT NULL,
    "fiche_type" TEXT NOT NULL,
    "fiche_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "auteur_user_id" UUID,
    "resume" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_note" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "app" TEXT NOT NULL,
    "fiche_type" TEXT NOT NULL,
    "fiche_id" UUID NOT NULL,
    "auteur_user_id" UUID,
    "texte" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_task" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "app" TEXT NOT NULL,
    "fiche_type" TEXT,
    "fiche_id" UUID,
    "event_id" UUID,
    "titre" TEXT NOT NULL,
    "assignee_person_id" UUID,
    "echeance" DATE,
    "statut" "core_task_statut" NOT NULL DEFAULT 'a_faire',
    "fait_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_alert" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "app" TEXT NOT NULL,
    "fiche_type" TEXT,
    "fiche_id" UUID,
    "titre" TEXT NOT NULL,
    "niveau" "core_alert_niveau" NOT NULL,
    "echeance" TIMESTAMPTZ(3),
    "statut" "core_alert_statut" NOT NULL DEFAULT 'ouverte',
    "traitee_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_action" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "app_origine" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fiche_type" TEXT,
    "fiche_id" UUID,
    "event_id" UUID,
    "titre" TEXT NOT NULL,
    "contexte" TEXT,
    "destinataires" JSONB NOT NULL,
    "boutons" JSONB NOT NULL,
    "priorite" INTEGER NOT NULL,
    "bloquant" BOOLEAN NOT NULL DEFAULT false,
    "echeance" TIMESTAMPTZ(3),
    "cle_regroupement" TEXT,
    "cle_unicite" TEXT NOT NULL,
    "statut" "core_action_statut" NOT NULL DEFAULT 'en_attente',
    "decision" TEXT,
    "decidee_par_membership_id" UUID,
    "decidee_at" TIMESTAMPTZ(3),
    "reportee_jusqu_au" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_notification" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "destinataire_membership_id" UUID NOT NULL,
    "alert_id" UUID,
    "domain_event_id" UUID,
    "canal" "core_canal" NOT NULL,
    "titre" TEXT NOT NULL,
    "corps" TEXT,
    "lue_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_notification_pref" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "app" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "canal" "core_canal" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "regroupement" "core_regroupement" NOT NULL DEFAULT 'immediat',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_notification_pref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_domain_event" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "app_emettrice" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "donnees" JSONB NOT NULL,
    "emis_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_domain_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_event_delivery" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "domain_event_id" UUID NOT NULL,
    "app_destinataire" TEXT NOT NULL,
    "statut" "core_delivery_statut" NOT NULL DEFAULT 'en_attente',
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "derniere_erreur" TEXT,
    "traite_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_event_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_sync_cursor" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "curseur" TEXT,
    "derniere_sync_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_sync_cursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_search_index" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "app" TEXT NOT NULL,
    "fiche_type" TEXT NOT NULL,
    "fiche_id" UUID NOT NULL,
    "titre" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "vecteur" tsvector GENERATED ALWAYS AS (to_tsvector('french'::regconfig, coalesce("titre", '') || ' ' || coalesce("texte", ''))) STORED,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_search_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_export" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "demande_par_user_id" UUID NOT NULL,
    "perimetre" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "file_id" UUID,
    "statut" "core_export_statut" NOT NULL DEFAULT 'en_attente',
    "erreur" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_export_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "core_file_storage_key_key" ON "core_file"("storage_key");

-- CreateIndex
CREATE INDEX "core_file_team_id_idx" ON "core_file"("team_id");

-- CreateIndex
CREATE INDEX "core_attachment_team_id_app_fiche_type_fiche_id_idx" ON "core_attachment"("team_id", "app", "fiche_type", "fiche_id");

-- CreateIndex
CREATE INDEX "core_attachment_file_id_idx" ON "core_attachment"("file_id");

-- CreateIndex
CREATE INDEX "core_attachment_team_id_idx" ON "core_attachment"("team_id");

-- CreateIndex
CREATE INDEX "core_activity_team_id_app_fiche_type_fiche_id_idx" ON "core_activity"("team_id", "app", "fiche_type", "fiche_id");

-- CreateIndex
CREATE INDEX "core_activity_auteur_user_id_idx" ON "core_activity"("auteur_user_id");

-- CreateIndex
CREATE INDEX "core_activity_team_id_idx" ON "core_activity"("team_id");

-- CreateIndex
CREATE INDEX "core_note_team_id_app_fiche_type_fiche_id_idx" ON "core_note"("team_id", "app", "fiche_type", "fiche_id");

-- CreateIndex
CREATE INDEX "core_note_auteur_user_id_idx" ON "core_note"("auteur_user_id");

-- CreateIndex
CREATE INDEX "core_note_team_id_idx" ON "core_note"("team_id");

-- CreateIndex
CREATE INDEX "core_task_team_id_statut_idx" ON "core_task"("team_id", "statut");

-- CreateIndex
CREATE INDEX "core_task_assignee_person_id_idx" ON "core_task"("assignee_person_id");

-- CreateIndex
CREATE INDEX "core_task_event_id_idx" ON "core_task"("event_id");

-- CreateIndex
CREATE INDEX "core_task_team_id_idx" ON "core_task"("team_id");

-- CreateIndex
CREATE INDEX "core_alert_team_id_statut_idx" ON "core_alert"("team_id", "statut");

-- CreateIndex
CREATE INDEX "core_alert_team_id_idx" ON "core_alert"("team_id");

-- CreateIndex
CREATE INDEX "core_action_team_id_statut_idx" ON "core_action"("team_id", "statut");

-- CreateIndex
CREATE INDEX "core_action_team_id_cle_regroupement_idx" ON "core_action"("team_id", "cle_regroupement");

-- CreateIndex
CREATE INDEX "core_action_event_id_idx" ON "core_action"("event_id");

-- CreateIndex
CREATE INDEX "core_action_decidee_par_membership_id_idx" ON "core_action"("decidee_par_membership_id");

-- CreateIndex
CREATE INDEX "core_action_team_id_idx" ON "core_action"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "core_action_team_id_cle_unicite_key" ON "core_action"("team_id", "cle_unicite");

-- CreateIndex
CREATE INDEX "core_notification_team_id_idx" ON "core_notification"("team_id");

-- CreateIndex
CREATE INDEX "core_notification_destinataire_membership_id_lue_at_idx" ON "core_notification"("destinataire_membership_id", "lue_at");

-- CreateIndex
CREATE INDEX "core_notification_alert_id_idx" ON "core_notification"("alert_id");

-- CreateIndex
CREATE INDEX "core_notification_domain_event_id_idx" ON "core_notification"("domain_event_id");

-- CreateIndex
CREATE INDEX "core_notification_pref_team_id_idx" ON "core_notification_pref"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "core_notification_pref_membership_id_app_type_canal_key" ON "core_notification_pref"("membership_id", "app", "type", "canal");

-- CreateIndex
CREATE INDEX "core_domain_event_team_id_nom_idx" ON "core_domain_event"("team_id", "nom");

-- CreateIndex
CREATE INDEX "core_domain_event_team_id_emis_at_idx" ON "core_domain_event"("team_id", "emis_at");

-- CreateIndex
CREATE INDEX "core_domain_event_team_id_idx" ON "core_domain_event"("team_id");

-- CreateIndex
CREATE INDEX "core_event_delivery_team_id_idx" ON "core_event_delivery"("team_id");

-- CreateIndex
CREATE INDEX "core_event_delivery_team_id_statut_idx" ON "core_event_delivery"("team_id", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "core_event_delivery_domain_event_id_app_destinataire_key" ON "core_event_delivery"("domain_event_id", "app_destinataire");

-- CreateIndex
CREATE INDEX "core_sync_cursor_team_id_idx" ON "core_sync_cursor"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "core_sync_cursor_device_id_team_id_key" ON "core_sync_cursor"("device_id", "team_id");

-- CreateIndex
CREATE INDEX "core_search_index_team_id_idx" ON "core_search_index"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "core_search_index_team_id_app_fiche_type_fiche_id_key" ON "core_search_index"("team_id", "app", "fiche_type", "fiche_id");

-- Index plein texte : ajouté à la main, Prisma ne le génère pas.
CREATE INDEX "core_search_index_vecteur_idx" ON "core_search_index" USING GIN ("vecteur");

-- CreateIndex
CREATE INDEX "core_export_team_id_idx" ON "core_export"("team_id");

-- CreateIndex
CREATE INDEX "core_export_demande_par_user_id_idx" ON "core_export"("demande_par_user_id");

-- CreateIndex
CREATE INDEX "core_export_file_id_idx" ON "core_export"("file_id");

-- CreateIndex
CREATE INDEX "core_person_photo_file_id_idx" ON "core_person"("photo_file_id");

-- CreateIndex
CREATE INDEX "core_team_logo_file_id_idx" ON "core_team"("logo_file_id");

-- CreateIndex
CREATE INDEX "core_vehicle_photo_file_id_idx" ON "core_vehicle"("photo_file_id");

-- AddForeignKey
ALTER TABLE "core_team" ADD CONSTRAINT "core_team_logo_file_id_fkey" FOREIGN KEY ("logo_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_person" ADD CONSTRAINT "core_person_photo_file_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_vehicle" ADD CONSTRAINT "core_vehicle_photo_file_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_file" ADD CONSTRAINT "core_file_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_attachment" ADD CONSTRAINT "core_attachment_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_attachment" ADD CONSTRAINT "core_attachment_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "core_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_activity" ADD CONSTRAINT "core_activity_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_activity" ADD CONSTRAINT "core_activity_auteur_user_id_fkey" FOREIGN KEY ("auteur_user_id") REFERENCES "core_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_note" ADD CONSTRAINT "core_note_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_note" ADD CONSTRAINT "core_note_auteur_user_id_fkey" FOREIGN KEY ("auteur_user_id") REFERENCES "core_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_task" ADD CONSTRAINT "core_task_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_task" ADD CONSTRAINT "core_task_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_task" ADD CONSTRAINT "core_task_assignee_person_id_fkey" FOREIGN KEY ("assignee_person_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_alert" ADD CONSTRAINT "core_alert_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_action" ADD CONSTRAINT "core_action_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_action" ADD CONSTRAINT "core_action_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_action" ADD CONSTRAINT "core_action_decidee_par_membership_id_fkey" FOREIGN KEY ("decidee_par_membership_id") REFERENCES "core_membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_notification" ADD CONSTRAINT "core_notification_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_notification" ADD CONSTRAINT "core_notification_destinataire_membership_id_fkey" FOREIGN KEY ("destinataire_membership_id") REFERENCES "core_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_notification" ADD CONSTRAINT "core_notification_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "core_alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_notification" ADD CONSTRAINT "core_notification_domain_event_id_fkey" FOREIGN KEY ("domain_event_id") REFERENCES "core_domain_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_notification_pref" ADD CONSTRAINT "core_notification_pref_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_notification_pref" ADD CONSTRAINT "core_notification_pref_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "core_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_domain_event" ADD CONSTRAINT "core_domain_event_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_event_delivery" ADD CONSTRAINT "core_event_delivery_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_event_delivery" ADD CONSTRAINT "core_event_delivery_domain_event_id_fkey" FOREIGN KEY ("domain_event_id") REFERENCES "core_domain_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_sync_cursor" ADD CONSTRAINT "core_sync_cursor_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_sync_cursor" ADD CONSTRAINT "core_sync_cursor_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "core_device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_search_index" ADD CONSTRAINT "core_search_index_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_export" ADD CONSTRAINT "core_export_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_export" ADD CONSTRAINT "core_export_demande_par_user_id_fkey" FOREIGN KEY ("demande_par_user_id") REFERENCES "core_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_export" ADD CONSTRAINT "core_export_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;
