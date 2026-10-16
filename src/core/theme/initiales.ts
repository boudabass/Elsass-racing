// Initiales de la team, affichées partout (barre haute, logo, aperçu des couleurs) : une seule
// règle. Première lettre des deux premiers mots significatifs. Les mots faits uniquement de
// chiffres et les petits mots sont ignorés, et « d' » ou « l' » sont retirés devant un mot.

const PETITS_MOTS = ["de", "du", "des", "la", "le", "les"]
const ELISIONS = ["l'", "d'"]

export function initialesTeam(nom: string): string {
  const lettres: string[] = []

  nom
    .trim()
    .split(/\s+/)
    .forEach((mot) => {
      if (lettres.length === 2 || mot === "" || /^\d+$/.test(mot)) return
      const minuscule = mot.toLowerCase()
      if (PETITS_MOTS.indexOf(minuscule) >= 0) return

      let utile = mot
      ELISIONS.forEach((elision) => {
        if (minuscule.indexOf(elision) === 0) utile = mot.slice(elision.length)
      })
      if (utile === "") return
      lettres.push(utile.charAt(0).toUpperCase())
    })

  return lettres.join("") || "ER"
}
