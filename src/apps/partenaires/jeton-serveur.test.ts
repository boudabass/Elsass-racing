import { describe, expect, it } from "vitest"

import { empreinteJeton, genererJeton } from "./jeton-serveur"

describe("jetons de la page partenaire", () => {
  it("génère 32 octets en base64url, sans rien de différent d'un appel à l'autre", () => {
    const premier = genererJeton()
    expect(premier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(genererJeton()).not.toBe(premier)
  })

  it("calcule l'empreinte sha256 en hexadécimal", () => {
    expect(empreinteJeton("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  })
})
