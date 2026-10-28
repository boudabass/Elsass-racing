-- Documents (tâche 5.3) : les sept tables de l'article 957 §3, en suivant docs/schema-documents.md.
-- Écrite à la main (pas de Docker sur le poste) : relue contre equipe_schema.
-- Les droits du rôle applicatif viennent des privilèges par défaut du socle (pas de GRANT ici).

-- CreateEnum
CREATE TYPE "documents_kind_dossier" AS ENUM ('systeme', 'perso');
CREATE TYPE "documents_visibilite" AS ENUM ('team', 'gestion', 'prive');
CREATE TYPE "documents_type_document" AS ENUM ('statuts', 'recepisse_rna', 'pv_ag', 'reglement_ffsa', 'reglement_particulier', 'modele', 'assurance_asso', 'attestation', 'autre');
CREATE TYPE "documents_statut" AS ENUM ('actif', 'archive');
CREATE TYPE "documents_niveau_acces" AS ENUM ('lecture', 'contribution');
CREATE TYPE "documents_zone" AS ENUM ('vert', 'orange', 'rouge');
CREATE TYPE "documents_etape_alerte" AS ENUM ('J60', 'J30', 'J7', 'expire');

-- CreateTable : dossiers du coffre-fort
CREATE TABLE "documents_folder" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "kind" "documents_kind_dossier" NOT NULL DEFAULT 'perso',
    "parent_id" UUID,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "expected_count" INTEGER,
    "visibility" "documents_visibilite" NOT NULL DEFAULT 'team',
    "owner_person_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "documents_folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable : documents propres de la team
CREATE TABLE "documents_doc" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "doc_type" "documents_type_document" NOT NULL,
    "reference" TEXT,
    "issued_on" DATE,
    "valid_until" DATE,
    "owner_person_id" UUID,
    "notes" TEXT,
    "status" "documents_statut" NOT NULL DEFAULT 'actif',
    "visibility" "documents_visibilite" NOT NULL DEFAULT 'team',
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "documents_doc_pkey" PRIMARY KEY ("id")
);

-- CreateTable : fichiers d'un document (une ligne par fichier, jamais remplacée)
CREATE TABLE "documents_version" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "doc_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "attachment_id" UUID NOT NULL,
    "uploaded_by" UUID,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "documents_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable : échéances centralisées (5.4, sans service en 5.3)
CREATE TABLE "documents_deadline" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "source_app" TEXT NOT NULL,
    "source_table" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "due_on" DATE NOT NULL,
    "zone" "documents_zone" NOT NULL,
    "last_alert_step" "documents_etape_alerte",
    "snoozed_until" DATE,
    "alert_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "documents_deadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable : partage interne d'un document à une personne
CREATE TABLE "documents_access" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "doc_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "level" "documents_niveau_acces" NOT NULL,
    "granted_by" UUID,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "documents_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable : lien de partage externe (5.4, sans service en 5.3)
CREATE TABLE "documents_share" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "doc_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "recipient_label" TEXT,
    "recipient_contact_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "open_count" INTEGER NOT NULL DEFAULT 0,
    "last_opened_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "documents_share_pkey" PRIMARY KEY ("id")
);

-- CreateTable : journal des ouvertures d'un lien (5.4)
CREATE TABLE "documents_share_log" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "share_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(3) NOT NULL,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "documents_share_log_pkey" PRIMARY KEY ("id")
);

-- Index de team (et team + suppression), comme equipe_
CREATE INDEX "documents_folder_team_id_idx" ON "documents_folder"("team_id");
CREATE INDEX "documents_folder_team_id_deleted_at_idx" ON "documents_folder"("team_id", "deleted_at");
CREATE INDEX "documents_doc_team_id_idx" ON "documents_doc"("team_id");
CREATE INDEX "documents_doc_team_id_deleted_at_idx" ON "documents_doc"("team_id", "deleted_at");
CREATE INDEX "documents_doc_folder_id_idx" ON "documents_doc"("folder_id");
CREATE INDEX "documents_doc_owner_person_id_idx" ON "documents_doc"("owner_person_id");
CREATE INDEX "documents_version_team_id_idx" ON "documents_version"("team_id");
CREATE INDEX "documents_version_team_id_deleted_at_idx" ON "documents_version"("team_id", "deleted_at");
CREATE INDEX "documents_version_doc_id_idx" ON "documents_version"("doc_id");
CREATE INDEX "documents_version_attachment_id_idx" ON "documents_version"("attachment_id");
CREATE INDEX "documents_deadline_team_id_idx" ON "documents_deadline"("team_id");
CREATE INDEX "documents_deadline_team_id_deleted_at_idx" ON "documents_deadline"("team_id", "deleted_at");
CREATE INDEX "documents_deadline_source_app_source_id_idx" ON "documents_deadline"("source_app", "source_id");
CREATE INDEX "documents_access_team_id_idx" ON "documents_access"("team_id");
CREATE INDEX "documents_access_team_id_deleted_at_idx" ON "documents_access"("team_id", "deleted_at");
CREATE INDEX "documents_access_doc_id_idx" ON "documents_access"("doc_id");
CREATE INDEX "documents_access_person_id_idx" ON "documents_access"("person_id");
CREATE INDEX "documents_share_team_id_idx" ON "documents_share"("team_id");
CREATE INDEX "documents_share_team_id_deleted_at_idx" ON "documents_share"("team_id", "deleted_at");
CREATE INDEX "documents_share_doc_id_idx" ON "documents_share"("doc_id");
CREATE INDEX "documents_share_log_team_id_idx" ON "documents_share_log"("team_id");
CREATE INDEX "documents_share_log_team_id_deleted_at_idx" ON "documents_share_log"("team_id", "deleted_at");
CREATE INDEX "documents_share_log_share_id_idx" ON "documents_share_log"("share_id");

