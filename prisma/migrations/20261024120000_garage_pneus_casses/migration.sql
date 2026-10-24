-- Tâche 4.4, étape 1 (brief §2, §3 et §5).
-- Un seul train de pneus monté par organe : deux montages simultanés ne donnent qu'un train monté.
CREATE UNIQUE INDEX "garage_tyre_set_monte_key" ON "garage_tyre_set"("vehicle_component_id") WHERE "vehicle_component_id" IS NOT NULL AND "deleted_at" IS NULL;

-- Une fiche casse par engagement : un résultat contesté puis revalidé ne crée pas de seconde fiche.
CREATE UNIQUE INDEX "garage_incident_engagement_key" ON "garage_incident"("event_entry_id") WHERE "event_entry_id" IS NOT NULL AND "deleted_at" IS NULL;

-- Option A (John, 24/10) : une fiche créée par un abandon reste sans type, « à compléter ».
ALTER TABLE "garage_incident" ALTER COLUMN "type" DROP NOT NULL;
