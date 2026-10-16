-- CreateTable
CREATE TABLE "core_sync_operation" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "id_operation" UUID NOT NULL,
    "resultat" JSONB NOT NULL,
    "applique_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_sync_operation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "core_sync_operation_id_operation_key" ON "core_sync_operation"("id_operation");

-- CreateIndex
CREATE INDEX "core_sync_operation_team_id_idx" ON "core_sync_operation"("team_id");

-- Cloisonnement par team, comme les autres tables qui portent team_id (cf. core_rls).
ALTER TABLE "core_sync_operation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_sync_operation" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_sync_operation" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
