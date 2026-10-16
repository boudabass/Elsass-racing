-- CreateEnum
CREATE TYPE "core_team_statut" AS ENUM ('active', 'suspendue');

-- CreateTable
CREATE TABLE "core_team" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_file_id" UUID,
    "couleur_principale" TEXT,
    "couleur_secondaire" TEXT,
    "discipline_principale" TEXT,
    "association_nom" TEXT,
    "association_rna" TEXT,
    "association_siege" TEXT,
    "fuseau" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "statut" "core_team_statut" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "core_team_slug_key" ON "core_team"("slug");
