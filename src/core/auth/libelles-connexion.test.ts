import { describe, expect, it } from "vitest"

import { LIBELLES_DEMANDE_CONNEXION } from "./libelles-connexion"

describe("libellés de la demande de connexion", () => {
  it("couvre chaque raison, dont l'échec d'envoi", () => {
    for (const raison of ["email", "trop_de_demandes", "envoi"] as const) {
      expect(LIBELLES_DEMANDE_CONNEXION[raison]).toBeTruthy()
    }
    expect(LIBELLES_DEMANDE_CONNEXION.envoi).toContain("Impossible d'envoyer le mail")
  })
})
