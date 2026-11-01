import { describe, expect, it, vi } from "vitest"

import { declarationDe, toutesLesDeclarations } from "./registre"

vi.mock("@/lib/prisma", () => ({ prisma: {}, prismaPourTeam: () => ({}), executerPourTeam: async () => undefined }))

// Les options ajoutées pour Check-lists (règle « controle », modification gardée, filtre de lecture par fiche) sont
// facultatives : aucune table déjà en place n'en use. Leur comportement reste celui d'avant.
const TABLES_EXISTANTES = [
  "core_note",
  "saison_stage",
  "saison_schedule_item",
  "saison_recce",
  "saison_recce_session",
  "saison_debrief",
  "core_event",
  "budget_expense",
  "budget_category",
  "budget_payer",
  "voiture_setup",
  "core_vehicle",
  "voiture_setup_template",
  "garage_work_order",
  "garage_vehicle_component",
  "garage_component_type",
]

describe("registre de synchro : options facultatives", () => {
  it("les tables déjà en place gardent leur règle de contribution d'avant (pas « controle »)", () => {
    for (const cle of TABLES_EXISTANTES) {
      const declaration = declarationDe(cle)
      expect(declaration, cle).toBeDefined()
      expect(declaration?.regleContribution, cle).not.toBe("controle")
      expect(declaration?.controleContribution, cle).toBeUndefined()
    }
  })

  it("une table ajoutée pour Check-lists déclare la règle « controle » et son contrôle", () => {
    const item = declarationDe("checklist_item")
    expect(item?.regleContribution).toBe("controle")
    expect(typeof item?.controleContribution).toBe("function")
    expect(item?.contributionPropre).toBe(true)
  })

  it("les listes et les sections de Check-lists sont en lecture seule, les points non", () => {
    expect(declarationDe("checklist_list")?.lectureSeule).toBe(true)
    expect(declarationDe("checklist_section")?.lectureSeule).toBe(true)
    expect(declarationDe("checklist_item")?.lectureSeule).toBe(false)
  })

  it("chaque clé du registre est unique", () => {
    const cles = toutesLesDeclarations().map((d) => d.cle)
    expect(new Set(cles).size).toBe(cles.length)
  })
})
