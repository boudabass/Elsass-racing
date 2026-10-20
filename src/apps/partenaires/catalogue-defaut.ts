// Liste de base des contreparties, copiée dans la team à la première lecture (brief 3.6, point 0.1.1).
// La clé `cle` sert d'identifiant de copie : elle est stockée dans `source_cle` (préfixée) et protégée par
// l'index unique partiel, pour qu'une double lecture simultanée ne crée qu'une seule ligne.

export const PREFIXE_SOURCE_CATALOGUE = "defaut_v1:"

export type LigneCatalogueDefaut = {
  cle: string
  nom: string
  type: "logo_voiture" | "logo_tenues" | "publication_reseaux" | "mention_dossier" | "invitation_epreuve"
  unite: string
  quantiteDefaut: number
  ordre: number
}

export const CATALOGUE_DEFAUT_V1: readonly LigneCatalogueDefaut[] = [
  { cle: "logo_voiture", nom: "Logo sur la voiture", type: "logo_voiture", unite: "emplacement", quantiteDefaut: 1, ordre: 1 },
  { cle: "logo_tenues", nom: "Logo sur les tenues", type: "logo_tenues", unite: "tenue", quantiteDefaut: 1, ordre: 2 },
  { cle: "publication_reseaux", nom: "Publications sur les réseaux", type: "publication_reseaux", unite: "publication", quantiteDefaut: 4, ordre: 3 },
  { cle: "mention_dossier", nom: "Mention dans le dossier de partenariat", type: "mention_dossier", unite: "mention", quantiteDefaut: 1, ordre: 4 },
  { cle: "invitation_epreuve", nom: "Invitation à une épreuve", type: "invitation_epreuve", unite: "invitation", quantiteDefaut: 2, ordre: 5 },
]
