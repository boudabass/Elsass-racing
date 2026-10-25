-- Équipe (tâche 5.1) : les huit tables de l'article 955 §3, en suivant docs/schema-equipe.md.
-- Écrite à la main (pas de Docker sur le poste) : relue contre le modèle de garage_schema.

-- CreateEnum
CREATE TYPE "equipe_role_habituel" AS ENUM ('pilote', 'copilote', 'assistance', 'benevole');
CREATE TYPE "equipe_palier" AS ENUM ('rookie', 'confirme', 'experimente', 'veteran', 'figure');
CREATE TYPE "equipe_type_licence" AS ENUM ('ffsa_regionale', 'ffsa_nationale', 'ffsa_internationale', 'autre');
CREATE TYPE "equipe_type_equipement" AS ENUM ('casque', 'hans', 'combinaison', 'gants', 'bottines', 'sous_vetements', 'cagoule');
CREATE TYPE "equipe_specialite" AS ENUM ('mecanique', 'pneus', 'logistique', 'photo', 'secourisme', 'commissaire', 'autre');
CREATE TYPE "equipe_reponse_disponibilite" AS ENUM ('vient', 'ne_vient_pas', 'peut_etre');
CREATE TYPE "equipe_role_epreuve" AS ENUM ('pilote', 'copilote', 'chef_assistance', 'assistance', 'logistique', 'photo');
CREATE TYPE "equipe_interet_vivier" AS ENUM ('faible', 'moyen', 'fort');

-- CreateTable : profil sportif (un par personne)
CREATE TABLE "equipe_profile" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "roles_habituels" "equipe_role_habituel"[] NOT NULL DEFAULT '{}',
    "debut_sport_auto" DATE,
    "taille_vetements" TEXT,
    "contact_urgence" TEXT,
    "palier" "equipe_palier" NOT NULL DEFAULT 'rookie',
    "afficher_trophees" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "equipe_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable : licences et adhésions
CREATE TABLE "equipe_licence" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "type" "equipe_type_licence" NOT NULL,
    "numero" TEXT,
    "asa_contact_id" UUID,
    "saison" TEXT,
    "valable_du" DATE,
    "valable_au" DATE,
    "document_attachment_id" UUID,
    "montant_cents" INTEGER,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "equipe_licence_pkey" PRIMARY KEY ("id")
);

-- CreateTable : équipements homologués personnels
CREATE TABLE "equipe_gear" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "type" "equipe_type_equipement" NOT NULL,
    "marque" TEXT,
    "modele" TEXT,
    "norme" TEXT,
    "fin_homologation" DATE,
    "taille" TEXT,
    "achete_le" DATE,
    "document_attachment_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "equipe_gear_pkey" PRIMARY KEY ("id")
);

-- CreateTable : spécialités et formations
CREATE TABLE "equipe_skill" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "specialite" "equipe_specialite" NOT NULL,
    "niveau_declare" INTEGER,
    "formation" TEXT,
    "date_formation" DATE,
    "justificatif_attachment_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "equipe_skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable : disponibilité pour une épreuve
CREATE TABLE "equipe_availability" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "reponse" "equipe_reponse_disponibilite" NOT NULL,
    "jours" DATE[] NOT NULL DEFAULT '{}',
    "avec_vehicule" BOOLEAN,
    "places" INTEGER,
    "commentaire" TEXT,
    "repondu_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "equipe_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable : rôle d'une personne sur une épreuve (ni pilote ni copilote : voir la contrainte plus bas)
CREATE TABLE "equipe_assignment" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "event_entry_id" UUID,
    "person_id" UUID NOT NULL,
    "role_epreuve" "equipe_role_epreuve" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "equipe_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable : ressenti après un engagement (privé à l'équipage)
CREATE TABLE "equipe_mood" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "event_entry_id" UUID NOT NULL,
    "ressenti" INTEGER NOT NULL,
    "mot_cle" TEXT,
    "saisi_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "equipe_mood_pkey" PRIMARY KEY ("id")
);

