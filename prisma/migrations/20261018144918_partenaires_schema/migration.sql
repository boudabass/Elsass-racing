-- CreateEnum
CREATE TYPE "partenaires_statut" AS ENUM ('a_contacter', 'contacte', 'relance', 'interesse', 'partenaire', 'ancien_partenaire', 'refus');

-- CreateEnum
CREATE TYPE "partenaires_source" AS ENUM ('reseau', 'demarchage', 'recommandation', 'autre');

-- CreateEnum
CREATE TYPE "partenaires_interaction_type" AS ENUM ('appel', 'mail', 'rencontre', 'courrier', 'autre');

-- CreateEnum
CREATE TYPE "partenaires_agreement_statut" AS ENUM ('brouillon', 'envoyee', 'signee', 'en_cours', 'terminee', 'resiliee');

-- CreateEnum
CREATE TYPE "partenaires_apport_recu" AS ENUM ('non', 'partiel', 'oui');

-- CreateEnum
CREATE TYPE "partenaires_benefit_type" AS ENUM ('logo_voiture', 'publication_reseaux', 'story', 'presence_exposition', 'logo_tenues', 'mention_dossier', 'photo_dediee', 'invitation_epreuve', 'autre');

-- CreateEnum
CREATE TYPE "partenaires_benefit_statut" AS ENUM ('a_faire', 'en_cours', 'tenue', 'reportee');

-- CreateEnum
CREATE TYPE "partenaires_proof_type" AS ENUM ('photo', 'lien', 'capture');

-- CreateTable
CREATE TABLE "partenaires_partner" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "interlocuteur_person_id" UUID,
    "statut" "partenaires_statut" NOT NULL DEFAULT 'a_contacter',
    "source" "partenaires_source",
    "suivi_par_person_id" UUID,
    "prochaine_relance" DATE,
    "logo_file_id" UUID,
    "secteur" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "partenaires_partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partenaires_interaction" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" "partenaires_interaction_type" NOT NULL,
    "resume" TEXT NOT NULL,
    "auteur_person_id" UUID,
    "prochaine_action" TEXT,
    "prochaine_action_le" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "partenaires_interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partenaires_template" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "source_cle" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "partenaires_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partenaires_agreement" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "template_id" UUID,
    "season_id" UUID,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "statut" "partenaires_agreement_statut" NOT NULL DEFAULT 'brouillon',
    "precedente_id" UUID,
    "apport_financier_centimes" INTEGER NOT NULL DEFAULT 0,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "apport_nature_description" TEXT,
    "apport_nature_valeur_centimes" INTEGER,
    "echeancier" JSONB NOT NULL DEFAULT '[]',
    "apport_recu" "partenaires_apport_recu" NOT NULL DEFAULT 'non',
    "document_genere_file_id" UUID,
    "document_signe_file_id" UUID,
    "signee_le" DATE,
    "signataires" TEXT,
    "motif_resiliation" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "partenaires_agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partenaires_amendment" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "motif" TEXT NOT NULL,
    "changements" TEXT NOT NULL,
    "document_file_id" UUID,
    "signe_le" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "partenaires_amendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partenaires_benefit_catalog" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "partenaires_benefit_type" NOT NULL,
    "unite" TEXT NOT NULL,
    "quantite_defaut" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "source_cle" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "partenaires_benefit_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partenaires_benefit" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "catalog_id" UUID,
    "libelle" TEXT NOT NULL,
    "type" "partenaires_benefit_type" NOT NULL,
    "quantite_promise" INTEGER NOT NULL DEFAULT 1,
    "quantite_tenue" INTEGER NOT NULL DEFAULT 0,
    "slot_id" UUID,
    "slot_nom" TEXT,
    "event_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "echeance" DATE,
    "statut" "partenaires_benefit_statut" NOT NULL DEFAULT 'a_faire',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "partenaires_benefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partenaires_proof" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "benefit_id" UUID NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "event_id" UUID,
    "type" "partenaires_proof_type" NOT NULL,
    "file_id" UUID,
    "lien" TEXT,
    "commentaire" TEXT,
    "visible_partenaire" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "partenaires_proof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partenaires_report" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "agreement_id" UUID,
    "periode_debut" TIMESTAMPTZ(3) NOT NULL,
    "periode_fin" TIMESTAMPTZ(3) NOT NULL,
    "file_id" UUID,
    "genere_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoye_le" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "partenaires_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partenaires_portal_link" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "jeton_empreinte" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "expire_le" TIMESTAMPTZ(3),
    "derniere_consultation" TIMESTAMPTZ(3),
    "nb_consultations" INTEGER NOT NULL DEFAULT 0,
    "sections" TEXT[] DEFAULT ARRAY['conventions', 'contreparties', 'preuves', 'calendrier', 'resultats', 'bilans']::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "partenaires_portal_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partenaires_portal_message" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteur_nom" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "lue_le" TIMESTAMPTZ(3),
    "traite_par_person_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "partenaires_portal_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partenaires_partner_team_id_idx" ON "partenaires_partner"("team_id");

