import { describe, expect, it } from "vitest"

import { libelleEtat } from "@/components/qg/grille-qg"

describe("ligne d'état d'une tuile", () => {
  it("compte les actions d'abord, au singulier et au pluriel", () => {
    expect(libelleEtat({ actions: 1, alerte: null, alertes: 0, taches: 0 })).toBe("1 action à traiter")
    expect(libelleEtat({ actions: 2, alerte: null, alertes: 0, taches: 0 })).toBe("2 actions à traiter")
  })

  it("donne ensuite l'alerte, puis la tâche", () => {
    expect(libelleEtat({ actions: 0, alerte: "orange", alertes: 1, taches: 3 })).toBe("1 alerte")
    expect(libelleEtat({ actions: 0, alerte: null, alertes: 0, taches: 3 })).toBe("3 tâches à faire")
  })

  it("dit que tout est en ordre sans rien à traiter", () => {
    expect(libelleEtat({ actions: 0, alerte: null, alertes: 0, taches: 0 })).toBe("Tout est en ordre")
  })
})
