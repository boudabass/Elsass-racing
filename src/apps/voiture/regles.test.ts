import { describe, expect, it } from "vitest"

import { gabaritSaxo } from "./gabarits/saxo"
import {
  CHAMPS_REGLAGE,
  comparer,
  emplacementsDepuisGabarit,
  etatPapiers,
  joursAvantEcheance,
  peutRecevoirOccupation,
  preremplir,
  SEUIL_RENOUVELLEMENT_JOURS,
  statutEmplacement,
  statutPapier,
  validerValeurs,
  verifierTransitionOccupation,
} from "./regles"

// Le 18 octobre 2026 à midi, à Paris.
const MAINTENANT = new Date("2026-10-18T10:00:00Z")

describe("papiers : statutPapier", () => {
  it("le seuil de renouvellement est de 30 jours", () => {
    expect(SEUIL_RENOUVELLEMENT_JOURS).toBe(30)
  })

  it("sans échéance, un papier est toujours valide", () => {
    expect(statutPapier(null, MAINTENANT)).toBe("valide")
  })

  it("à plus de 30 jours, valide", () => {
    // 18 octobre + 31 jours = 18 novembre.
    expect(statutPapier(new Date("2026-11-18"), MAINTENANT)).toBe("valide")
  })

  it("à exactement 30 jours, à renouveler", () => {
    expect(statutPapier(new Date("2026-11-17"), MAINTENANT)).toBe("a_renouveler")
  })

  it("le jour même de l'échéance, à renouveler", () => {
    expect(statutPapier(new Date("2026-10-18"), MAINTENANT)).toBe("a_renouveler")
  })

  it("la veille de l'échéance, expiré", () => {
    expect(statutPapier(new Date("2026-10-17"), MAINTENANT)).toBe("expire")
  })

  it("le jour se compte à Paris, pas en UTC", () => {
    // 23 h 30 UTC le 17 octobre, c'est déjà le 18 à Paris : l'échéance du 17 est passée.
    expect(statutPapier(new Date("2026-10-17"), new Date("2026-10-17T23:30:00Z"))).toBe("expire")
    // 21 h 30 UTC le 17 octobre, c'est encore le 17 à Paris (23 h 30) : l'échéance du 17 est le jour même.
    expect(statutPapier(new Date("2026-10-17"), new Date("2026-10-17T21:30:00Z"))).toBe("a_renouveler")
  })

  it("joursAvantEcheance compte les jours civils", () => {
    expect(joursAvantEcheance(new Date("2026-10-28"), MAINTENANT)).toBe(10)
    expect(joursAvantEcheance(new Date("2026-10-08"), MAINTENANT)).toBe(-10)
  })
})

describe("papiers : etatPapiers", () => {
  it("sans papier, valide", () => {
    expect(etatPapiers([], MAINTENANT)).toBe("valide")
  })

  it("renvoie le pire statut : expiré passe avant à renouveler, qui passe avant valide", () => {
    const papiers = [{ valableJusquAu: new Date("2027-06-01") }, { valableJusquAu: new Date("2026-11-01") }, { valableJusquAu: new Date("2026-10-01") }]
    expect(etatPapiers(papiers, MAINTENANT)).toBe("expire")
  })

  it("à renouveler l'emporte sur valide", () => {
    const papiers = [{ valableJusquAu: new Date("2027-06-01") }, { valableJusquAu: new Date("2026-11-01") }]
    expect(etatPapiers(papiers, MAINTENANT)).toBe("a_renouveler")
  })

  it("un papier sans échéance ne fait jamais baisser l'état", () => {
    expect(etatPapiers([{ valableJusquAu: null }], MAINTENANT)).toBe("valide")
  })
})

describe("emplacements : emplacementsDepuisGabarit", () => {
  const emplacements = emplacementsDepuisGabarit(gabaritSaxo)

  it("crée les emplacements de la vue droite, les miroirs de la vue gauche, et les hors plan", () => {
    const parVue = (vue: string) => emplacements.filter((e) => e.vue === vue).length
    expect(parVue("droite")).toBe(6)
    expect(parVue("gauche")).toBe(5)
    expect(parVue("hors_plan")).toBe(4)
    expect(emplacements).toHaveLength(15)
  })

  it("seuls les emplacements symétriques ont un miroir à gauche", () => {
    const gauche = emplacements.filter((e) => e.vue === "gauche").map((e) => e.nom)
    expect(gauche).toEqual(["Portière", "Custode arrière", "Aile avant", "Aile arrière", "Bas de caisse"])
    expect(gauche).not.toContain("Bandeau de pare-brise")
  })

  it("le miroir reprend la forme de la vue droite", () => {
    const droite = emplacements.find((e) => e.vue === "droite" && e.nom === "Portière")
    const miroir = emplacements.find((e) => e.vue === "gauche" && e.nom === "Portière")
    expect(miroir?.forme).toEqual(droite?.forme)
  })

  it("tous les emplacements sont créés libres", () => {
    expect(emplacements.every((e) => e.statut === "libre")).toBe(true)
  })
})

