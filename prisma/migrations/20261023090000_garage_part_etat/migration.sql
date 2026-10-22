-- État saisi après réparation (954 v1.3, §3 et §4 ; brief 4.3e, section 6) : une table nouvelle, un journal, une ligne par
-- saisie. Aucune table existante n'est modifiée. Migration écrite à la main, comme les migrations du Garage précédentes.
-- L'état courant d'une pièce part de sa dernière ligne (saisi_le) ; l'usure qui suit la fait baisser (km ou épreuves).
-- Pourcentage entier, de 0 à 100. Les km et les épreuves sont ceux de la pièce au moment de la saisie.

CREATE TABLE "garage_part_etat" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "etat_pct" INTEGER NOT NULL,
    "km_au_saisie" DECIMAL(8,1) NOT NULL DEFAULT 0,
    "epreuves_au_saisie" INTEGER NOT NULL DEFAULT 0,
    "saisi_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "garage_part_etat_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "garage_part_etat_etat_pct_check" CHECK ("etat_pct" BETWEEN 0 AND 100),
    CONSTRAINT "garage_part_etat_usure_check" CHECK ("km_au_saisie" >= 0 AND "epreuves_au_saisie" >= 0)
);

CREATE INDEX "garage_part_etat_team_id_idx" ON "garage_part_etat"("team_id");
CREATE INDEX "garage_part_etat_part_id_saisi_le_idx" ON "garage_part_etat"("part_id", "saisi_le");

ALTER TABLE "garage_part_etat" ADD CONSTRAINT "garage_part_etat_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "garage_part_etat" ADD CONSTRAINT "garage_part_etat_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "garage_part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "garage_part_etat" ADD CONSTRAINT "garage_part_etat_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "garage_work_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "garage_part_etat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "garage_part_etat" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "garage_part_etat" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
