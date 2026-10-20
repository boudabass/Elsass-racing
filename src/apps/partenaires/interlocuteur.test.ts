import { describe, expect, it } from "vitest"

import { interlocuteurSaisi } from "./interlocuteur"

describe("interlocuteur saisi en deux champs", () => {
  it("prénom et nom vides : pas d'interlocuteur, sans erreur", () => {
    expect(interlocuteurSaisi("", "")).toEqual({ ok: true, personne: null })
    expect(interlocuteurSaisi("   ", "  ")).toEqual({ ok: true, personne: null })
  })

  it("prénom et nom remplis ensemble : la personne est enregistrée, sans les espaces autour", () => {
    expect(interlocuteurSaisi("  Marc ", " Dupont")).toEqual({ ok: true, personne: { prenom: "Marc", nom: "Dupont" } })
  })

  it("un nom composé reste en un seul bloc dans le champ Nom", () => {
    expect(interlocuteurSaisi("Jean", "De la Fontaine")).toEqual({ ok: true, personne: { prenom: "Jean", nom: "De la Fontaine" } })
  })

  it("prénom seul : refusé, et le message demande le nom", () => {
    const resultat = interlocuteurSaisi("Marc", "")
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.message).toContain("nom")
  })

  it("nom seul : refusé, et le message demande le prénom", () => {
    const resultat = interlocuteurSaisi("", "Dupont")
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.message).toContain("prénom")
  })
})
