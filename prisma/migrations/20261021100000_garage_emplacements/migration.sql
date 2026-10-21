-- Emplacements des organes (brief 4.3e, décision 1, option A) : migration de données, sans changement de structure.
-- Un organe par défaut reçoit sa position (moteur, boîte, embrayage : unique ; transmissions : gauche ; freins et
-- amortisseurs : avant gauche ; pneus : train). Chaque voiture qui a des organes reçoit les emplacements manquants.
-- Idempotente : la relancer ne change rien. Aucune ligne n'est supprimée.
-- Un organe sans position n'en reçoit une que si l'emplacement est libre sur la voiture ; sinon il reste sans position.
-- Un emplacement n'est jamais recréé si la ligne a déjà existé (même supprimée), ni sur un type dont une ligne sans position a été retirée.

UPDATE "garage_vehicle_component" AS v
SET "position" = e."position", "updated_at" = now(), "rev" = v."rev" + 1
FROM "garage_component_type" AS t
JOIN (VALUES ('moteur', 'unique'), ('boite', 'unique'), ('embrayage', 'unique'), ('transmissions', 'gauche'), ('freins', 'avant_gauche'), ('amortisseurs', 'avant_gauche'), ('pneus', 'train')) AS e("cle", "position") ON e."cle" = t."cle"
WHERE t."id" = v."component_type_id"
  AND v."position" IS NULL
  AND v."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "garage_vehicle_component" AS x
    WHERE x."vehicle_id" = v."vehicle_id"
      AND x."component_type_id" = v."component_type_id"
      AND x."position" = e."position"
      AND x."deleted_at" IS NULL
  );

INSERT INTO "garage_vehicle_component" ("id", "team_id", "vehicle_id", "component_type_id", "position", "mode_usure", "seuil_orange_pct", "seuil_rouge_pct", "created_at", "updated_at", "rev")
SELECT gen_random_uuid(), v."team_id", v."vehicle_id", t."id", e."position", 'les_deux', 30, 10, now(), now(), 1
FROM (SELECT DISTINCT "team_id", "vehicle_id" FROM "garage_vehicle_component" WHERE "deleted_at" IS NULL) AS v
JOIN "garage_component_type" AS t ON t."team_id" = v."team_id" AND t."deleted_at" IS NULL
JOIN (VALUES ('moteur', 'unique'), ('boite', 'unique'), ('embrayage', 'unique'), ('transmissions', 'gauche'), ('transmissions', 'droite'), ('freins', 'avant_gauche'), ('freins', 'avant_droit'), ('freins', 'arriere_gauche'), ('freins', 'arriere_droit'), ('amortisseurs', 'avant_gauche'), ('amortisseurs', 'avant_droit'), ('amortisseurs', 'arriere_gauche'), ('amortisseurs', 'arriere_droit'), ('pneus', 'train')) AS e("cle", "position") ON e."cle" = t."cle"
WHERE NOT EXISTS (
    SELECT 1 FROM "garage_vehicle_component" AS x
    WHERE x."vehicle_id" = v."vehicle_id"
      AND x."component_type_id" = t."id"
      AND x."position" = e."position"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "garage_vehicle_component" AS x
    WHERE x."vehicle_id" = v."vehicle_id"
      AND x."component_type_id" = t."id"
      AND x."position" IS NULL
      AND x."deleted_at" IS NOT NULL
  );
