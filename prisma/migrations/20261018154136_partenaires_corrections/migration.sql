-- Corrections de la 3.5 (brief 3.6, point 0.1). Tables partenaires_ seulement, encore vides en production.

-- Dates en jours : on garde le jour UTC, qui est celui que l'application écrit (minuit UTC).
-- AlterTable
ALTER TABLE "partenaires_amendment" ALTER COLUMN "date" SET DATA TYPE DATE USING ("date" AT TIME ZONE 'UTC')::date,
ALTER COLUMN "signe_le" SET DATA TYPE DATE USING ("signe_le" AT TIME ZONE 'UTC')::date;

-- AlterTable
ALTER TABLE "partenaires_proof" ALTER COLUMN "date" SET DATA TYPE DATE USING ("date" AT TIME ZONE 'UTC')::date;

-- AlterTable
ALTER TABLE "partenaires_report" ALTER COLUMN "periode_debut" SET DATA TYPE DATE USING ("periode_debut" AT TIME ZONE 'UTC')::date,
ALTER COLUMN "periode_fin" SET DATA TYPE DATE USING ("periode_fin" AT TIME ZONE 'UTC')::date,
ALTER COLUMN "envoye_le" SET DATA TYPE DATE USING ("envoye_le" AT TIME ZONE 'UTC')::date;

-- Copies à la volée sûres : une seule copie du modèle et une seule liste de base par team.
-- Écrit à la main : Prisma ne sait pas décrire un index unique partiel.
CREATE UNIQUE INDEX "partenaires_template_team_source_cle_key" ON "partenaires_template" ("team_id", "source_cle")
  WHERE "source_cle" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "partenaires_benefit_catalog_team_source_cle_key" ON "partenaires_benefit_catalog" ("team_id", "source_cle")
  WHERE "source_cle" IS NOT NULL AND "deleted_at" IS NULL;
