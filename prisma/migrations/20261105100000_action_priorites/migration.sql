-- Rangs de la boîte d'actions (tâche 5.8, §3.4) : table unique src/core/actions/priorites.ts.
-- Les actions en attente émises avant cette table gardent l'ancien rang (5, 6, 2 ou 4 selon le cas). Ce fichier les remet
-- au rang d'aujourd'hui, par type. Les rangs à échéance viennent de la date : 2 si elle est passée ou du jour, 9 avant,
-- 9 sans date (le recalcul de l'app mettra la date et le rang juste au passage suivant).
--
-- Garanties, vérifiées par db:verifier-priorites (dans une transaction annulée) :
-- - seules les actions en_attente changent : une action décidée, expirée ou annulée ne bouge pas ;
-- - un type à rang fixe prend le rang de la table, quel que soit son rang d'avant ;
-- - rejouer le fichier ne change rien à la deuxième passe (chaque UPDATE fixe une valeur, il ne l'ajuste pas).

-- Propositions d'une autre app, à confirmer (8).
UPDATE core_action SET priorite = 8
WHERE statut = 'en_attente'
  AND type IN (
    'ajouter_point', 'cocher_point', 'creer_liste_retour', 'relire_liste', 'creer_listes', 'reassigner_points',
    'ordre_depuis_point', 'message_partenaire', 'emplacement_pris', 'emplacement_supprime',
    'reserver_emplacement', 'liberer_emplacement', 'cloture_saison_proposee'
  );

-- Suggestions de préparation (7) : tâche de problème, point critique, reconnaissance, programme du jour, disponibilité.
UPDATE core_action SET priorite = 7
WHERE statut = 'en_attente'
  AND type IN ('point_critique', 'tache_probleme', 'reconnaissance', 'programme_du_jour', 'disponibilite_a_repondre');

-- Mouvement à confirmer (4).
UPDATE core_action SET priorite = 4
WHERE statut = 'en_attente'
  AND type = 'mouvement_a_confirmer';

-- Contrepartie ou preuve de partenaire (5).
UPDATE core_action SET priorite = 5
WHERE statut = 'en_attente'
  AND type IN ('preuve_pose', 'publications_promises', 'contrepartie_en_retard', 'marquer_engagement_paye');

-- Relance partenaire (6).
UPDATE core_action SET priorite = 6
WHERE statut = 'en_attente'
  AND type = 'tache_relance';

-- Résultat à saisir ou à valider, relance de résultat comprise (3).
UPDATE core_action SET priorite = 3
WHERE statut = 'en_attente'
  AND type IN ('resultat_a_saisir', 'resultat_a_valider');

-- Rangs à échéance : 2 si la date (jour civil de Paris) est passée ou du jour, 9 sinon ou sans date.
UPDATE core_action SET priorite = CASE
    WHEN echeance IS NOT NULL AND (echeance AT TIME ZONE 'UTC')::date <= (now() AT TIME ZONE 'Europe/Paris')::date THEN 2
    ELSE 9
  END
WHERE statut = 'en_attente'
  AND type IN (
    'cloture_engagements', 'licence_a_renouveler', 'homologation_a_renouveler', 'papier_a_renouveler',
    'renouveler_document'
  );