-- Clés étrangères vers le socle (team, personne, contact, fichier, alerte)
ALTER TABLE "documents_folder" ADD CONSTRAINT "documents_folder_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_folder" ADD CONSTRAINT "documents_folder_owner_person_id_fkey" FOREIGN KEY ("owner_person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_doc" ADD CONSTRAINT "documents_doc_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_doc" ADD CONSTRAINT "documents_doc_owner_person_id_fkey" FOREIGN KEY ("owner_person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_version" ADD CONSTRAINT "documents_version_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_version" ADD CONSTRAINT "documents_version_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "core_attachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_version" ADD CONSTRAINT "documents_version_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_deadline" ADD CONSTRAINT "documents_deadline_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_deadline" ADD CONSTRAINT "documents_deadline_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "core_alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents_access" ADD CONSTRAINT "documents_access_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_access" ADD CONSTRAINT "documents_access_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_access" ADD CONSTRAINT "documents_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_share" ADD CONSTRAINT "documents_share_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_share" ADD CONSTRAINT "documents_share_recipient_contact_id_fkey" FOREIGN KEY ("recipient_contact_id") REFERENCES "core_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents_share_log" ADD CONSTRAINT "documents_share_log_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Clés internes à Documents. Les deux clés croisées (documents_doc.current_version_id, documents_version.doc_id)
-- sont en RESTRICT ; current_version_id est créée après les deux tables (écart 4 validé).
ALTER TABLE "documents_folder" ADD CONSTRAINT "documents_folder_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "documents_folder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_doc" ADD CONSTRAINT "documents_doc_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "documents_folder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_version" ADD CONSTRAINT "documents_version_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "documents_doc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_doc" ADD CONSTRAINT "documents_doc_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "documents_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_access" ADD CONSTRAINT "documents_access_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "documents_doc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_share" ADD CONSTRAINT "documents_share_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "documents_doc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents_share_log" ADD CONSTRAINT "documents_share_log_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "documents_share"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contraintes de valeur (docs/schema-documents.md)
ALTER TABLE "documents_doc" ADD CONSTRAINT "documents_doc_validite_check" CHECK ("valid_until" IS NULL OR "issued_on" IS NULL OR "valid_until" >= "issued_on");
ALTER TABLE "documents_folder" ADD CONSTRAINT "documents_folder_expected_count_check" CHECK ("expected_count" IS NULL OR "expected_count" >= 0);
ALTER TABLE "documents_version" ADD CONSTRAINT "documents_version_numero_check" CHECK ("version_no" >= 1);
ALTER TABLE "documents_share" ADD CONSTRAINT "documents_share_open_count_check" CHECK ("open_count" >= 0);

-- Index uniques
-- Une seule version par numéro dans un document.
CREATE UNIQUE INDEX "documents_version_doc_id_version_no_key" ON "documents_version"("doc_id", "version_no");
-- Un seul hachage de jeton de partage.
CREATE UNIQUE INDEX "documents_share_token_hash_key" ON "documents_share"("token_hash");
-- Un dossier type par nom et par team (lignes actives seulement) : garde contre les doublons sous deux écritures.
CREATE UNIQUE INDEX "documents_folder_systeme_nom_key" ON "documents_folder"("team_id", "name") WHERE "kind" = 'systeme' AND "deleted_at" IS NULL;
-- Un accès actif par document et par personne.
CREATE UNIQUE INDEX "documents_access_personne_active_key" ON "documents_access"("doc_id", "person_id") WHERE "deleted_at" IS NULL;

-- Cloisonnement par team (RLS), comme equipe_
ALTER TABLE "documents_folder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents_folder" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "documents_folder" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
ALTER TABLE "documents_doc" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents_doc" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "documents_doc" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
ALTER TABLE "documents_version" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents_version" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "documents_version" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
ALTER TABLE "documents_deadline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents_deadline" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "documents_deadline" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
ALTER TABLE "documents_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents_access" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "documents_access" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
ALTER TABLE "documents_share" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents_share" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "documents_share" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
ALTER TABLE "documents_share_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents_share_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "documents_share_log" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