-- CreateTable : vivier
CREATE TABLE "equipe_pool" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "role_recherche" "equipe_role_epreuve" NOT NULL,
    "source" TEXT,
    "dernier_contact" DATE,
    "interet" "equipe_interet_vivier" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "rev" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "equipe_pool_pkey" PRIMARY KEY ("id")
);

-- Index de team (et team + suppression), comme garage_
CREATE INDEX "equipe_profile_team_id_idx" ON "equipe_profile"("team_id");
CREATE INDEX "equipe_profile_team_id_deleted_at_idx" ON "equipe_profile"("team_id", "deleted_at");
CREATE INDEX "equipe_licence_team_id_idx" ON "equipe_licence"("team_id");
CREATE INDEX "equipe_licence_team_id_deleted_at_idx" ON "equipe_licence"("team_id", "deleted_at");
CREATE INDEX "equipe_licence_person_id_idx" ON "equipe_licence"("person_id");
CREATE INDEX "equipe_gear_team_id_idx" ON "equipe_gear"("team_id");
CREATE INDEX "equipe_gear_team_id_deleted_at_idx" ON "equipe_gear"("team_id", "deleted_at");
CREATE INDEX "equipe_gear_person_id_idx" ON "equipe_gear"("person_id");
CREATE INDEX "equipe_skill_team_id_idx" ON "equipe_skill"("team_id");
CREATE INDEX "equipe_skill_team_id_deleted_at_idx" ON "equipe_skill"("team_id", "deleted_at");
CREATE INDEX "equipe_skill_person_id_idx" ON "equipe_skill"("person_id");
CREATE INDEX "equipe_availability_team_id_idx" ON "equipe_availability"("team_id");
CREATE INDEX "equipe_availability_team_id_deleted_at_idx" ON "equipe_availability"("team_id", "deleted_at");
CREATE INDEX "equipe_availability_event_id_idx" ON "equipe_availability"("event_id");
CREATE INDEX "equipe_assignment_team_id_idx" ON "equipe_assignment"("team_id");
CREATE INDEX "equipe_assignment_team_id_deleted_at_idx" ON "equipe_assignment"("team_id", "deleted_at");
CREATE INDEX "equipe_assignment_event_id_idx" ON "equipe_assignment"("event_id");
CREATE INDEX "equipe_assignment_person_id_idx" ON "equipe_assignment"("person_id");
CREATE INDEX "equipe_mood_team_id_idx" ON "equipe_mood"("team_id");
CREATE INDEX "equipe_mood_team_id_deleted_at_idx" ON "equipe_mood"("team_id", "deleted_at");
CREATE INDEX "equipe_mood_event_entry_id_idx" ON "equipe_mood"("event_entry_id");
CREATE INDEX "equipe_pool_team_id_idx" ON "equipe_pool"("team_id");
CREATE INDEX "equipe_pool_team_id_deleted_at_idx" ON "equipe_pool"("team_id", "deleted_at");
CREATE INDEX "equipe_pool_person_id_idx" ON "equipe_pool"("person_id");

