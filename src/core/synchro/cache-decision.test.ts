import { describe, expect, it } from "vitest"

import { doitMettreEnCache } from "./cache-decision"
import { codeServiceWorker } from "./service-worker"

describe("décision de mise en cache", () => {
  it("copie une page HTML réussie, non redirigée", () => {
    expect(doitMettreEnCache({ ok: true, redirected: false, contentType: "text/html; charset=utf-8" })).toBe(true)
  })

  it("ne copie pas une page redirigée, même réussie (session expirée : /qg vers /connexion)", () => {
    expect(doitMettreEnCache({ ok: true, redirected: true, contentType: "text/html; charset=utf-8" })).toBe(false)
  })

  it("ne copie pas une erreur, ni une ressource qui n'est pas du HTML", () => {
    expect(doitMettreEnCache({ ok: false, redirected: false, contentType: "text/html" })).toBe(false)
    expect(doitMettreEnCache({ ok: true, redirected: false, contentType: "application/json" })).toBe(false)
  })

  it("est injectée telle quelle dans le code du service worker", () => {
    const code = codeServiceWorker("essai")
    expect(code).toContain(doitMettreEnCache.toString())
    expect(code).toContain("doitMettreEnCache({")
  })
})
