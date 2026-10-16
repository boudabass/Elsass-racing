-- Cloisonnement par team (Row Level Security) et rôle applicatif.
--
-- Principe : l'application se connecte avec un rôle sans privilège de superutilisateur
-- (membre de elsass_racing_app), soumis aux politiques RLS. À chaque requête, le client
-- fixe la team et le compte courants avec set_config (cf. src/lib/prisma.ts).
--
-- Tables SANS RLS, filtrées par le code (données de compte, référentiels) :
--   core_user, core_auth_token, core_device   : données de compte, lues avant toute team
--   core_app, core_role_default               : référentiels globaux, sans team_id
--   core_team : RLS, mais politique propre (voir plus bas), pas la politique standard
--   core_user et les autres ci-dessus n'ont pas de team_id ; ce sont les seules exceptions.
--
-- Rôle propriétaire (elsass_racing, en dev superutilisateur) : contourne le RLS, ce qui
-- permet à la migration et aux scripts de seed d'écrire hors contexte de team.
-- La fonction core_invitation_en_attente (SECURITY DEFINER) doit appartenir à un rôle
-- BYPASSRLS ou superutilisateur, sinon elle ne voit aucune invitation et répond faux.

-- 1. Rôle applicatif, sans login : le rôle de connexion (elsass_racing_app_dev) en hérite.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elsass_racing_app') THEN
    CREATE ROLE elsass_racing_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO elsass_racing_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO elsass_racing_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO elsass_racing_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO elsass_racing_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO elsass_racing_app;

-- L'historique des migrations n'est pas une donnée applicative.
REVOKE ALL ON TABLE "_prisma_migrations" FROM elsass_racing_app;

-- 2. Fonctions lisant le contexte posé par set_config. NULLIF : un réglage vide
-- (''), qui est ce que current_setting renvoie après une transaction, donne NULL et
-- non une erreur de conversion en uuid.
CREATE OR REPLACE FUNCTION core_team_courante() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.team_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION core_utilisateur_courant() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

-- Vérifie, avant le compte connecté, qu'une invitation attend cette adresse.
-- Sert à la décision d'envoi de connexion : pas d'énumération des comptes.
CREATE OR REPLACE FUNCTION core_invitation_en_attente(adresse text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM core_invitation
      WHERE lower(email) = lower(adresse)
        AND acceptee_at IS NULL
        AND expire_at > now()
    )
  $$;
GRANT EXECUTE ON FUNCTION core_invitation_en_attente(text) TO elsass_racing_app;

-- 3. Cloisonnement standard : toute table qui porte team_id.
-- Une politique FOR ALL, avec USING (lecture, modification, suppression) et WITH CHECK
-- (écriture) : une ligne d'une autre team est invisible, et ne peut pas y être créée.

ALTER TABLE "core_action" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_action" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_action" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_activity" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_activity" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_alert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_alert" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_alert" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_app_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_app_access" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_app_access" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_attachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_attachment" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_attachment" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_contact" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_contact" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_domain_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_domain_event" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_domain_event" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_event" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_event" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_event_delivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_event_delivery" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_event_delivery" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_event_entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_event_entry" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_event_entry" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_export" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_export" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_export" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_file" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_file" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_file" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_invitation" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_invitation" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_note" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_note" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_note" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_notification" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_notification_pref" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_notification_pref" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_notification_pref" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_person" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_person" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_person" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_search_index" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_search_index" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_search_index" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_season" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_season" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_season" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_sync_cursor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_sync_cursor" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_sync_cursor" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_tag" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_tag" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_task" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_task" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_team_app" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_team_app" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_team_app" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

ALTER TABLE "core_vehicle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_vehicle" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_vehicle" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());

-- 4. core_membership : cloisonnement standard, plus la lecture de ses propres adhésions
-- (nécessaire pour lister les teams d'un compte avant de choisir l'une d'elles).
ALTER TABLE "core_membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_membership" FORCE ROW LEVEL SECURITY;
CREATE POLICY cloisonnement_team ON "core_membership" FOR ALL TO elsass_racing_app
  USING (team_id = core_team_courante()) WITH CHECK (team_id = core_team_courante());
CREATE POLICY adhesions_du_compte ON "core_membership" FOR SELECT TO elsass_racing_app
  USING (user_id = core_utilisateur_courant());

-- 5. core_team : lisible si c'est la team courante, ou une team où le compte a une
-- adhésion active. Modifiable seulement par la team courante. Pas de création ni de
-- suppression par l'application : elles passent par les scripts (rôle propriétaire).
ALTER TABLE "core_team" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "core_team" FORCE ROW LEVEL SECURITY;
CREATE POLICY lecture_team ON "core_team" FOR SELECT TO elsass_racing_app
  USING (
    id = core_team_courante()
    OR id IN (
      SELECT team_id FROM core_membership
      WHERE user_id = core_utilisateur_courant() AND statut = 'actif'
    )
  );
CREATE POLICY mise_a_jour_team ON "core_team" FOR UPDATE TO elsass_racing_app
  USING (id = core_team_courante()) WITH CHECK (id = core_team_courante());
