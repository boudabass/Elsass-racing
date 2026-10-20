-- Liaison Partenaires vers Budget (brief 3.8, §2.1) : une proposition porte la date de son mouvement (le versement
-- d'une convention) et sa référence d'origine (partenaires:<agreementId>:<n>). Les deux colonnes sont facultatives :
-- les propositions de Saison et de Budget existantes restent telles quelles.
ALTER TABLE "budget_suggestion" ADD COLUMN "date" DATE,
  ADD COLUMN "origine_ref" TEXT;

-- Pour retrouver une proposition déjà faite pour une référence (pas de doublon).
CREATE INDEX "budget_suggestion_team_id_origine_ref_idx" ON "budget_suggestion"("team_id", "origine_ref");
