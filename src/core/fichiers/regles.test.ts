import { describe, expect, it } from "vitest"

import { cleStockage, detecterType, nomPropre, peutLire, TAILLE_MAX } from "./regles"

const octets = (...valeurs: number[]) => new Uint8Array(valeurs)
const texte = (contenu: string) => new TextEncoder().encode(contenu)

describe("detecterType", () => {
  it("reconnaît un JPEG, un PNG, un WebP et un PDF à leur signature", () => {
    expect(detecterType(octets(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe("image/jpeg")
    expect(detecterType(octets(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe("image/png")
    expect(detecterType(texte("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp")
    expect(detecterType(texte("%PDF-1.7\n"))).toBe("application/pdf")
  })

  it("ne croit pas le nom : un faux .jpg qui contient du texte est refusé", () => {
    expect(detecterType(texte("ceci n'est pas une photo"))).toBeNull()
  })

  it("reconnaît un SVG, y compris avec BOM et espaces, et refuse un texte sans balise svg", () => {
    expect(detecterType(texte('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe("image/svg+xml")
    expect(detecterType(texte('\uFEFF   <svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe("image/svg+xml")
    expect(detecterType(texte("<html><body>svg</body></html>"))).toBeNull()
  })

  it("refuse un contenu binaire qui n'est ni une image ni un PDF", () => {
    expect(detecterType(octets(0x00, 0x01, 0x02, 0xff))).toBeNull()
    expect(detecterType(new Uint8Array(0))).toBeNull()
  })
})

describe("cleStockage", () => {
  it("range par team, année et mois, sans le nom d'origine", () => {
    expect(cleStockage("team-1", "fich-9", new Date("2026-10-18T10:00:00Z"))).toBe("team-1/2026/10/fich-9")
  })
})

describe("nomPropre", () => {
  it("retire les chemins et les caractères interdits", () => {
    expect(nomPropre("C:\\Users\\George\\ticket:<1>.jpg")).toBe("ticket1.jpg")
    expect(nomPropre("../../etc/passwd")).toBe("passwd")
  })

  it("coupe à 120 caractères et met « fichier » quand il ne reste rien", () => {
    expect(nomPropre("a".repeat(200))).toHaveLength(120)
    expect(nomPropre("///")).toBe("fichier")
    expect(nomPropre("")).toBe("fichier")
  })
})

describe("TAILLE_MAX", () => {
  it("vaut 10 Mo", () => {
    expect(TAILLE_MAX).toBe(10 * 1024 * 1024)
  })
})

describe("peutLire", () => {
  const base = { estDansLaTeam: true, rattachements: [], estLogoTeam: false, estAuteur: false }
  const ouvert = { ouvert: true }
  const ferme = { ouvert: false }

  it("refuse hors de la team, quoi qu'il arrive", () => {
    expect(peutLire({ ...base, estDansLaTeam: false, estAuteur: true })).toBe(false)
  })

  it("avec un rattachement, suit sa décision : ouvert pour lire, fermé pour refuser", () => {
    expect(peutLire({ ...base, rattachements: [ouvert] })).toBe(true)
    expect(peutLire({ ...base, rattachements: [ferme] })).toBe(false)
  })

  it("avec plusieurs rattachements, suffit d'un rattachement ouvert", () => {
    expect(peutLire({ ...base, rattachements: [ferme, ouvert] })).toBe(true)
    expect(peutLire({ ...base, rattachements: [ferme, ferme] })).toBe(false)
  })

  it("l'auteur d'un fichier rattaché ne garde aucun accès spécial", () => {
    expect(peutLire({ ...base, rattachements: [ferme], estAuteur: true })).toBe(false)
  })

  it("sans rattachement, seulement le logo de la team ou l'auteur", () => {
    expect(peutLire({ ...base, estLogoTeam: true })).toBe(true)
    expect(peutLire({ ...base, estAuteur: true })).toBe(true)
    expect(peutLire(base)).toBe(false)
  })

  it("le logo courant se lit même rattaché à Réglages, sans ouverture (assistance, invité)", () => {
    expect(peutLire({ ...base, rattachements: [ferme], estLogoTeam: true })).toBe(true)
  })
})
