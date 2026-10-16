-- CreateEnum
CREATE TYPE "budget_sens" AS ENUM ('depense', 'recette');

-- CreateEnum
CREATE TYPE "budget_type_payeur" AS ENUM ('membre', 'caisse_team', 'compte_association');

-- CreateEnum
CREATE TYPE "budget_moyen" AS ENUM ('carte', 'especes', 'cheque', 'virement');

-- CreateEnum
CREATE TYPE "budget_remboursement" AS ENUM ('non_concerne', 'a_rembourser', 'partiel', 'rembourse');

-- CreateEnum
CREATE TYPE "budget_origine" AS ENUM ('saisie', 'proposee');

-- CreateEnum
CREATE TYPE "budget_statut_recette" AS ENUM ('prevue', 'encaissee');

-- CreateEnum
CREATE TYPE "budget_statut_suggestion" AS ENUM ('en_attente', 'confirmee', 'ignoree');

-- CreateTable
CREATE TABLE "budget_category" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "sens" "budget_sens" NOT NULL,
    "parent_id" UUID,
    "couleur" TEXT,
    "icone" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "budget_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_payer" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "type" "budget_type_payeur" NOT NULL,
    "person_id" UUID,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "budget_payer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_expense" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "montant" INTEGER NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "category_id" UUID NOT NULL,
    "libelle" TEXT NOT NULL,
    "payer_id" UUID NOT NULL,
    "moyen" "budget_moyen",
    "fournisseur_contact_id" UUID,
    "season_id" UUID,
    "event_id" UUID,
    "entry_id" UUID,
    "vehicle_id" UUID,
    "confirmee" BOOLEAN NOT NULL DEFAULT false,
    "a_rembourser" BOOLEAN NOT NULL DEFAULT false,
    "remboursement" "budget_remboursement" NOT NULL DEFAULT 'non_concerne',
    "origine" "budget_origine" NOT NULL DEFAULT 'saisie',
    "origine_ref" TEXT,
    "justificatif_file_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "budget_expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_income" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "montant" INTEGER NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "category_id" UUID NOT NULL,
    "libelle" TEXT NOT NULL,
    "provenance_contact_id" UUID,
    "provenance_person_id" UUID,
    "en_nature" BOOLEAN NOT NULL DEFAULT false,
    "description_nature" TEXT,
    "valeur_estimee" INTEGER,
    "statut" "budget_statut_recette" NOT NULL DEFAULT 'prevue',
    "encaissee_le" DATE,
    "encaissee_sur_payer_id" UUID,
    "season_id" UUID,
    "event_id" UUID,
    "origine" "budget_origine" NOT NULL DEFAULT 'saisie',
    "origine_ref" TEXT,
    "justificatif_file_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "budget_income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_forecast" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "event_id" UUID,
    "montant" INTEGER NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "commentaire" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "budget_forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_reimbursement" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "montant" INTEGER NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "date" DATE NOT NULL,
    "moyen" "budget_moyen" NOT NULL,
    "payer_id" UUID NOT NULL,
    "commentaire" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "budget_reimbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_reimbursement_line" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "reimbursement_id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "montant" INTEGER NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "budget_reimbursement_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_suggestion" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "app_origine" TEXT NOT NULL,
    "evenement_origine" TEXT NOT NULL,
    "sens" "budget_sens" NOT NULL,
    "montant" INTEGER NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "category_id" UUID NOT NULL,
    "libelle" TEXT NOT NULL,
    "event_id" UUID,
    "entry_id" UUID,
    "statut" "budget_statut_suggestion" NOT NULL DEFAULT 'en_attente',
    "mouvement_id" UUID,
    "action_cle" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "budget_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_category_team_id_idx" ON "budget_category"("team_id");

