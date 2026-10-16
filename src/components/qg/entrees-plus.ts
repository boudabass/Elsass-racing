import type { EntreePlus } from "./bouton-plus"

// Entrées du menu « + », filtrées par le rôle. Tant que les apps n'existent pas, chaque
// entrée est désactivée avec sa raison en clair. « Note » est active : elle ouvre la page des notes
// avec le champ prêt. « Épreuve » est active pour le responsable et l'équipage : elle ouvre le
// formulaire de nouvelle épreuve de Saison. En mode terrain : Photo et Note seulement.
export function entreesDuMenuPlus(role: string, terrain: boolean): EntreePlus[] {
  if (role === "invite") return []

  const photo: EntreePlus = { libelle: "Photo", desactivee: true, raison: "Bientôt, avec l'app Médias" }
  const note: EntreePlus = { libelle: "Note", desactivee: false, href: "/notes?nouvelle=1" }
  const depense: EntreePlus = { libelle: "Dépense", desactivee: true, raison: "Bientôt, avec l'app Budget" }
  const epreuve: EntreePlus = { libelle: "Épreuve", desactivee: false, href: "/apps/saison/nouvelle" }

  if (terrain) return [photo, note]
  if (role === "assistance") return [photo, note]
  if (role === "equipage" || role === "responsable") return [epreuve, depense, photo, note]
  return [depense, photo, note]
}
