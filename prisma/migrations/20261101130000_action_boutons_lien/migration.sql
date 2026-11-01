-- Boutons-liens (tâche 5.6 §0) : les actions en attente créées avant le format « lien » gardent un bouton qui décidait
-- l'action au clic. On passe ces boutons au format d'aujourd'hui, avec le chemin que l'app met maintenant.
--
-- Garanties, vérifiées par db:verifier-checklist (section 6, dans une transaction annulée) :
-- - sur une base vide, aucune ligne n'est touchée : chaque UPDATE filtre sur statut = 'en_attente' ;
-- - une action décidée, expirée ou annulée ne change pas ;
-- - une action qui a déjà un bouton « lien » ne change pas : le NOT EXISTS exclut ces lignes, donc rejouer le fichier
--   ne change rien à la deuxième passe ;
-- - seules les actions des quatre types ci-dessous changent.
--
-- Sans levée côté app, un bouton-lien ne sort jamais de la boîte : les quatre types ont leur levée
-- (equipe.action_levee, checklist.action_levee).

-- Licence à renouveler : la fiche est la licence, le chemin mène à la personne de la licence.
UPDATE core_action AS a
SET boutons = jsonb_build_array(
  jsonb_build_object(
    'cle', 'renouveler',
    'libelle', 'Renouveler',
    'lien', '/apps/equipe/personnes/' || l.person_id::text || '?onglet=licences'
  )
)
FROM equipe_licence AS l
WHERE a.type = 'licence_a_renouveler'
  AND a.app_origine = 'equipe'
  AND a.statut = 'en_attente'
  AND a.fiche_id = l.id
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(a.boutons) AS b WHERE b ? 'lien');

-- Homologation à renouveler : la fiche est l'équipement, le chemin mène à la personne, onglet Équipement.
UPDATE core_action AS a
SET boutons = jsonb_build_array(
  jsonb_build_object(
    'cle', 'renouveler',
    'libelle', 'Renouveler',
    'lien', '/apps/equipe/personnes/' || g.person_id::text || '?onglet=equipement'
  )
)
FROM equipe_gear AS g
WHERE a.type = 'homologation_a_renouveler'
  AND a.app_origine = 'equipe'
  AND a.statut = 'en_attente'
  AND a.fiche_id = g.id
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(a.boutons) AS b WHERE b ? 'lien');

-- Disponibilité à donner : le chemin est fixe (la page Prochaine épreuve), la fiche ne sert pas.
UPDATE core_action AS a
SET boutons = jsonb_build_array(
  jsonb_build_object('cle', 'repondre', 'libelle', 'Répondre', 'lien', '/apps/equipe/epreuve')
)
WHERE a.type = 'disponibilite_a_repondre'
  AND a.app_origine = 'equipe'
  AND a.statut = 'en_attente'
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(a.boutons) AS b WHERE b ? 'lien');

-- Réassignation des points : le chemin est l'accueil de Check-lists.
UPDATE core_action AS a
SET boutons = jsonb_build_array(
  jsonb_build_object('cle', 'voir', 'libelle', 'Voir les listes', 'lien', '/apps/checklist')
)
WHERE a.type = 'reassigner_points'
  AND a.app_origine = 'checklist'
  AND a.statut = 'en_attente'
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(a.boutons) AS b WHERE b ? 'lien');
