import type { EntreePlus } from "./bouton-plus"

// Entrées du menu « + », filtrées par le rôle. Tant que les apps n'existent pas, chaque
// entrée est désactivée avec sa raison. En mode terrain : Photo et Note seulement.
export function entreesDuMenuPlus(role: string, terrain: boolean): EntreePlus[] {
  if (role === "invite") return []

  const photo: EntreePlus = { libelle: "Photo", desactivee: true, raison: "Bientôt, avec l'app Médias" }
  const note: EntreePlus = { libelle: "Note", desactivee: true, raison: "Bientôt" }
  const depense: EntreePlus = { libelle: "Dépense", desactivee: true, raison: "Bientôt, avec l'app Budget" }

  if (terrain || role === "assistance") return [photo, note]
  return [depense, photo, note]
}
