import { describe, expect, it } from "vitest"

import { baseUrlPublique } from "./url-publique"

describe("baseUrlPublique", () => {
  it("prend APP_URL en production, même si la requête vient de 0.0.0.0", () => {
    expect(
      baseUrlPublique({ enProduction: true, appUrl: "https://elsass-racing.theelsassisch.com", origine: "http://0.0.0.0:3000" }),
    ).toBe("https://elsass-racing.theelsassisch.com")
  })

  it("retire les barres finales de APP_URL", () => {
    expect(baseUrlPublique({ enProduction: true, appUrl: "http://localhost:3200/", origine: undefined })).toBe("http://localhost:3200")
  })

  it("refuse la production sans APP_URL plutôt que de bâtir une adresse sur l'origine", () => {
    expect(() => baseUrlPublique({ enProduction: true, appUrl: undefined, origine: "http://0.0.0.0:3000" })).toThrow(/APP_URL/)
  })

  it("prend l'origine de la requête en développement", () => {
    expect(baseUrlPublique({ enProduction: false, appUrl: "http://localhost:3000", origine: "http://localhost:3100" })).toBe(
      "http://localhost:3100",
    )
  })

  it("se rabat sur APP_URL en développement hors requête, puis sur localhost", () => {
    expect(baseUrlPublique({ enProduction: false, appUrl: "http://localhost:3000", origine: undefined })).toBe("http://localhost:3000")
    expect(baseUrlPublique({ enProduction: false, appUrl: undefined, origine: undefined })).toBe("http://localhost:3000")
  })
})
