-- Voiture : le côté entre dans le nom des emplacements symétriques (brief 3.14, point 5, étape 2, option A).
-- Données seulement : aucune table ni colonne ne change, aucune ligne n'est supprimée, aucun UPDATE hors de
-- voiture_slot.nom, voiture_slot.forme et partenaires_benefit.slot_nom.
-- Une paire symétrique est une ligne droite et une ligne gauche. Le côté entre dans le nom stocké, et la forme
-- gauche devient la forme droite retournée autour de l'axe du viewBox de la Saxo (x 0, largeur 370).
-- Idempotente, et sans effet sur une base sans emplacement (la production peut en être là).

-- 1. Forme gauche : seulement pour les lignes gauche encore identiques à la ligne droite de la même paire
--    (même véhicule, même type, même vue droite), sur un véhicule Saxo.
UPDATE voiture_slot g
SET forme = jsonb_build_object(
      'type', 'rect',
      'x', 370 - (d.forme->>'x')::numeric - (d.forme->>'l')::numeric,
      'y', d.forme->'y',
      'l', d.forme->'l',
      'h', d.forme->'h'
    )
FROM voiture_slot d
JOIN voiture_vehicle v ON v.vehicle_id = d.vehicle_id AND v.gabarit_cle = 'citadine_3p_saxo' AND v.deleted_at IS NULL
WHERE g.vehicle_id = d.vehicle_id
  AND g.vue = 'gauche'
  AND d.vue = 'droite'
  AND g.ordre = d.ordre
  AND g.symetrique
  AND d.symetrique
  AND g.deleted_at IS NULL
  AND d.deleted_at IS NULL
  AND d.forme->>'type' = 'rect'
  AND g.forme = d.forme;

-- 2. Noms : seules les lignes symétriques dont le nom n'a pas encore le côté sont renommées.
UPDATE voiture_slot
SET nom = nom || ' droite'
WHERE vue = 'droite'
  AND symetrique
  AND deleted_at IS NULL
  AND nom IN ('Portière', 'Custode arrière', 'Aile avant', 'Aile arrière', 'Bas de caisse');

UPDATE voiture_slot
SET nom = nom || ' gauche'
WHERE vue = 'gauche'
  AND symetrique
  AND deleted_at IS NULL
  AND nom IN ('Portière', 'Custode arrière', 'Aile avant', 'Aile arrière', 'Bas de caisse');

-- 3. Contreparties : le nom copié suit l'emplacement, comme le fait l'événement voiture.emplacement_modifie.
--    Seules les contreparties dont le nom est l'ancien nom (sans le côté) sont mises à jour.
UPDATE partenaires_benefit b
SET slot_nom = s.nom
FROM voiture_slot s
WHERE b.slot_id = s.id
  AND s.deleted_at IS NULL
  AND s.symetrique
  AND s.vue IN ('droite', 'gauche')
  AND b.slot_nom IS NOT NULL
  AND b.slot_nom <> s.nom
  AND b.slot_nom = regexp_replace(s.nom, ' (droite|gauche)$', '');
