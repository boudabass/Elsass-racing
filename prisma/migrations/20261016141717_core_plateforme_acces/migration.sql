-- CreateEnum
CREATE TYPE "core_role" AS ENUM ('responsable', 'equipage', 'assistance', 'invite');

-- CreateEnum
CREATE TYPE "core_access_level" AS ENUM ('aucun', 'lecture', 'contribution', 'ecriture', 'gestion');

-- CreateEnum
CREATE TYPE "core_membership_statut" AS ENUM ('invite', 'actif', 'parti');

-- CreateEnum
CREATE TYPE "core_auth_token_type" AS ENUM ('lien', 'code');

-- CreateTable
CREATE TABLE "core_user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT,
    "derniere_connexion_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_auth_token" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "core_auth_token_type" NOT NULL,
    "hash" TEXT NOT NULL,
    "expire_at" TIMESTAMPTZ(3) NOT NULL,
    "utilise_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_auth_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_invitation" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "person_id" UUID,
    "role" "core_role" NOT NULL,
    "envoyee_par_user_id" UUID NOT NULL,
    "expire_at" TIMESTAMPTZ(3) NOT NULL,
    "acceptee_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_device" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "plateforme" TEXT NOT NULL,
    "derniere_sync_at" TIMESTAMPTZ(3),
    "push_token" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_membership" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "person_id" UUID,
    "role" "core_role" NOT NULL,
    "statut" "core_membership_statut" NOT NULL DEFAULT 'invite',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_app" (
    "cle" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "icone" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "requiert" TEXT[],

    CONSTRAINT "core_app_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "core_team_app" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "app_cle" TEXT NOT NULL,
    "activee" BOOLEAN NOT NULL DEFAULT true,
    "version_installee" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_team_app_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_role_default" (
    "role" "core_role" NOT NULL,
    "app_cle" TEXT NOT NULL,
    "niveau" "core_access_level" NOT NULL,

    CONSTRAINT "core_role_default_pkey" PRIMARY KEY ("role","app_cle")
);

-- CreateTable
CREATE TABLE "core_app_access" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "app_cle" TEXT NOT NULL,
    "niveau" "core_access_level" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "core_app_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "core_user_email_key" ON "core_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "core_auth_token_hash_key" ON "core_auth_token"("hash");

-- CreateIndex
CREATE INDEX "core_auth_token_user_id_idx" ON "core_auth_token"("user_id");

-- CreateIndex
CREATE INDEX "core_invitation_team_id_idx" ON "core_invitation"("team_id");

-- CreateIndex
CREATE INDEX "core_membership_team_id_idx" ON "core_membership"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "core_membership_team_id_user_id_key" ON "core_membership"("team_id", "user_id");

-- CreateIndex
CREATE INDEX "core_team_app_team_id_idx" ON "core_team_app"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "core_team_app_team_id_app_cle_key" ON "core_team_app"("team_id", "app_cle");

-- CreateIndex
CREATE INDEX "core_app_access_team_id_idx" ON "core_app_access"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "core_app_access_membership_id_app_cle_key" ON "core_app_access"("membership_id", "app_cle");

-- AddForeignKey
ALTER TABLE "core_auth_token" ADD CONSTRAINT "core_auth_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_invitation" ADD CONSTRAINT "core_invitation_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_invitation" ADD CONSTRAINT "core_invitation_envoyee_par_user_id_fkey" FOREIGN KEY ("envoyee_par_user_id") REFERENCES "core_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_device" ADD CONSTRAINT "core_device_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_membership" ADD CONSTRAINT "core_membership_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_membership" ADD CONSTRAINT "core_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_team_app" ADD CONSTRAINT "core_team_app_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_team_app" ADD CONSTRAINT "core_team_app_app_cle_fkey" FOREIGN KEY ("app_cle") REFERENCES "core_app"("cle") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_role_default" ADD CONSTRAINT "core_role_default_app_cle_fkey" FOREIGN KEY ("app_cle") REFERENCES "core_app"("cle") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_app_access" ADD CONSTRAINT "core_app_access_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_app_access" ADD CONSTRAINT "core_app_access_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "core_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_app_access" ADD CONSTRAINT "core_app_access_app_cle_fkey" FOREIGN KEY ("app_cle") REFERENCES "core_app"("cle") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ajout à la main (Prisma ne sait pas exprimer ce CHECK) : une invitation doit
-- pouvoir être envoyée par email ou par téléphone, au moins l'un des deux.
ALTER TABLE "core_invitation" ADD CONSTRAINT "core_invitation_email_ou_telephone_check" CHECK ("email" IS NOT NULL OR "telephone" IS NOT NULL);
