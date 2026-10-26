import { describe, expect, it } from "vitest"

import { libelleMeilleureClasse, libelleMeilleurScratch, libelleRang } from "./libelles"

describe("classements en vocabulaire du rallye", () => {
  it("1er, 2e, 12e", () => {
    expect(libelleRang(1)).toBe("1er")
    expect(libelleRang(2)).toBe("2e")
    expect(libelleRang(12)).toBe("12e")
  })

  it("au scratch : « 1er au scratch », « 12e au scratch »", () => {
    expect(libelleMeilleurScratch(1)).toBe("1er au scratch")
    expect(libelleMeilleurScratch(12)).toBe("12e au scratch")
  })

  it("de classe : « 3e de classe »", () => {
    expect(libelleMeilleureClasse(3)).toBe("3e de classe")
  })

  it("rang inconnu : « — », au scratch comme en classe", () => {
    expect(libelleMeilleurScratch(null)).toBe("—")
    expect(libelleMeilleureClasse(null)).toBe("—")
  })
})