-- CreateIndex
CREATE INDEX "partenaires_partner_team_id_deleted_at_idx" ON "partenaires_partner"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "partenaires_partner_contact_id_idx" ON "partenaires_partner"("contact_id");

-- CreateIndex
CREATE INDEX "partenaires_interaction_team_id_idx" ON "partenaires_interaction"("team_id");

-- CreateIndex
CREATE INDEX "partenaires_interaction_team_id_deleted_at_idx" ON "partenaires_interaction"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "partenaires_interaction_partner_id_idx" ON "partenaires_interaction"("partner_id");

-- CreateIndex
CREATE INDEX "partenaires_template_team_id_idx" ON "partenaires_template"("team_id");

-- CreateIndex
CREATE INDEX "partenaires_template_team_id_deleted_at_idx" ON "partenaires_template"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "partenaires_agreement_team_id_idx" ON "partenaires_agreement"("team_id");

-- CreateIndex
CREATE INDEX "partenaires_agreement_team_id_deleted_at_idx" ON "partenaires_agreement"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "partenaires_agreement_partner_id_idx" ON "partenaires_agreement"("partner_id");

-- CreateIndex
CREATE INDEX "partenaires_agreement_season_id_idx" ON "partenaires_agreement"("season_id");

-- CreateIndex
CREATE INDEX "partenaires_amendment_team_id_idx" ON "partenaires_amendment"("team_id");

