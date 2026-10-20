import { describe, expect, it } from "vitest"

import { ipClient } from "./ip-client"

// Entêtes factices : ce que lit ipClient, rien de plus.
function entetes(valeurs: Record<string, string>) {
  return { get: (nom: string) => valeurs[nom.toLowerCase()] ?? null }
}

describe("ipClient", () => {
  it("prend x-real-ip posé par le proxy en premier", () => {
    expect(ipClient(entetes({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1, 203.0.113.7" }))).toBe("203.0.113.7")
  })

  it("prend la dernière valeur de x-forwarded-for, pas la première (falsifiable par le client)", () => {
    expect(ipClient(entetes({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7")
  })

  it("ignore une première valeur inventée quand il n'y a qu'une seule valeur de proxy", () => {
    const menteuse = ipClient(entetes({ "x-forwarded-for": "10.0.0.1, 198.51.100.9" }))
    expect(menteuse).not.toBe("10.0.0.1")
    expect(menteuse).toBe("198.51.100.9")
  })

  it("répond « inconnu » sans aucun entête", () => {
    expect(ipClient(entetes({}))).toBe("inconnu")
    expect(ipClient(entetes({ "x-forwarded-for": " , " }))).toBe("inconnu")
  })
})
