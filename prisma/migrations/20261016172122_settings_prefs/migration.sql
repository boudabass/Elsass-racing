-- Préférences Réglages, suppression, hash d'invitation.
-- Généré par migrate diff depuis la base réelle vers le schéma.

-- CreateEnum
CREATE TYPE "settings_theme" AS ENUM ('sombre', 'clair', 'systeme');

-- CreateEnum
CREATE TYPE "settings_taille_texte" AS ENUM ('normale', 'grande');

-- CreateEnum
CREATE TYPE "settings_ludique" AS ENUM ('oui', 'non', 'comme_la_team');

-- CreateEnum
CREATE TYPE "settings_portee_suppression" AS ENUM ('compte', 'team');

-- AlterTable
ALTER TABLE "core_invitation" ADD COLUMN     "hash" TEXT;

-- CreateTable
CREATE TABLE "settings_team_pref" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "ludique_affiche" BOOLEAN NOT NULL DEFAULT true,
    "terrain_propose_jour_epreuve" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "settings_team_pref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings_member_pref" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "theme" "settings_theme" NOT NULL DEFAULT 'sombre',
    "taille_texte" "settings_taille_texte" NOT NULL DEFAULT 'normale',
    "mode_terrain" BOOLEAN NOT NULL DEFAULT false,
    "ludique_affiche" "settings_ludique" NOT NULL DEFAULT 'comme_la_team',
    "heures_calmes_debut" TEXT,
    "heures_calmes_fin" TEXT,
    "apps_decouvertes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "settings_member_pref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings_deletion_request" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "portee" "settings_portee_suppression" NOT NULL,
    "user_id" UUID,
    "demande_par_user_id" UUID NOT NULL,
    "export_id" UUID,
    "purge_prevue_at" TIMESTAMPTZ(3) NOT NULL,
    "annulee_at" TIMESTAMPTZ(3),
    "executee_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "settings_deletion_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "settings_team_pref_team_id_idx" ON "settings_team_pref"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_team_pref_team_id_key" ON "settings_team_pref"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_member_pref_membership_id_key" ON "settings_member_pref"("membership_id");

-- CreateIndex
CREATE INDEX "settings_member_pref_team_id_idx" ON "settings_member_pref"("team_id");

-- CreateIndex
CREATE INDEX "settings_deletion_request_team_id_idx" ON "settings_deletion_request"("team_id");

-- CreateIndex
CREATE INDEX "settings_deletion_request_user_id_idx" ON "settings_deletion_request"("user_id");

-- CreateIndex
CREATE INDEX "settings_deletion_request_demande_par_user_id_idx" ON "settings_deletion_request"("demande_par_user_id");

-- CreateIndex
CREATE INDEX "settings_deletion_request_export_id_idx" ON "settings_deletion_request"("export_id");

-- CreateIndex
CREATE UNIQUE INDEX "core_invitation_hash_key" ON "core_invitation"("hash");

-- AddForeignKey
ALTER TABLE "settings_team_pref" ADD CONSTRAINT "settings_team_pref_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings_member_pref" ADD CONSTRAINT "settings_member_pref_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings_member_pref" ADD CONSTRAINT "settings_member_pref_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "core_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings_deletion_request" ADD CONSTRAINT "settings_deletion_request_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings_deletion_request" ADD CONSTRAINT "settings_deletion_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings_deletion_request" ADD CONSTRAINT "settings_deletion_request_demande_par_user_id_fkey" FOREIGN KEY ("demande_par_user_id") REFERENCES "core_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings_deletion_request" ADD CONSTRAINT "settings_deletion_request_export_id_fkey" FOREIGN KEY ("export_id") REFERENCES "core_export"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS : les trois tables portent team_id, donc cloisonnées comme les autres (cf. core_rls).
ALTER TABLE "settings_team_pref" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings_team_pref" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "settings_team_pref" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "settings_member_pref" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings_member_pref" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "settings_member_pref" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "settings_deletion_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings_deletion_request" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "settings_deletion_request" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

-- Recherche d'une invitation à partir du hash de son secret, avant qu'une team soit choisie
-- (l'acceptation d'une invitation démarre hors contexte de team). Même règle que
-- core_invitation_en_attente : SECURITY DEFINER, propriétaire superutilisateur ou BYPASSRLS.
CREATE OR REPLACE FUNCTION core_invitation_active_par_hash(p_hash text)
  RETURNS TABLE (id uuid, team_id uuid, email text, telephone text, role core_role, person_id uuid, expire_at timestamptz, acceptee_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
    SELECT i.id, i.team_id, i.email, i.telephone, i.role, i.person_id, i.expire_at, i.acceptee_at
    FROM core_invitation i
    WHERE i.hash = p_hash
  $$;
GRANT EXECUTE ON FUNCTION core_invitation_active_par_hash(text) TO elsass_racing_app;
