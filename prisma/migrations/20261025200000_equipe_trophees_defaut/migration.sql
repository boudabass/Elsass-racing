-- Équipe (tâche 5.2, décision de l'orchestrateur) : les paliers et trophées sont affichés par défaut (motivant, la
-- personne les retire dans son profil). Défaut seulement : les lignes existantes gardent la valeur déjà choisie.
ALTER TABLE "equipe_profile" ALTER COLUMN "afficher_trophees" SET DEFAULT true;
