-- CreateEnum
CREATE TYPE "saison_paiement_mode" AS ENUM ('cheque', 'virement', 'en_ligne');

-- CreateEnum
CREATE TYPE "saison_readiness_point" AS ENUM ('paiement', 'licences', 'homologations', 'papiers', 'pieces');

-- CreateEnum
CREATE TYPE "saison_readiness_statut" AS ENUM ('regle', 'ouvert');

-- CreateEnum
CREATE TYPE "saison_result_statut" AS ENUM ('arrivee', 'abandon', 'exclusion', 'forfait');

-- CreateEnum
CREATE TYPE "saison_result_validation" AS ENUM ('saisi', 'a_verifier', 'valide', 'conteste');

-- CreateEnum
CREATE TYPE "saison_stage_type" AS ENUM ('speciale', 'manche_slalom', 'montee');

-- CreateEnum
CREATE TYPE "saison_schedule_type" AS ENUM ('verif_administratives', 'verif_techniques', 'shakedown', 'depart', 'passage_speciale', 'regroupement', 'assistance', 'arrivee', 'remise_des_prix');

-- CreateEnum
CREATE TYPE "saison_generated_doc_type" AS ENUM ('bulletin_engagement', 'demande_assistance', 'declaration_vehicule_reco', 'autorisation_proprietaire');

-- CreateTable
CREATE TABLE "saison_event_info" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "asa_contact_id" UUID,
    "championnat" TEXT,
    "reglement_file_id" UUID,
    "lien_resultats" TEXT,
    "engagements_ouverture" DATE,
    "engagements_cloture" DATE,
    "tarif_normal" INTEGER,
    "tarif_licencie_asa" INTEGER,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "geolocalisation_incluse" BOOLEAN NOT NULL DEFAULT false,
    "nb_speciales" INTEGER,
    "km_chronometres_prevus" DECIMAL(6,1),
    "km_total" DECIMAL(6,1),
    "lieu_parc_assistance" TEXT,
    "adresse_envoi_dossier" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saison_event_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saison_registration" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "concurrent_person_id" UUID,
    "concurrent_nom" TEXT,
    "montant_du" INTEGER,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "mode_paiement" "saison_paiement_mode",
    "paye_le" DATE,
    "payeur_person_id" UUID,
    "reference" TEXT,
    "dossier_envoye_le" TIMESTAMPTZ(3),
    "confirmation_recue_le" TIMESTAMPTZ(3),
    "liste_engages_publiee" BOOLEAN NOT NULL DEFAULT false,
    "remarques" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saison_registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saison_readiness" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "point" "saison_readiness_point" NOT NULL,
    "statut" "saison_readiness_statut" NOT NULL,
    "detail" TEXT,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saison_readiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saison_recce" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "debut_autorise" TIMESTAMPTZ(3),
    "fin_autorisee" TIMESTAMPTZ(3),
    "passages_autorises" INTEGER,
    "vitesse_max" INTEGER,
    "vehicule_id" UUID,
    "plaque_recue" BOOLEAN NOT NULL DEFAULT false,
    "consignes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saison_recce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saison_recce_session" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "recce_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "personnes" UUID[] DEFAULT ARRAY[]::UUID[],
    "speciales" UUID[] DEFAULT ARRAY[]::UUID[],
    "passages" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saison_recce_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saison_stage" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "longueur_km" DECIMAL(5,2),
    "nb_passages" INTEGER,
    "type" "saison_stage_type" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saison_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saison_schedule_item" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "type" "saison_schedule_type" NOT NULL,
    "stage_id" UUID,
    "numero_passage" INTEGER,
    "heure_prevue" TIMESTAMPTZ(3),
    "lieu" TEXT,
    "entry_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saison_schedule_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saison_result" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "statut_final" "saison_result_statut" NOT NULL,
    "cause_abandon" TEXT,
    "stage_abandon_id" UUID,
    "classement_general" INTEGER,
    "nb_classes" INTEGER,
    "classement_groupe" INTEGER,
    "classement_classe" INTEGER,
    "nb_partants_classe" INTEGER,
    "temps_total_ms" INTEGER,
    "penalites_ms" INTEGER,
    "km_chronometres" DECIMAL(6,1),
    "public" BOOLEAN NOT NULL DEFAULT true,
    "validation" "saison_result_validation" NOT NULL DEFAULT 'saisi',
    "preuve_lien" TEXT,
    "preuve_file_id" UUID,
    "saisi_par_membership_id" UUID,
    "valide_par_membership_id" UUID,
    "valide_le" TIMESTAMPTZ(3),
    "commentaire_contestation" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saison_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saison_debrief" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "auteur_membership_id" UUID NOT NULL,
    "ressenti" INTEGER NOT NULL,
    "points_positifs" TEXT,
    "points_a_ameliorer" TEXT,
    "problemes_voiture" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saison_debrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saison_generated_doc" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "type" "saison_generated_doc_type" NOT NULL,
    "file_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "genere_le" TIMESTAMPTZ(3) NOT NULL,
    "envoye_le" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saison_generated_doc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saison_championship" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "organisateur" TEXT,
    "lien_classement" TEXT,
    "suivi_actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saison_championship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saison_standing" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "championship_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "points" DECIMAL(6,1) NOT NULL,
    "position" INTEGER,
    "mis_a_jour_le" TIMESTAMPTZ(3),
    "source_lien" TEXT,
    "source_file_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saison_standing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saison_event_info_event_id_key" ON "saison_event_info"("event_id");

