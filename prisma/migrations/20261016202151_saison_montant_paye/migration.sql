-- AlterTable
ALTER TABLE "saison_registration" ADD COLUMN     "montant_paye" INTEGER;

-- CHECK : le montant payé est positif ou nul (NULL = pas encore payé).
ALTER TABLE "saison_registration" ADD CONSTRAINT "saison_registration_montant_paye_check" CHECK (montant_paye >= 0);
