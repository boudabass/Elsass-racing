-- Rôle de connexion de l'application (développement uniquement).
-- Exécuté par docker-entrypoint-initdb.d à la création du volume, et à relancer à la
-- main sur un volume existant (cf. docs/conventions-schema.md, section Rôles).
--
-- Le rôle elsass_racing_app (NOLOGIN) porte les droits et le RLS ; ce rôle de
-- connexion en hérite. Il n'est ni superutilisateur, ni propriétaire des tables.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elsass_racing_app') THEN
    CREATE ROLE elsass_racing_app NOLOGIN;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elsass_racing_app_dev') THEN
    CREATE ROLE elsass_racing_app_dev LOGIN PASSWORD 'elsass_racing_app_dev';
  END IF;
END
$$;

GRANT elsass_racing_app TO elsass_racing_app_dev;
