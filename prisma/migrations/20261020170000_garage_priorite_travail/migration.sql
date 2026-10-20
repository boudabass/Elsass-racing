-- Priorité d'un ordre de travail (tâche 4.3, §1, décision de John du 20/10) : basse, normale, haute.
-- Migration additive : une colonne avec défaut, les ordres existants passent en « normale ».
CREATE TYPE "garage_priorite_travail" AS ENUM ('basse', 'normale', 'haute');

ALTER TABLE "garage_work_order" ADD COLUMN "priorite" "garage_priorite_travail" NOT NULL DEFAULT 'normale';
