import { describe, expect, it } from "vitest"

import { dossierStockage } from "./stockage"

describe("dossierStockage", () => {
  it("prend STOCKAGE_DIR quand elle est posée", () => {
    expect(dossierStockage({ STOCKAGE_DIR: "/mnt/volume", NODE_ENV: "production" })).toBe("/mnt/volume")
  })

  it("ignore une valeur vide", () => {
    expect(dossierStockage({ STOCKAGE_DIR: "  ", NODE_ENV: "production" })).toBe("/app/stockage")
  })

  it("utilise le volume Coolify en production, un dossier local ailleurs", () => {
    expect(dossierStockage({ NODE_ENV: "production" })).toBe("/app/stockage")
    expect(dossierStockage({ NODE_ENV: "development" })).toBe("./stockage")
  })
})
