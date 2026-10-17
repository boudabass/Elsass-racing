-- Espèces, comme moyen de paiement d'une dépense transmise à Saison (tâche 2.8). Ajout seul, rien n'est modifié.
ALTER TYPE "saison_paiement_mode" ADD VALUE IF NOT EXISTS 'especes';
