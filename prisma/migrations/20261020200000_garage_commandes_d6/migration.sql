-- Commandes de pièces (tâche 4.3, décision D6) : migration additive.
-- Une ligne de commande porte l'organe et la qualité attendus. La pièce créée à la réception
-- garde le lien vers sa ligne. garage_purchase_line.part_id reste en place mais ne sert plus.
-- component_type_id reste facultatif en base : il est exigé à la réception (règle applicative).
ALTER TABLE "garage_purchase_line" ADD COLUMN "component_type_id" UUID;
ALTER TABLE "garage_purchase_line" ADD COLUMN "qualite" "garage_qualite_piece" NOT NULL DEFAULT 'origine';

ALTER TABLE "garage_part" ADD COLUMN "commande_ligne_id" UUID;

-- CreateIndex
CREATE INDEX "garage_purchase_line_component_type_id_idx" ON "garage_purchase_line"("component_type_id");

-- CreateIndex
CREATE INDEX "garage_part_commande_ligne_id_idx" ON "garage_part"("commande_ligne_id");

-- AddForeignKey
ALTER TABLE "garage_purchase_line" ADD CONSTRAINT "garage_purchase_line_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "garage_component_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_part" ADD CONSTRAINT "garage_part_commande_ligne_id_fkey" FOREIGN KEY ("commande_ligne_id") REFERENCES "garage_purchase_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;
