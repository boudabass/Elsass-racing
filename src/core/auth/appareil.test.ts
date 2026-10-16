import { describe, expect, it } from "vitest"

import { nomDeAppareil } from "./appareil"

describe("nomDeAppareil", () => {
  it("reconnaît Chrome sur Windows", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
    expect(nomDeAppareil(ua)).toBe("Chrome sur Windows")
  })

  it("reconnaît Edge avant Chrome, puisqu'Edge contient aussi « Chrome/ »", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0"
    expect(nomDeAppareil(ua)).toBe("Edge sur Windows")
  })

  it("reconnaît Safari sur iPhone", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
    expect(nomDeAppareil(ua)).toBe("Safari sur iOS")
  })

  it("retombe sur une valeur générique sans user-agent", () => {
    expect(nomDeAppareil(null)).toBe("Navigateur sur système inconnu")
    expect(nomDeAppareil("")).toBe("Navigateur sur système inconnu")
  })
})
