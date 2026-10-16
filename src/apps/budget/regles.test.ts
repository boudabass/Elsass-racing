import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  MESSAGE_LIGNE_TROP_GRANDE,
  aRembourser,
  confirmeeDOffice,
  coutAuKm,
  coutMoyen,
  coutParEpreuve,
  depensesVisibles,
  ecartPrevisionnel,
  franchissementPrevisionnel,
  resteDu,
  soldeMembre,
  statutRemboursement,
  verifierLigne,
} from "./regles"

const MOI = "personne-1"
const AUTRE = "personne-2"

describe("à rembourser", () => {
  it("seule une dépense payée par un membre est à rembourser", () => {
    expect(aRembourser("membre")).toBe(true)
    expect(aRembourser("caisse_team")).toBe(false)
    expect(aRembourser("compte_association")).toBe(false)
  })
})

describe("statut de remboursement", () => {
  const depense = { montant: 10_000, aRembourser: true }

  it("non concernée quand la dépense n'est pas à rembourser", () => {
    expect(statutRemboursement({ montant: 10_000, aRembourser: false }, [])).toBe("non_concerne")
  })

  it("à rembourser sans ligne, partiel puis complet avec ses lignes", () => {
    expect(statutRemboursement(depense, [])).toBe("a_rembourser")
    expect(statutRemboursement(depense, [4_000])).toBe("partiel")
    expect(statutRemboursement(depense, [4_000, 6_000])).toBe("rembourse")
  })

  it("le reste dû diminue avec les lignes et ne descend pas sous zéro", () => {
    expect(resteDu(10_000, [])).toBe(10_000)
    expect(resteDu(10_000, [4_000, 6_000])).toBe(0)
  })

  it("une ligne qui dépasse le reste dû est refusée, avec son message", () => {
    expect(verifierLigne(3_000, 3_001)).toBe(MESSAGE_LIGNE_TROP_GRANDE)
    expect(verifierLigne(3_000, 3_000)).toBeNull()
    expect(verifierLigne(3_000, 0)).not.toBeNull()
  })
})

describe("solde par membre", () => {
  const depenses = [
    { montant: 5_000, confirmee: true, aRembourser: true, personneId: MOI },
    { montant: 3_000, confirmee: false, aRembourser: true, personneId: MOI },
    { montant: 2_000, confirmee: true, aRembourser: false, personneId: MOI },
    { montant: 4_000, confirmee: true, aRembourser: true, personneId: AUTRE },
  ]

  it("somme les dépenses confirmées à rembourser, moins ses remboursements", () => {
    expect(soldeMembre(MOI, depenses, [])).toEqual({ du: 5_000, trop: 0 })
    expect(soldeMembre(MOI, depenses, [{ personneId: MOI, montant: 1_500 }])).toEqual({ du: 3_500, trop: 0 })
  })

  it("un trop-perçu n'est jamais un solde négatif : il est renvoyé à part pour être signalé", () => {
    expect(soldeMembre(MOI, depenses, [{ personneId: MOI, montant: 6_000 }])).toEqual({ du: 0, trop: 1_000 })
  })
})

describe("coûts", () => {
  const depenses = [
    { montant: 1_000, confirmee: true, eventId: "rallye-1" },
    { montant: 500, confirmee: false, eventId: "rallye-1" },
    { montant: 2_000, confirmee: true, eventId: "rallye-2" },
  ]

  it("coût par épreuve : seules les dépenses confirmées comptent", () => {
    expect(coutParEpreuve(depenses, "rallye-1")).toBe(1_000)
    expect(coutParEpreuve(depenses, "absente")).toBe(0)
  })

  it("coût moyen : null sans épreuve, arrondi sinon", () => {
    expect(coutMoyen([])).toBeNull()
    expect(coutMoyen([1_000, 2_000])).toBe(1_500)
    expect(coutMoyen([1_000, 1_001])).toBe(1_001)
  })

  it("coût du km : null sans km chronométré, sinon centimes par km", () => {
    expect(coutAuKm(10_000, 0)).toBeNull()
    expect(coutAuKm(10_000, 40)).toBe(250)
  })
})

