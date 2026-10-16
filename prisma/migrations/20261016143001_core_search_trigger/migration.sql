-- Remplace la colonne générée du plein texte par une colonne ordinaire, tenue à
-- jour par un trigger. Une colonne générée ne se laisse pas décrire par Prisma :
-- chaque `migrate diff` proposait alors de la modifier. Une colonne ordinaire et
-- une fonction/trigger, eux, sont invisibles pour Prisma et ne créent aucun écart.

-- L'index GIN est supprimé avec la colonne : on le recrée plus bas.
DROP INDEX IF EXISTS "core_search_index_vecteur_idx";
ALTER TABLE "core_search_index" DROP COLUMN "vecteur";
ALTER TABLE "core_search_index" ADD COLUMN "vecteur" tsvector;

-- Calcul initial des lignes existantes (la table est neuve : normalement vide).
UPDATE "core_search_index"
SET "vecteur" = to_tsvector('french'::regconfig, coalesce("titre", '') || ' ' || coalesce("texte", ''));

CREATE INDEX "core_search_index_vecteur_idx" ON "core_search_index" USING GIN ("vecteur");

-- Maintient "vecteur" à chaque insertion et à chaque modification du titre ou du texte.
CREATE OR REPLACE FUNCTION core_search_index_maj_vecteur() RETURNS trigger AS $$
BEGIN
  NEW.vecteur := to_tsvector('french'::regconfig, coalesce(NEW.titre, '') || ' ' || coalesce(NEW.texte, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER core_search_index_vecteur_trg
  BEFORE INSERT OR UPDATE OF titre, texte ON "core_search_index"
  FOR EACH ROW EXECUTE FUNCTION core_search_index_maj_vecteur();