-- CreateIndex
CREATE INDEX "budget_category_team_id_deleted_at_idx" ON "budget_category"("team_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "budget_category_team_id_sens_nom_key" ON "budget_category"("team_id", "sens", "nom");

-- CreateIndex
CREATE INDEX "budget_payer_team_id_idx" ON "budget_payer"("team_id");

-- CreateIndex
CREATE INDEX "budget_payer_team_id_deleted_at_idx" ON "budget_payer"("team_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "budget_payer_team_id_person_id_key" ON "budget_payer"("team_id", "person_id");

-- CreateIndex
CREATE INDEX "budget_expense_team_id_idx" ON "budget_expense"("team_id");

-- CreateIndex
CREATE INDEX "budget_expense_team_id_deleted_at_idx" ON "budget_expense"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "budget_expense_team_id_payer_id_idx" ON "budget_expense"("team_id", "payer_id");

-- CreateIndex
CREATE INDEX "budget_expense_team_id_category_id_season_id_idx" ON "budget_expense"("team_id", "category_id", "season_id");

-- CreateIndex
CREATE INDEX "budget_income_team_id_idx" ON "budget_income"("team_id");

-- CreateIndex
CREATE INDEX "budget_income_team_id_deleted_at_idx" ON "budget_income"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "budget_income_team_id_statut_idx" ON "budget_income"("team_id", "statut");

-- CreateIndex
CREATE INDEX "budget_forecast_team_id_idx" ON "budget_forecast"("team_id");

-- CreateIndex
CREATE INDEX "budget_forecast_team_id_deleted_at_idx" ON "budget_forecast"("team_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "budget_forecast_season_id_category_id_event_id_key" ON "budget_forecast"("season_id", "category_id", "event_id");

-- CreateIndex
CREATE INDEX "budget_reimbursement_team_id_idx" ON "budget_reimbursement"("team_id");

-- CreateIndex
CREATE INDEX "budget_reimbursement_team_id_deleted_at_idx" ON "budget_reimbursement"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "budget_reimbursement_line_team_id_idx" ON "budget_reimbursement_line"("team_id");

-- CreateIndex
CREATE INDEX "budget_reimbursement_line_team_id_deleted_at_idx" ON "budget_reimbursement_line"("team_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "budget_reimbursement_line_reimbursement_id_expense_id_key" ON "budget_reimbursement_line"("reimbursement_id", "expense_id");

-- CreateIndex
CREATE INDEX "budget_suggestion_team_id_idx" ON "budget_suggestion"("team_id");

-- CreateIndex
CREATE INDEX "budget_suggestion_team_id_deleted_at_idx" ON "budget_suggestion"("team_id", "deleted_at");

-- CreateIndex
CREATE INDEX "budget_suggestion_team_id_statut_idx" ON "budget_suggestion"("team_id", "statut");

-- AddForeignKey
ALTER TABLE "budget_category" ADD CONSTRAINT "budget_category_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_category" ADD CONSTRAINT "budget_category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "budget_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_payer" ADD CONSTRAINT "budget_payer_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_payer" ADD CONSTRAINT "budget_payer_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_expense" ADD CONSTRAINT "budget_expense_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_expense" ADD CONSTRAINT "budget_expense_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "budget_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_expense" ADD CONSTRAINT "budget_expense_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "budget_payer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_expense" ADD CONSTRAINT "budget_expense_fournisseur_contact_id_fkey" FOREIGN KEY ("fournisseur_contact_id") REFERENCES "core_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_expense" ADD CONSTRAINT "budget_expense_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "core_season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_expense" ADD CONSTRAINT "budget_expense_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_expense" ADD CONSTRAINT "budget_expense_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "core_event_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_expense" ADD CONSTRAINT "budget_expense_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "core_vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_expense" ADD CONSTRAINT "budget_expense_justificatif_file_id_fkey" FOREIGN KEY ("justificatif_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_income" ADD CONSTRAINT "budget_income_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_income" ADD CONSTRAINT "budget_income_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "budget_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_income" ADD CONSTRAINT "budget_income_provenance_contact_id_fkey" FOREIGN KEY ("provenance_contact_id") REFERENCES "core_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_income" ADD CONSTRAINT "budget_income_provenance_person_id_fkey" FOREIGN KEY ("provenance_person_id") REFERENCES "core_person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_income" ADD CONSTRAINT "budget_income_encaissee_sur_payer_id_fkey" FOREIGN KEY ("encaissee_sur_payer_id") REFERENCES "budget_payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_income" ADD CONSTRAINT "budget_income_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "core_season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_income" ADD CONSTRAINT "budget_income_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_income" ADD CONSTRAINT "budget_income_justificatif_file_id_fkey" FOREIGN KEY ("justificatif_file_id") REFERENCES "core_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_forecast" ADD CONSTRAINT "budget_forecast_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_forecast" ADD CONSTRAINT "budget_forecast_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "core_season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_forecast" ADD CONSTRAINT "budget_forecast_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "budget_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_forecast" ADD CONSTRAINT "budget_forecast_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_reimbursement" ADD CONSTRAINT "budget_reimbursement_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_reimbursement" ADD CONSTRAINT "budget_reimbursement_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_reimbursement" ADD CONSTRAINT "budget_reimbursement_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "budget_payer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_reimbursement_line" ADD CONSTRAINT "budget_reimbursement_line_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_reimbursement_line" ADD CONSTRAINT "budget_reimbursement_line_reimbursement_id_fkey" FOREIGN KEY ("reimbursement_id") REFERENCES "budget_reimbursement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_reimbursement_line" ADD CONSTRAINT "budget_reimbursement_line_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "budget_expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_suggestion" ADD CONSTRAINT "budget_suggestion_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_suggestion" ADD CONSTRAINT "budget_suggestion_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "budget_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_suggestion" ADD CONSTRAINT "budget_suggestion_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_suggestion" ADD CONSTRAINT "budget_suggestion_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "core_event_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Instructions ajoutées à la main (prisma ne sait pas les décrire) : CHECK et index partiel.
ALTER TABLE "budget_payer" ADD CONSTRAINT "budget_payer_membre_personne_check" CHECK (("type" = 'membre') = ("person_id" IS NOT NULL));
ALTER TABLE "budget_expense" ADD CONSTRAINT "budget_expense_montant_check" CHECK ("montant" >= 0);
ALTER TABLE "budget_income" ADD CONSTRAINT "budget_income_montant_check" CHECK ("montant" >= 0);
ALTER TABLE "budget_income" ADD CONSTRAINT "budget_income_valeur_estimee_check" CHECK ("valeur_estimee" IS NULL OR "valeur_estimee" >= 0);
ALTER TABLE "budget_forecast" ADD CONSTRAINT "budget_forecast_montant_check" CHECK ("montant" >= 0);
ALTER TABLE "budget_reimbursement" ADD CONSTRAINT "budget_reimbursement_montant_check" CHECK ("montant" >= 0);
ALTER TABLE "budget_reimbursement_line" ADD CONSTRAINT "budget_reimbursement_line_montant_check" CHECK ("montant" >= 0);
ALTER TABLE "budget_suggestion" ADD CONSTRAINT "budget_suggestion_montant_check" CHECK ("montant" >= 0);

-- Un prévisionnel par catégorie et par saison, sans épreuve : PostgreSQL ne voit pas deux NULL comme égaux.
CREATE UNIQUE INDEX "budget_forecast_season_id_category_id_sans_epreuve_key" ON "budget_forecast"("season_id", "category_id") WHERE "event_id" IS NULL;

-- Cloisonnement par team (RLS), comme les autres apps.
ALTER TABLE "budget_category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_category" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "budget_category" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "budget_payer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_payer" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "budget_payer" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "budget_expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_expense" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "budget_expense" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "budget_income" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_income" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "budget_income" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "budget_forecast" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_forecast" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "budget_forecast" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "budget_reimbursement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_reimbursement" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "budget_reimbursement" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "budget_reimbursement_line" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_reimbursement_line" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "budget_reimbursement_line" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "budget_suggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_suggestion" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "budget_suggestion" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
