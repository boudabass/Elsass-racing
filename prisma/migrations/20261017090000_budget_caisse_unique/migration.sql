-- Une seule caisse de team (tâche 2.8). Deux initialisations concurrentes ont pu créer deux « Caisse de la team ».
-- 1. Fusion des doublons : pour chaque caisse en double, on rattache ses lignes à la plus ancienne caisse active de
--    sa team, puis on supprime le doublon en douceur (deleted_at). Rien n'est détruit.
-- 2. Index unique partiel : Prisma ne sait pas le décrire, il vit uniquement dans cette migration.
-- Chaque instruction se suffit à elle-même (pas de table temporaire : Prisma peut changer de connexion entre deux).
-- La caisse à garder est recalculée dans chaque instruction ; les doublons ne sont supprimés qu'en dernier.

UPDATE budget_expense AS ligne SET payer_id = garde.id, rev = ligne.rev + 1, updated_at = now()
FROM budget_payer AS doublon
JOIN LATERAL (
  SELECT id FROM budget_payer
  WHERE team_id = doublon.team_id AND type = 'caisse_team' AND deleted_at IS NULL
  ORDER BY created_at, id
  LIMIT 1
) AS garde ON TRUE
WHERE doublon.type = 'caisse_team' AND doublon.deleted_at IS NULL AND garde.id <> doublon.id AND ligne.payer_id = doublon.id;

UPDATE budget_reimbursement AS ligne SET payer_id = garde.id, rev = ligne.rev + 1, updated_at = now()
FROM budget_payer AS doublon
JOIN LATERAL (
  SELECT id FROM budget_payer
  WHERE team_id = doublon.team_id AND type = 'caisse_team' AND deleted_at IS NULL
  ORDER BY created_at, id
  LIMIT 1
) AS garde ON TRUE
WHERE doublon.type = 'caisse_team' AND doublon.deleted_at IS NULL AND garde.id <> doublon.id AND ligne.payer_id = doublon.id;

UPDATE budget_income AS ligne SET encaissee_sur_payer_id = garde.id, rev = ligne.rev + 1, updated_at = now()
FROM budget_payer AS doublon
JOIN LATERAL (
  SELECT id FROM budget_payer
  WHERE team_id = doublon.team_id AND type = 'caisse_team' AND deleted_at IS NULL
  ORDER BY created_at, id
  LIMIT 1
) AS garde ON TRUE
WHERE doublon.type = 'caisse_team' AND doublon.deleted_at IS NULL AND garde.id <> doublon.id AND ligne.encaissee_sur_payer_id = doublon.id;

UPDATE budget_suggestion AS ligne SET payer_id = garde.id, rev = ligne.rev + 1, updated_at = now()
FROM budget_payer AS doublon
JOIN LATERAL (
  SELECT id FROM budget_payer
  WHERE team_id = doublon.team_id AND type = 'caisse_team' AND deleted_at IS NULL
  ORDER BY created_at, id
  LIMIT 1
) AS garde ON TRUE
WHERE doublon.type = 'caisse_team' AND doublon.deleted_at IS NULL AND garde.id <> doublon.id AND ligne.payer_id = doublon.id;

UPDATE budget_payer AS doublon SET deleted_at = now(), rev = doublon.rev + 1, updated_at = now()
WHERE doublon.type = 'caisse_team' AND doublon.deleted_at IS NULL
  AND doublon.id <> (
    SELECT garde.id FROM budget_payer AS garde
    WHERE garde.team_id = doublon.team_id AND garde.type = 'caisse_team' AND garde.deleted_at IS NULL
    ORDER BY garde.created_at, garde.id
    LIMIT 1
  );

CREATE UNIQUE INDEX "budget_caisse_unique" ON "budget_payer" ("team_id") WHERE "type" = 'caisse_team' AND "deleted_at" IS NULL;
