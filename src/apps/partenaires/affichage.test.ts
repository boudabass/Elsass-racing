import { describe, expect, it } from "vitest"

import { centimesDeSaisie, compterParStatut, couleurBarreContrepartie, couleurContrepartie, dateFrancaise, ecartRelance, filtreStatut, trierProspection } from "./affichage"

describe("ecartRelance", () => {
  const aujourdhui = "2026-10-18"

  it("dit « aujourd'hui » le jour même, en orange", () => {
    expect(ecartRelance("2026-10-18", aujourdhui)).toEqual({ libelle: "aujourd'hui", ton: "aujourdhui" })
  })

  it("compte les jours à venir, au singulier et au pluriel", () => {
    expect(ecartRelance("2026-10-21", aujourdhui)).toEqual({ libelle: "dans 3 jours", ton: "avenir" })
    expect(ecartRelance("2026-10-19", aujourdhui)).toEqual({ libelle: "dans 1 jour", ton: "avenir" })
  })

  it("compte les jours de retard, en rouge", () => {
    expect(ecartRelance("2026-10-16", aujourdhui)).toEqual({ libelle: "en retard de 2 jours", ton: "retard" })
  })

  it("traverse un changement de mois sans erreur", () => {
    expect(ecartRelance("2026-11-02", aujourdhui)).toEqual({ libelle: "dans 15 jours", ton: "avenir" })
  })

  it("ne dit rien quand il n'y a pas de relance", () => {
    expect(ecartRelance(null, aujourdhui)).toBeNull()
  })
})

describe("trierProspection", () => {
  it("met les retards d'abord, puis les relances à venir par date, puis les autres par nom", () => {
    const liste = [
      { entreprise: "Zèbre", prochaineRelance: null },
      { entreprise: "Atelier", prochaineRelance: "2026-10-30" },
      { entreprise: "Boulangerie", prochaineRelance: "2026-10-10" },
      { entreprise: "Garage", prochaineRelance: "2026-10-12" },
      { entreprise: "Abeille", prochaineRelance: null },
      { entreprise: "Cabinet", prochaineRelance: "2026-10-18" },
    ]
    const ordre = trierProspection(liste, "2026-10-18").map((p) => p.entreprise)
    expect(ordre).toEqual(["Boulangerie", "Garage", "Cabinet", "Atelier", "Abeille", "Zèbre"])
  })
})

describe("compterParStatut et filtreStatut", () => {
  it("compte chaque statut et le total, même à zéro", () => {
    const compte = compterParStatut([{ statut: "contacte" }, { statut: "contacte" }, { statut: "refus" }])
    expect(compte.total).toBe(3)
    expect(compte.contacte).toBe(2)
    expect(compte.refus).toBe(1)
    expect(compte.partenaire).toBe(0)
  })

  it("n'accepte que les statuts connus dans l'URL", () => {
    expect(filtreStatut("relance")).toBe("relance")
    expect(filtreStatut("inventé")).toBeNull()
    expect(filtreStatut(undefined)).toBeNull()
  })
})

describe("centimesDeSaisie", () => {
  it("lit les montants saisis en euros, avec espaces et virgule", () => {
    expect(centimesDeSaisie("1 500")).toBe(150000)
    expect(centimesDeSaisie("1500,50")).toBe(150050)
    expect(centimesDeSaisie("")).toBe(0)
  })

  it("refuse un texte qui n'est pas un montant positif", () => {
    expect(centimesDeSaisie("abc")).toBeNull()
    expect(centimesDeSaisie("-3")).toBeNull()
  })
})

describe("couleurContrepartie et dateFrancaise", () => {
  it("passe en orange une contrepartie à faire dont l'échéance tombe dans les 14 jours", () => {
    expect(couleurContrepartie("a_faire", "2026-10-30", "2026-10-18")).toBe("text-etat-orange")
    expect(couleurContrepartie("a_faire", "2026-12-30", "2026-10-18")).toBe("text-texte")
  })

  it("colore la barre en vert, orange, rouge ou gris, jamais en couleur de marque", () => {
    expect(couleurBarreContrepartie("tenue", null, "2026-10-18")).toBe("bg-etat-ok")
    expect(couleurBarreContrepartie("a_faire", "2026-10-30", "2026-10-18")).toBe("bg-etat-orange")
    expect(couleurBarreContrepartie("en_retard", "2026-10-01", "2026-10-18")).toBe("bg-etat-rouge")
    expect(couleurBarreContrepartie("en_cours", "2026-12-30", "2026-10-18")).toBe("bg-texte-discret")
    expect(couleurBarreContrepartie("reportee", null, "2026-10-18")).not.toContain("marque")
  })

  it("met en rouge le retard et en vert la tenue", () => {
    expect(couleurContrepartie("en_retard", "2026-10-01", "2026-10-18")).toContain("text-etat-rouge")
    expect(couleurContrepartie("tenue", null, "2026-10-18")).toBe("text-etat-ok")
  })

  it("écrit une date civile à la française", () => {
    expect(dateFrancaise("2027-06-30")).toBe("30/06/2027")
    expect(dateFrancaise(null)).toBe("")
  })
})
