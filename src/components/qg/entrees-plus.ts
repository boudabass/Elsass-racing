import type { EntreePlus } from "./bouton-plus"

// Entrées du menu « + », filtrées par le rôle. Tant que les apps n'existent pas, chaque
// entrée est désactivée avec sa raison en clair. « Note » est active : elle ouvre la page des notes
// avec le champ prêt. « Épreuve » est active pour le responsable et l'équipage : elle ouvre le
// formulaire de nouvelle épreuve de Saison. « Réglage » (Voiture) est ouverte à tous ceux qui ont la
// contribution, y compris en terrain : l'assistance relève les pressions au parc. « Véhicule » (Voiture)
// est pour le responsable et l'équipage, hors terrain. « Pièce » (ajout au stock du Garage), « Roulage » (usure
// manuelle) et « Équipement » (équipement de la team) sont pour le responsable et l'équipage, hors terrain. « Intervention » (ordre terminé du Garage) est pour le
// responsable, l'équipage et l'assistance, hors terrain. En mode terrain : Dépense, Réglage, Photo et Note.
export function entreesDuMenuPlus(role: string, terrain: boolean): EntreePlus[] {
  if (role === "invite") return []

  const photo: EntreePlus = { libelle: "Photo", desactivee: true, raison: "Bientôt, avec l'app Médias" }
  const note: EntreePlus = { libelle: "Note", desactivee: false, href: "/notes?nouvelle=1" }
  const depense: EntreePlus = { libelle: "Dépense", desactivee: false, href: "/apps/budget/nouvelle" }
  const epreuve: EntreePlus = { libelle: "Épreuve", desactivee: false, href: "/apps/saison/nouvelle" }
  const personne: EntreePlus = { libelle: "Personne", desactivee: false, href: "/apps/equipe?nouvelle=1" }
  const reglage: EntreePlus = { libelle: "Réglage", desactivee: false, href: "/apps/voiture/reglage-rapide" }
  const vehicule: EntreePlus = { libelle: "Véhicule", desactivee: false, href: "/apps/voiture/nouveau" }
  const partenaire: EntreePlus = { libelle: "Partenaire", desactivee: false, href: "/apps/partenaires/nouveau" }
  const piece: EntreePlus = { libelle: "Pièce", desactivee: false, href: "/apps/garage/pieces/nouvelle" }
  const roulage: EntreePlus = { libelle: "Roulage", desactivee: false, href: "/apps/garage/roulage" }
  const equipement: EntreePlus = { libelle: "Équipement", desactivee: false, href: "/apps/garage/equipements?nouveau=1" }
  const intervention: EntreePlus = { libelle: "Intervention", desactivee: false, href: "/apps/garage/intervention" }

  // La dépense et le réglage sont ouverts à tous ceux qui ont la contribution (assistance comprise), y compris en terrain.
  if (terrain) return [depense, reglage, photo, note]
  if (role === "assistance") return [intervention, depense, reglage, photo, note]
  if (role === "equipage" || role === "responsable") return [epreuve, personne, vehicule, partenaire, piece, roulage, equipement, intervention, depense, reglage, photo, note]
  return [depense, photo, note]
}