-- Clés étrangères vers le socle (team, personne, épreuve, engagement, fichiers, contacts)
ALTER TABLE "equipe_profile" ADD CONSTRAINT "equipe_profile_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_profile" ADD CONSTRAINT "equipe_profile_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipe_licence" ADD CONSTRAINT "equipe_licence_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_licence" ADD CONSTRAINT "equipe_licence_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_licence" ADD CONSTRAINT "equipe_licence_asa_contact_id_fkey" FOREIGN KEY ("asa_contact_id") REFERENCES "core_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipe_licence" ADD CONSTRAINT "equipe_licence_document_attachment_id_fkey" FOREIGN KEY ("document_attachment_id") REFERENCES "core_attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipe_gear" ADD CONSTRAINT "equipe_gear_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_gear" ADD CONSTRAINT "equipe_gear_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_gear" ADD CONSTRAINT "equipe_gear_document_attachment_id_fkey" FOREIGN KEY ("document_attachment_id") REFERENCES "core_attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipe_skill" ADD CONSTRAINT "equipe_skill_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_skill" ADD CONSTRAINT "equipe_skill_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_skill" ADD CONSTRAINT "equipe_skill_justificatif_attachment_id_fkey" FOREIGN KEY ("justificatif_attachment_id") REFERENCES "core_attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipe_availability" ADD CONSTRAINT "equipe_availability_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_availability" ADD CONSTRAINT "equipe_availability_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_availability" ADD CONSTRAINT "equipe_availability_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipe_assignment" ADD CONSTRAINT "equipe_assignment_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_assignment" ADD CONSTRAINT "equipe_assignment_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "core_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_assignment" ADD CONSTRAINT "equipe_assignment_event_entry_id_fkey" FOREIGN KEY ("event_entry_id") REFERENCES "core_event_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_assignment" ADD CONSTRAINT "equipe_assignment_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipe_mood" ADD CONSTRAINT "equipe_mood_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_mood" ADD CONSTRAINT "equipe_mood_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_mood" ADD CONSTRAINT "equipe_mood_event_entry_id_fkey" FOREIGN KEY ("event_entry_id") REFERENCES "core_event_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipe_pool" ADD CONSTRAINT "equipe_pool_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "core_team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipe_pool" ADD CONSTRAINT "equipe_pool_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "core_person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contraintes de valeur (docs/schema-equipe.md, « Contraintes transverses »)
ALTER TABLE "equipe_licence" ADD CONSTRAINT "equipe_licence_validite_check" CHECK ("valable_au" IS NULL OR "valable_du" IS NULL OR "valable_au" >= "valable_du");
ALTER TABLE "equipe_licence" ADD CONSTRAINT "equipe_licence_montant_check" CHECK ("montant_cents" IS NULL OR "montant_cents" >= 0);
ALTER TABLE "equipe_skill" ADD CONSTRAINT "equipe_skill_niveau_check" CHECK ("niveau_declare" IS NULL OR "niveau_declare" BETWEEN 1 AND 5);
ALTER TABLE "equipe_availability" ADD CONSTRAINT "equipe_availability_places_check" CHECK ("places" IS NULL OR "places" >= 0);
ALTER TABLE "equipe_mood" ADD CONSTRAINT "equipe_mood_ressenti_check" CHECK ("ressenti" BETWEEN 1 AND 5);

-- Pilote et copilote se lisent sur l'engagement (core_event_entry), jamais écrits ici (Q8, réponse de l'orchestrateur).
ALTER TABLE "equipe_assignment" ADD CONSTRAINT "equipe_assignment_pas_pilote_check" CHECK ("role_epreuve" NOT IN ('pilote', 'copilote'));

-- Index uniques partiels (lignes actives seulement)
-- Un profil par personne.
CREATE UNIQUE INDEX "equipe_profile_personne_active_key" ON "equipe_profile"("person_id") WHERE "deleted_at" IS NULL;
-- Une disponibilité par personne et par épreuve.
CREATE UNIQUE INDEX "equipe_availability_personne_epreuve_key" ON "equipe_availability"("person_id", "event_id") WHERE "deleted_at" IS NULL;
-- Une affectation par personne, épreuve et rôle.
CREATE UNIQUE INDEX "equipe_assignment_personne_epreuve_role_key" ON "equipe_assignment"("event_id", "person_id", "role_epreuve") WHERE "deleted_at" IS NULL;
-- Un ressenti par personne et par engagement.
CREATE UNIQUE INDEX "equipe_mood_personne_engagement_key" ON "equipe_mood"("person_id", "event_entry_id") WHERE "deleted_at" IS NULL;

-- Cloisonnement par team (RLS), comme garage_.
ALTER TABLE "equipe_profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipe_profile" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "equipe_profile" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "equipe_licence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipe_licence" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "equipe_licence" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "equipe_gear" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipe_gear" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "equipe_gear" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "equipe_skill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipe_skill" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "equipe_skill" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "equipe_availability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipe_availability" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "equipe_availability" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "equipe_assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipe_assignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "equipe_assignment" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "equipe_mood" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipe_mood" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "equipe_mood" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "equipe_pool" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipe_pool" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "equipe_pool" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