-- CreateIndex
CREATE INDEX "saison_event_info_team_id_idx" ON "saison_event_info"("team_id");

-- CreateIndex
CREATE INDEX "saison_event_info_team_id_deleted_at_idx" ON "saison_event_info"("team_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "saison_registration_entry_id_key" ON "saison_registration"("entry_id");

-- CreateIndex
CREATE INDEX "saison_registration_team_id_idx" ON "saison_registration"("team_id");

-- CreateIndex
CREATE INDEX "saison_registration_team_id_deleted_at_idx" ON "saison_registration"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "saison_readiness_team_id_idx" ON "saison_readiness"("team_id");

-- CreateIndex
CREATE INDEX "saison_readiness_team_id_deleted_at_idx" ON "saison_readiness"("team_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "saison_readiness_entry_id_point_key" ON "saison_readiness"("entry_id", "point");

-- CreateIndex
CREATE UNIQUE INDEX "saison_recce_event_id_key" ON "saison_recce"("event_id");

-- CreateIndex
CREATE INDEX "saison_recce_team_id_idx" ON "saison_recce"("team_id");

-- CreateIndex
CREATE INDEX "saison_recce_team_id_deleted_at_idx" ON "saison_recce"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "saison_recce_session_team_id_idx" ON "saison_recce_session"("team_id");

-- CreateIndex
CREATE INDEX "saison_recce_session_team_id_deleted_at_idx" ON "saison_recce_session"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "saison_stage_team_id_idx" ON "saison_stage"("team_id");

-- CreateIndex
CREATE INDEX "saison_stage_team_id_deleted_at_idx" ON "saison_stage"("team_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "saison_stage_event_id_numero_key" ON "saison_stage"("event_id", "numero");

-- CreateIndex
CREATE INDEX "saison_schedule_item_team_id_idx" ON "saison_schedule_item"("team_id");

-- CreateIndex
CREATE INDEX "saison_schedule_item_team_id_deleted_at_idx" ON "saison_schedule_item"("team_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "saison_result_entry_id_key" ON "saison_result"("entry_id");

-- CreateIndex
CREATE INDEX "saison_result_team_id_idx" ON "saison_result"("team_id");

-- CreateIndex
CREATE INDEX "saison_result_team_id_deleted_at_idx" ON "saison_result"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "saison_debrief_team_id_idx" ON "saison_debrief"("team_id");

-- CreateIndex
CREATE INDEX "saison_debrief_team_id_deleted_at_idx" ON "saison_debrief"("team_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "saison_debrief_entry_id_auteur_membership_id_key" ON "saison_debrief"("entry_id", "auteur_membership_id");

-- CreateIndex
CREATE INDEX "saison_generated_doc_team_id_idx" ON "saison_generated_doc"("team_id");

-- CreateIndex
CREATE INDEX "saison_generated_doc_team_id_deleted_at_idx" ON "saison_generated_doc"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "saison_championship_team_id_idx" ON "saison_championship"("team_id");

-- CreateIndex
CREATE INDEX "saison_championship_team_id_deleted_at_idx" ON "saison_championship"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "saison_standing_team_id_idx" ON "saison_standing"("team_id");

-- CreateIndex
CREATE INDEX "saison_standing_team_id_deleted_at_idx" ON "saison_standing"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "saison_standing_championship_id_idx" ON "saison_standing"("championship_id");

-- AddForeignKey
ALTER TABLE "saison_event_info" ADD CONSTRAINT "saison_event_info_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_event_info" ADD CONSTRAINT "saison_event_info_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_event_info" ADD CONSTRAINT "saison_event_info_asa_contact_id_fkey" FOREIGN KEY ("asa_contact_id") REFERENCES "core_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_event_info" ADD CONSTRAINT "saison_event_info_reglement_file_id_fkey" FOREIGN KEY ("reglement_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_registration" ADD CONSTRAINT "saison_registration_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_registration" ADD CONSTRAINT "saison_registration_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "core_event_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_registration" ADD CONSTRAINT "saison_registration_concurrent_person_id_fkey" FOREIGN KEY ("concurrent_person_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_registration" ADD CONSTRAINT "saison_registration_payeur_person_id_fkey" FOREIGN KEY ("payeur_person_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_readiness" ADD CONSTRAINT "saison_readiness_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_readiness" ADD CONSTRAINT "saison_readiness_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "core_event_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_recce" ADD CONSTRAINT "saison_recce_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_recce" ADD CONSTRAINT "saison_recce_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_recce" ADD CONSTRAINT "saison_recce_vehicule_id_fkey" FOREIGN KEY ("vehicule_id") REFERENCES "core_vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_recce_session" ADD CONSTRAINT "saison_recce_session_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_recce_session" ADD CONSTRAINT "saison_recce_session_recce_id_fkey" FOREIGN KEY ("recce_id") REFERENCES "saison_recce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_stage" ADD CONSTRAINT "saison_stage_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_stage" ADD CONSTRAINT "saison_stage_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_schedule_item" ADD CONSTRAINT "saison_schedule_item_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_schedule_item" ADD CONSTRAINT "saison_schedule_item_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_schedule_item" ADD CONSTRAINT "saison_schedule_item_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "saison_stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_schedule_item" ADD CONSTRAINT "saison_schedule_item_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "core_event_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_result" ADD CONSTRAINT "saison_result_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_result" ADD CONSTRAINT "saison_result_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "core_event_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_result" ADD CONSTRAINT "saison_result_stage_abandon_id_fkey" FOREIGN KEY ("stage_abandon_id") REFERENCES "saison_stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_result" ADD CONSTRAINT "saison_result_preuve_file_id_fkey" FOREIGN KEY ("preuve_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_result" ADD CONSTRAINT "saison_result_saisi_par_membership_id_fkey" FOREIGN KEY ("saisi_par_membership_id") REFERENCES "core_membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_result" ADD CONSTRAINT "saison_result_valide_par_membership_id_fkey" FOREIGN KEY ("valide_par_membership_id") REFERENCES "core_membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_debrief" ADD CONSTRAINT "saison_debrief_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_debrief" ADD CONSTRAINT "saison_debrief_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "core_event_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_debrief" ADD CONSTRAINT "saison_debrief_auteur_membership_id_fkey" FOREIGN KEY ("auteur_membership_id") REFERENCES "core_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_generated_doc" ADD CONSTRAINT "saison_generated_doc_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_generated_doc" ADD CONSTRAINT "saison_generated_doc_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "core_event_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_generated_doc" ADD CONSTRAINT "saison_generated_doc_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "core_file"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_championship" ADD CONSTRAINT "saison_championship_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_championship" ADD CONSTRAINT "saison_championship_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "core_season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_standing" ADD CONSTRAINT "saison_standing_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_standing" ADD CONSTRAINT "saison_standing_championship_id_fkey" FOREIGN KEY ("championship_id") REFERENCES "saison_championship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_standing" ADD CONSTRAINT "saison_standing_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saison_standing" ADD CONSTRAINT "saison_standing_source_file_id_fkey" FOREIGN KEY ("source_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS : les douze tables portent team_id, donc cloisonnées comme settings_* (cf. core_rls).
ALTER TABLE "saison_event_info" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saison_event_info" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "saison_event_info" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "saison_registration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saison_registration" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "saison_registration" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "saison_readiness" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saison_readiness" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "saison_readiness" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "saison_recce" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saison_recce" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "saison_recce" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "saison_recce_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saison_recce_session" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "saison_recce_session" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "saison_stage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saison_stage" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "saison_stage" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "saison_schedule_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saison_schedule_item" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "saison_schedule_item" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "saison_result" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saison_result" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "saison_result" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "saison_debrief" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saison_debrief" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "saison_debrief" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "saison_generated_doc" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saison_generated_doc" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "saison_generated_doc" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "saison_championship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saison_championship" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "saison_championship" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "saison_standing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saison_standing" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "saison_standing" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

-- CHECK : le ressenti est une note de 1 à 5 ; les montants sont positifs ou nuls (NULL = non renseigné).
ALTER TABLE "saison_debrief" ADD CONSTRAINT "saison_debrief_ressenti_check" CHECK (ressenti BETWEEN 1 AND 5);
ALTER TABLE "saison_event_info" ADD CONSTRAINT "saison_event_info_tarifs_check" CHECK (tarif_normal >= 0 AND tarif_licencie_asa >= 0);
ALTER TABLE "saison_registration" ADD CONSTRAINT "saison_registration_montant_du_check" CHECK (montant_du >= 0);
