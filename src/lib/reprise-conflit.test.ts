import { describe, expect, it, vi } from "vitest"

import { ESSAIS_CONFLIT, avecReprisePourConflit, estConflitEcriture } from "./reprise-conflit"

const conflit = () => Object.assign(new Error("Transaction conflict"), { code: "P2034" })

describe("reprise sur conflit d'écriture (P2034)", () => {
  it("reconnaît le code P2034 et lui seul", () => {
    expect(estConflitEcriture(conflit())).toBe(true)
    expect(estConflitEcriture(Object.assign(new Error("Unique"), { code: "P2002" }))).toBe(false)
    expect(estConflitEcriture(new Error("sans code"))).toBe(false)
    expect(estConflitEcriture(null)).toBe(false)
  })

  it("rend le résultat sans reprise quand l'opération réussit du premier coup", async () => {
    const operation = vi.fn(async () => "ok")
    await expect(avecReprisePourConflit(operation)).resolves.toBe("ok")
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it("reprend après un conflit et rend le résultat du nouvel essai", async () => {
    const operation = vi.fn().mockRejectedValueOnce(conflit()).mockResolvedValueOnce("ok")
    await expect(avecReprisePourConflit(operation)).resolves.toBe("ok")
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it("s'arrête à trois essais et remonte le dernier conflit", async () => {
    const operation = vi.fn().mockRejectedValue(conflit())
    await expect(avecReprisePourConflit(operation)).rejects.toMatchObject({ code: "P2034" })
    expect(operation).toHaveBeenCalledTimes(ESSAIS_CONFLIT)
    expect(ESSAIS_CONFLIT).toBe(3)
  })

  it("ne reprend pas une autre erreur de base", async () => {
    const operation = vi.fn().mockRejectedValue(Object.assign(new Error("Unique"), { code: "P2002" }))
    await expect(avecReprisePourConflit(operation)).rejects.toMatchObject({ code: "P2002" })
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
