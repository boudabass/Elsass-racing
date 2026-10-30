-- Documents 5.4 : retrouver un lien de partage à partir de l'empreinte de son jeton, sans contexte de team (page /d/).
-- Même modèle que partenaires_lien_par_empreinte. Tout filtre se fait dans la fonction : un lien invalide ne renvoie
-- aucune ligne, et aucune date ne sort de la base sans team. La page refait ensuite les contrôles sous le contexte de la
-- team trouvée (défense en profondeur). Seuls les identifiants partent.
CREATE OR REPLACE FUNCTION documents_lien_par_empreinte(empreinte text)
  RETURNS TABLE (share_id uuid, team_id uuid, doc_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
    SELECT s.id, s.team_id, s.doc_id
    FROM documents_share s
    JOIN documents_doc d ON d.id = s.doc_id AND d.team_id = s.team_id AND d.deleted_at IS NULL AND d.status = 'actif'
    WHERE s.token_hash = empreinte
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND s.deleted_at IS NULL
    LIMIT 1
  $$;

REVOKE ALL ON FUNCTION documents_lien_par_empreinte(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION documents_lien_par_empreinte(text) TO elsass_racing_app;