-- CreateIndex
CREATE INDEX "partenaires_amendment_team_id_deleted_at_idx" ON "partenaires_amendment"("team_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "partenaires_amendment_agreement_id_numero_key" ON "partenaires_amendment"("agreement_id", "numero");

-- CreateIndex
CREATE INDEX "partenaires_benefit_catalog_team_id_idx" ON "partenaires_benefit_catalog"("team_id");

-- CreateIndex
CREATE INDEX "partenaires_benefit_catalog_team_id_deleted_at_idx" ON "partenaires_benefit_catalog"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "partenaires_benefit_team_id_idx" ON "partenaires_benefit"("team_id");

-- CreateIndex
CREATE INDEX "partenaires_benefit_team_id_deleted_at_idx" ON "partenaires_benefit"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "partenaires_benefit_agreement_id_idx" ON "partenaires_benefit"("agreement_id");

-- CreateIndex
CREATE INDEX "partenaires_proof_team_id_idx" ON "partenaires_proof"("team_id");

-- CreateIndex
CREATE INDEX "partenaires_proof_team_id_deleted_at_idx" ON "partenaires_proof"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "partenaires_proof_benefit_id_idx" ON "partenaires_proof"("benefit_id");

-- CreateIndex
CREATE INDEX "partenaires_report_team_id_idx" ON "partenaires_report"("team_id");

-- CreateIndex
CREATE INDEX "partenaires_report_team_id_deleted_at_idx" ON "partenaires_report"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "partenaires_report_partner_id_idx" ON "partenaires_report"("partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "partenaires_portal_link_jeton_empreinte_key" ON "partenaires_portal_link"("jeton_empreinte");

-- CreateIndex
CREATE INDEX "partenaires_portal_link_team_id_idx" ON "partenaires_portal_link"("team_id");

-- CreateIndex
CREATE INDEX "partenaires_portal_link_team_id_deleted_at_idx" ON "partenaires_portal_link"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "partenaires_portal_link_partner_id_idx" ON "partenaires_portal_link"("partner_id");

-- CreateIndex
CREATE INDEX "partenaires_portal_message_team_id_idx" ON "partenaires_portal_message"("team_id");

-- CreateIndex
CREATE INDEX "partenaires_portal_message_team_id_deleted_at_idx" ON "partenaires_portal_message"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "partenaires_portal_message_partner_id_idx" ON "partenaires_portal_message"("partner_id");

-- AddForeignKey
ALTER TABLE "partenaires_partner" ADD CONSTRAINT "partenaires_partner_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_partner" ADD CONSTRAINT "partenaires_partner_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "core_contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_partner" ADD CONSTRAINT "partenaires_partner_interlocuteur_person_id_fkey" FOREIGN KEY ("interlocuteur_person_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_partner" ADD CONSTRAINT "partenaires_partner_suivi_par_person_id_fkey" FOREIGN KEY ("suivi_par_person_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_partner" ADD CONSTRAINT "partenaires_partner_logo_file_id_fkey" FOREIGN KEY ("logo_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_interaction" ADD CONSTRAINT "partenaires_interaction_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_interaction" ADD CONSTRAINT "partenaires_interaction_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partenaires_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_interaction" ADD CONSTRAINT "partenaires_interaction_auteur_person_id_fkey" FOREIGN KEY ("auteur_person_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_template" ADD CONSTRAINT "partenaires_template_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_agreement" ADD CONSTRAINT "partenaires_agreement_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_agreement" ADD CONSTRAINT "partenaires_agreement_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partenaires_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_agreement" ADD CONSTRAINT "partenaires_agreement_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "partenaires_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_agreement" ADD CONSTRAINT "partenaires_agreement_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "core_season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_agreement" ADD CONSTRAINT "partenaires_agreement_precedente_id_fkey" FOREIGN KEY ("precedente_id") REFERENCES "partenaires_agreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_agreement" ADD CONSTRAINT "partenaires_agreement_document_genere_file_id_fkey" FOREIGN KEY ("document_genere_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_agreement" ADD CONSTRAINT "partenaires_agreement_document_signe_file_id_fkey" FOREIGN KEY ("document_signe_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_amendment" ADD CONSTRAINT "partenaires_amendment_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_amendment" ADD CONSTRAINT "partenaires_amendment_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "partenaires_agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_amendment" ADD CONSTRAINT "partenaires_amendment_document_file_id_fkey" FOREIGN KEY ("document_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_benefit_catalog" ADD CONSTRAINT "partenaires_benefit_catalog_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_benefit" ADD CONSTRAINT "partenaires_benefit_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_benefit" ADD CONSTRAINT "partenaires_benefit_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "partenaires_agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_benefit" ADD CONSTRAINT "partenaires_benefit_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "partenaires_benefit_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_proof" ADD CONSTRAINT "partenaires_proof_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_proof" ADD CONSTRAINT "partenaires_proof_benefit_id_fkey" FOREIGN KEY ("benefit_id") REFERENCES "partenaires_benefit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_proof" ADD CONSTRAINT "partenaires_proof_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_proof" ADD CONSTRAINT "partenaires_proof_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_report" ADD CONSTRAINT "partenaires_report_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_report" ADD CONSTRAINT "partenaires_report_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partenaires_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_report" ADD CONSTRAINT "partenaires_report_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "partenaires_agreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_report" ADD CONSTRAINT "partenaires_report_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_portal_link" ADD CONSTRAINT "partenaires_portal_link_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_portal_link" ADD CONSTRAINT "partenaires_portal_link_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partenaires_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_portal_message" ADD CONSTRAINT "partenaires_portal_message_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_portal_message" ADD CONSTRAINT "partenaires_portal_message_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partenaires_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partenaires_portal_message" ADD CONSTRAINT "partenaires_portal_message_traite_par_person_id_fkey" FOREIGN KEY ("traite_par_person_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Instructions ajoutées à la main (Prisma ne sait pas les décrire) : CHECK et index partiels.
ALTER TABLE "partenaires_agreement" ADD CONSTRAINT "partenaires_agreement_montants_check" CHECK ("apport_financier_centimes" >= 0 AND ("apport_nature_valeur_centimes" IS NULL OR "apport_nature_valeur_centimes" >= 0));
ALTER TABLE "partenaires_agreement" ADD CONSTRAINT "partenaires_agreement_dates_check" CHECK ("date_fin" >= "date_debut");
ALTER TABLE "partenaires_benefit" ADD CONSTRAINT "partenaires_benefit_quantite_tenue_check" CHECK ("quantite_tenue" >= 0);
ALTER TABLE "partenaires_proof" ADD CONSTRAINT "partenaires_proof_source_check" CHECK ("file_id" IS NOT NULL OR "lien" IS NOT NULL);
ALTER TABLE "partenaires_portal_message" ADD CONSTRAINT "partenaires_portal_message_texte_check" CHECK (char_length("texte") <= 2000);

-- Un partenaire par entreprise (contact) parmi les lignes non supprimées.
CREATE UNIQUE INDEX "partenaires_partner_team_contact_key" ON "partenaires_partner"("team_id", "contact_id") WHERE "deleted_at" IS NULL;

-- Un seul lien de page actif par partenaire.
CREATE UNIQUE INDEX "partenaires_portal_link_actif_key" ON "partenaires_portal_link"("partner_id") WHERE "actif" AND "deleted_at" IS NULL;

-- Cloisonnement par team, comme voiture_ (RLS forcée).
ALTER TABLE "partenaires_partner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partenaires_partner" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "partenaires_partner" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "partenaires_interaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partenaires_interaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "partenaires_interaction" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "partenaires_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partenaires_template" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "partenaires_template" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "partenaires_agreement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partenaires_agreement" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "partenaires_agreement" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "partenaires_amendment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partenaires_amendment" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "partenaires_amendment" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "partenaires_benefit_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partenaires_benefit_catalog" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "partenaires_benefit_catalog" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "partenaires_benefit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partenaires_benefit" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "partenaires_benefit" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "partenaires_proof" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partenaires_proof" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "partenaires_proof" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "partenaires_report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partenaires_report" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "partenaires_report" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "partenaires_portal_link" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partenaires_portal_link" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "partenaires_portal_link" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "partenaires_portal_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partenaires_portal_message" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "partenaires_portal_message" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
