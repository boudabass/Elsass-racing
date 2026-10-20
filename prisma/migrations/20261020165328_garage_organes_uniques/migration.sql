-- Correction E (validée le 20/10) : un seul organe actif par type et par position sur un véhicule.
-- NULLS NOT DISTINCT : deux organes sans position du même type ne peuvent pas coexister (course à l'initialisation).
-- Deux « Freins » avec des positions différentes restent possibles. PostgreSQL 15 ou plus.
CREATE UNIQUE INDEX "garage_vehicle_component_organe_actif_key" ON "garage_vehicle_component"("vehicle_id", "component_type_id", "position") NULLS NOT DISTINCT WHERE "deleted_at" IS NULL;