describe("écart au prévisionnel", () => {
  it("vert jusqu'à 90 %, orange de 90 à 100 %, rouge au-delà", () => {
    expect(ecartPrevisionnel(10_000, 9_000).couleur).toBe("vert")
    expect(ecartPrevisionnel(10_000, 9_001).couleur).toBe("orange")
    expect(ecartPrevisionnel(10_000, 10_000).couleur).toBe("orange")
    expect(ecartPrevisionnel(10_000, 10_001).couleur).toBe("rouge")
  })

  it("donne l'écart en centimes et le pourcentage", () => {
    expect(ecartPrevisionnel(10_000, 12_500)).toEqual({ ecart: 2_500, pourcent: 125, couleur: "rouge" })
  })

  it("sans prévu : rouge dès qu'il y a une dépense", () => {
    expect(ecartPrevisionnel(0, 0).couleur).toBe("vert")
    expect(ecartPrevisionnel(0, 100).couleur).toBe("rouge")
  })
})

describe("confirmation", () => {
  it("une dépense saisie est confirmée d'office, une dépense proposée attend un humain", () => {
    expect(confirmeeDOffice("saisie")).toBe(true)
    expect(confirmeeDOffice("proposee")).toBe(false)
  })
})

describe("dépassement du prévisionnel", () => {
  it("vrai seulement au franchissement du prévu", () => {
    expect(franchissementPrevisionnel(10_000, 9_000, 11_000)).toBe(true)
    expect(franchissementPrevisionnel(10_000, 11_000, 12_000)).toBe(false)
    expect(franchissementPrevisionnel(10_000, 8_000, 9_000)).toBe(false)
  })

  it("le franchissement exact du prévu compte, sans prévu rien n'est franchi", () => {
    expect(franchissementPrevisionnel(10_000, 9_000, 10_000)).toBe(false)
    expect(franchissementPrevisionnel(10_000, 10_000, 10_001)).toBe(true)
    expect(franchissementPrevisionnel(null, 0, 99_999)).toBe(false)
  })
})

describe("visibilité en contribution", () => {
  const depenses = [
    { id: "a", personneId: MOI },
    { id: "b", personneId: AUTRE },
  ]

  it("sans écriture : seulement ses propres dépenses", () => {
    expect(depensesVisibles(depenses, "contribution", MOI).map((depense) => depense.id)).toEqual(["a"])
    expect(depensesVisibles(depenses, "lecture", MOI).map((depense) => depense.id)).toEqual(["a"])
    expect(depensesVisibles(depenses, "contribution", null)).toEqual([])
  })

  it("à partir de l'écriture : tout est lisible", () => {
    expect(depensesVisibles(depenses, "ecriture", MOI)).toHaveLength(2)
    expect(depensesVisibles(depenses, "gestion", null)).toHaveLength(2)
  })
})

// Le schéma décrit bien les huit tables de Budget, avec les conventions du socle et les montants en centimes.
describe("schéma Budget", () => {
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8")
  const TABLES = ["budget_category", "budget_payer", "budget_expense", "budget_income", "budget_forecast", "budget_reimbursement", "budget_reimbursement_line", "budget_suggestion"]

  function bloc(table: string): string {
    const debut = schema.indexOf(`@@map("${table}")`)
    const modele = schema.lastIndexOf("\nmodel ", debut)
    return schema.slice(modele, debut)
  }

  it("huit tables, préfixées budget_, avec le bloc commun", () => {
    for (const table of TABLES) {
      const contenu = bloc(table)
      expect(contenu, table).toContain('@map("team_id")')
      expect(contenu, table).toContain('@map("created_at")')
      expect(contenu, table).toContain('@map("deleted_at")')
      expect(contenu, table).toContain("rev")
      expect(contenu, table).not.toContain("@default(uuid())")
    }
  })

  it("les montants sont des entiers accompagnés d'une devise", () => {
    for (const table of ["budget_expense", "budget_income", "budget_forecast", "budget_reimbursement", "budget_reimbursement_line", "budget_suggestion"]) {
      const contenu = bloc(table)
      expect(contenu, table).toMatch(/montant\s+Int/)
      expect(contenu, table).toMatch(/devise\s+String\s+@default\("EUR"\)/)
    }
  })

  it("les dates calendaires sont en @db.Date", () => {
    expect(bloc("budget_expense")).toMatch(/date\s+DateTime\s+@db\.Date/)
    expect(bloc("budget_income")).toMatch(/date\s+DateTime\s+@db\.Date/)
  })
})
