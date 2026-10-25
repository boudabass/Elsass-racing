import { describe, expect, it } from "vitest"

import {
  emailMasque,
  ficheDeLigne,
  fichesLisibles,
  nomAuteur,
  NOTE_TAILLE_MAX,
  peutAjouterSurFiche,
  peutModifierNote,
  peutRetirer,
  peutVoirFiche,
  validerTexteNote,
  verdictNoteFiche,
} from "./regles"

describe("validerTexteNote", () => {
  it("rogne les espaces et garde le texte", () => {
    expect(validerTexteNote("  Pneu avant gauche usé  ")).toEqual({ ok: true, texte: "Pneu avant gauche usé" })
  })

  it("refuse une note vide ou faite d'espaces, avec la raison en français", () => {
    for (const vide of ["", "   ", "\n\t"]) {
      const verdict = validerTexteNote(vide)
      expect(verdict.ok).toBe(false)
      if (!verdict.ok) expect(verdict.raison).toBe("La note est vide : écris ce qu'il faut retenir.")
    }
  })

  it("accepte jusqu'à la limite et refuse au-delà", () => {
    expect(validerTexteNote("a".repeat(NOTE_TAILLE_MAX)).ok).toBe(true)
    const trop = validerTexteNote("a".repeat(NOTE_TAILLE_MAX + 1))
    expect(trop.ok).toBe(false)
    if (!trop.ok) expect(trop.raison).toBe(`La note dépasse ${NOTE_TAILLE_MAX} caractères.`)
  })
})

describe("droits sur la fiche", () => {
  it("voir : au moins lecture", () => {
    expect(peutVoirFiche("aucun")).toBe(false)
    expect(peutVoirFiche("lecture")).toBe(true)
    expect(peutVoirFiche("gestion")).toBe(true)
  })

  it("ajouter : écriture et plus sur toute la fiche", () => {
    expect(peutAjouterSurFiche({ niveau: "ecriture", affectee: false })).toBe(true)
    expect(peutAjouterSurFiche({ niveau: "gestion", affectee: false })).toBe(true)
  })

  it("ajouter : contribution seulement si la personne est affectée", () => {
    expect(peutAjouterSurFiche({ niveau: "contribution", affectee: true })).toBe(true)
    expect(peutAjouterSurFiche({ niveau: "contribution", affectee: false })).toBe(false)
  })

  it("ajouter : refusé sous la contribution, même affecté", () => {
    expect(peutAjouterSurFiche({ niveau: "lecture", affectee: true })).toBe(false)
    expect(peutAjouterSurFiche({ niveau: "aucun", affectee: true })).toBe(false)
  })

  it("modifier : l'auteur seul, jamais une note sans auteur", () => {
    expect(peutModifierNote({ auteurId: "u1", userId: "u1" })).toBe(true)
    expect(peutModifierNote({ auteurId: "u2", userId: "u1" })).toBe(false)
    expect(peutModifierNote({ auteurId: null, userId: "u1" })).toBe(false)
  })

  it("retirer : l'auteur, ou la gestion qui retire n'importe laquelle", () => {
    expect(peutRetirer({ auteurId: "u1", userId: "u1", gere: false })).toBe(true)
    expect(peutRetirer({ auteurId: "u2", userId: "u1", gere: false })).toBe(false)
    expect(peutRetirer({ auteurId: "u2", userId: "u1", gere: true })).toBe(true)
    expect(peutRetirer({ auteurId: null, userId: "u1", gere: false })).toBe(false)
  })
})

describe("affichage de l'auteur", () => {
  it("masque l'e-mail gardant sa première lettre", () => {
    expect(emailMasque("jean@exemple.fr")).toBe("j***@exemple.fr")
  })

  it("prend prénom et nom de la fiche personne, sinon l'e-mail masqué, sinon un libellé", () => {
    expect(nomAuteur({ prenom: "Marie", nom: "Koehling" }, "m@x.fr")).toBe("Marie Koehling")
    expect(nomAuteur(null, "jean@exemple.fr")).toBe("j***@exemple.fr")
    expect(nomAuteur(null, null)).toBe("Personne inconnue")
  })
})

describe("notes de fiche hors ligne : règles pures", () => {
  const ORDRE = "0190a000-0000-7000-8000-000000000001"

  it("lit la fiche d'une ligne : contenu stocké d'abord, champs envoyés à la création, rien pour une note de team", () => {
    expect(ficheDeLigne({ app: "garage", ficheType: "ordre", ficheId: ORDRE, texte: "x" })).toEqual({ app: "garage", ficheType: "ordre", ficheId: ORDRE })
    expect(ficheDeLigne({ texte: "Note de team" })).toBeNull()
    expect(ficheDeLigne(undefined)).toBeNull()
  })

  it("ne garde une fiche que si l'app et la fiche sont lisibles : « lecture » sur Garage, rien sur Équipe seul", () => {
    const fiches = [{ app: "garage", ficheType: "ordre" }]
    expect(fichesLisibles(fiches, { equipe: "contribution", garage: "lecture" })).toEqual(fiches)
    expect(fichesLisibles(fiches, { equipe: "gestion" })).toEqual([])
    expect(fichesLisibles(fiches, { garage: "aucun", equipe: "gestion" })).toEqual([])
  })

  it("création : refusée sans droit d'ajouter sur la fiche (assistance non affectée)", () => {
    const verdict = verdictNoteFiche({ creation: true, peutVoir: true, peutAjouter: false, auteurId: null, userId: "u1" })
    expect(verdict).toEqual({ ok: false, raison: "Tu ne peux pas ajouter de note à cette fiche." })
    expect(verdictNoteFiche({ creation: true, peutVoir: true, peutAjouter: true, auteurId: null, userId: "u1" })).toEqual({ ok: true })
  })

  it("modification et retrait hors ligne : l'auteur seul, et seulement si la fiche reste visible", () => {
    expect(verdictNoteFiche({ creation: false, peutVoir: true, peutAjouter: false, auteurId: "u2", userId: "u1" }).ok).toBe(false)
    expect(verdictNoteFiche({ creation: false, peutVoir: true, peutAjouter: false, auteurId: "u1", userId: "u1" })).toEqual({ ok: true })
    expect(verdictNoteFiche({ creation: false, peutVoir: false, peutAjouter: false, auteurId: "u1", userId: "u1" }).ok).toBe(false)
  })
})
