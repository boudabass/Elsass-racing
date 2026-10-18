-- Page partenaire (brief 3.7, point 2) : retrouver un lien à partir de l'empreinte de son jeton, sans contexte de team.
--
-- Les tables partenaires_ sont sous RLS forcée : sans contexte, rien n'est lisible. Cette fonction suit le précédent
-- de core_invitation_en_attente (core_rls) : SECURITY DEFINER, search_path fixé, propriétaire qui contourne le RLS
-- (rôle propriétaire, comme pour les migrations ; le rôle applicatif, lui, reste soumis au RLS).
--
-- Elle ne renvoie qu'une ligne, et seulement si le lien : a cette empreinte, est actif, n'est pas supprimé, n'est
-- pas expiré, et appartient à un partenaire non supprimé de la même team. Sinon, aucune ligne. Rien d'autre n'est
-- rendu lisible : la fonction n'expose que ces quatre colonnes.
CREATE OR REPLACE FUNCTION partenaires_lien_par_empreinte(empreinte text)
  RETURNS TABLE (lien_id uuid, team_id uuid, partner_id uuid, sections text[])
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
    SELECT l.id, l.team_id, l.partner_id, l.sections
    FROM partenaires_portal_link l
    JOIN partenaires_partner p ON p.id = l.partner_id AND p.team_id = l.team_id
    WHERE l.jeton_empreinte = empreinte
      AND l.actif
      AND l.deleted_at IS NULL
      AND (l.expire_le IS NULL OR l.expire_le > now())
      AND p.deleted_at IS NULL
    LIMIT 1
  $$;

-- Par défaut, PostgreSQL accorde EXECUTE à PUBLIC : on le retire, puis on n'accorde qu'au rôle applicatif.
REVOKE ALL ON FUNCTION partenaires_lien_par_empreinte(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION partenaires_lien_par_empreinte(text) TO elsass_racing_app;
