-- Brief 3.9, §4 : fonction de l'interlocuteur (par exemple « Gérant »), écrite après son nom dans la convention.
-- Colonne facultative et additive : les fiches existantes restent telles quelles.
ALTER TABLE "partenaires_partner" ADD COLUMN "interlocuteur_qualite" TEXT;
