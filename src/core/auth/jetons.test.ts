import { describe, expect, it } from "vitest"

import {
  calculerExpiration,
  estFormatCode,
  genererCode,
  genererSecretLien,
  hacherCode,
  hacherSecret,
  schemaEmail,
} from "./jetons"

describe("génération du code", () => {
  it("donne toujours 6 chiffres, zéros de tête compris", () => {
    for (let i = 0; i < 2000; i++) {
      const code = genererCode()
      expect(code).toMatch(/^\d{6}$/)
      expect(estFormatCode(code)).toBe(true)
    }
  })

  it("rejette ce qui n'est pas exactement 6 chiffres", () => {
    expect(estFormatCode("12345")).toBe(false)
    expect(estFormatCode("1234567")).toBe(false)
    expect(estFormatCode("12a456")).toBe(false)
    expect(estFormatCode("")).toBe(false)
  })
})

describe("génération du secret de lien", () => {
  it("encode 32 octets en base64url, sans caractères spéciaux d'URL", () => {
    const secret = genererSecretLien()
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it("ne se répète pas sur 1000 tirages", () => {
    const secrets = new Set(Array.from({ length: 1000 }, () => genererSecretLien()))
    expect(secrets.size).toBe(1000)
  })
})

describe("hachage", () => {
  it("donne un SHA-256 hexadécimal de 64 caractères, stable", () => {
    const h = hacherSecret("secret")
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(hacherSecret("secret")).toBe(h)
    expect(hacherSecret("autre")).not.toBe(h)
  })

  it("lie le code à l'adresse : même code, adresses différentes, hachages différents", () => {
    expect(hacherCode("a@exemple.fr", "123456")).not.toBe(hacherCode("b@exemple.fr", "123456"))
  })

  it("ne stocke pas le secret en clair", () => {
    expect(hacherSecret("123456")).not.toContain("123456")
  })
})

describe("expiration", () => {
  it("ajoute la durée en minutes au moment de référence", () => {
    const maintenant = new Date("2026-10-16T10:00:00Z")
    expect(calculerExpiration(maintenant, 15).toISOString()).toBe("2026-10-16T10:15:00.000Z")
    expect(calculerExpiration(maintenant, 10).toISOString()).toBe("2026-10-16T10:10:00.000Z")
  })
})

describe("adresse e-mail", () => {
  it("normalise en minuscules et supprime les espaces", () => {
    expect(schemaEmail.parse("  Theelsassisch@Gmail.COM ")).toBe("theelsassisch@gmail.com")
  })

  it("refuse une adresse invalide", () => {
    expect(schemaEmail.safeParse("pas-une-adresse").success).toBe(false)
    expect(schemaEmail.safeParse("").success).toBe(false)
  })
})