describe("emplacements : statut et occupations", () => {
  it("sans occupation, libre", () => {
    expect(statutEmplacement(null)).toBe("libre")
  })

  it("une occupation réservée donne réservé, un logo posé donne occupé", () => {
    expect(statutEmplacement({ statut: "reserve" })).toBe("reserve")
    expect(statutEmplacement({ statut: "pose" })).toBe("occupe")
  })

  it("indisponible prime sur tout le reste", () => {
    expect(statutEmplacement(null, true)).toBe("indisponible")
    expect(statutEmplacement({ statut: "pose" }, true)).toBe("indisponible")
  })

  it("un emplacement indisponible ne peut pas recevoir d'occupation", () => {
    expect(peutRecevoirOccupation("indisponible")).toBe(false)
    expect(peutRecevoirOccupation("libre")).toBe(true)
    expect(peutRecevoirOccupation("reserve")).toBe(true)
  })

  it("réservé vers posé ou retiré, posé vers retiré : autorisé", () => {
    expect(verifierTransitionOccupation("reserve", "pose")).toEqual({ ok: true })
    expect(verifierTransitionOccupation("reserve", "retire")).toEqual({ ok: true })
    expect(verifierTransitionOccupation("pose", "retire")).toEqual({ ok: true })
  })

  it("toute autre transition est refusée avec un message en français", () => {
    const pose = verifierTransitionOccupation("pose", "reserve")
    expect(pose.ok).toBe(false)
    if (!pose.ok) expect(pose.message).toMatch(/posé/)
    expect(verifierTransitionOccupation("retire", "pose").ok).toBe(false)
    expect(verifierTransitionOccupation("reserve", "reserve").ok).toBe(false)
  })
})

describe("réglages : champs", () => {
  it("les clés sont uniques", () => {
    const cles = CHAMPS_REGLAGE.map((c) => c.cle)
    expect(new Set(cles).size).toBe(cles.length)
  })

  it("les essentiels sont les huit pressions et les deux hauteurs de caisse", () => {
    const essentiels = CHAMPS_REGLAGE.filter((c) => c.groupe === "essentiel").map((c) => c.cle)
    expect(essentiels).toHaveLength(10)
    expect(essentiels).toContain("pression_froid_avg")
    expect(essentiels).toContain("pression_chaud_ard")
    expect(essentiels).toContain("hauteur_caisse_arriere")
  })

  it("chaque champ a un libellé et une unité", () => {
    for (const champ of CHAMPS_REGLAGE) {
      expect(champ.libelle.length).toBeGreaterThan(0)
      expect(typeof champ.unite).toBe("string")
    }
  })
})

describe("réglages : validerValeurs", () => {
  it("accepte des valeurs connues, dans les bornes", () => {
    expect(validerValeurs({ pression_froid_avg: 2.1, pression_chaud_avd: 2.4, hauteur_caisse_avant: 120 })).toEqual([])
  })

  it("accepte les bornes 0,5 et 4 bar", () => {
    expect(validerValeurs({ pression_froid_avg: 0.5, pression_froid_avd: 4 })).toEqual([])
  })

  it("refuse une clé inconnue", () => {
    const erreurs = validerValeurs({ turbo: 1 })
    expect(erreurs).toEqual(["Champ inconnu : turbo."])
  })

  it("refuse une pression hors de 0,5 à 4 bar", () => {
    expect(validerValeurs({ pression_froid_avg: 0.4 })).toHaveLength(1)
    expect(validerValeurs({ pression_chaud_ard: 4.1 })).toHaveLength(1)
  })

  it("refuse une pression qui n'est pas un nombre", () => {
    expect(validerValeurs({ pression_froid_avg: "deux" })).toHaveLength(1)
  })
})

describe("réglages : preremplir", () => {
  const derniere = { pression_froid_avg: 2.0 }
  const reference = { pression_froid_avg: 2.3, rapport_pont: "9/41" }

  it("la fiche de référence l'emporte sur la dernière fiche", () => {
    expect(preremplir(derniere, reference)).toEqual(reference)
  })

  it("sans référence, la dernière fiche du véhicule", () => {
    expect(preremplir(derniere, null)).toEqual(derniere)
  })

  it("sans rien, vide", () => {
    expect(preremplir(null, null)).toEqual({})
  })

  it("renvoie une copie, pas la fiche d'origine", () => {
    const copie = preremplir(derniere, null)
    copie.pression_froid_avg = 9
    expect(derniere.pression_froid_avg).toBe(2.0)
  })
})

describe("réglages : comparer", () => {
  it("renvoie une ligne par champ, dans l'ordre du catalogue, avec le drapeau de différence", () => {
    const resultat = comparer({ pression_froid_avg: 2.0, rapport_pont: "9/41" }, { pression_froid_avg: 2.0, rapport_pont: "10/41" })
    expect(resultat).toHaveLength(CHAMPS_REGLAGE.length)
    expect(resultat[0]).toMatchObject({ cle: "pression_froid_avg", a: 2.0, b: 2.0, different: false })
    const pont = resultat.find((l) => l.cle === "rapport_pont")
    expect(pont).toMatchObject({ a: "9/41", b: "10/41", different: true })
  })

  it("un champ absent d'une des deux fiches compte comme différent, et vaut null", () => {
    const resultat = comparer({ pression_froid_avg: 2.0 }, {})
    expect(resultat[0]).toMatchObject({ a: 2.0, b: null, different: true })
  })
})
