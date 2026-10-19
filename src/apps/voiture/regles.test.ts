import { describe, expect, it } from "vitest"

import { gabaritSaxo } from "./gabarits/saxo"
import type { VueGabarit } from "./gabarits/types"
import {
  CHAMPS_REGLAGE,
  comparer,
  emplacementsDepuisGabarit,
  planComplement,
  etatPapiers,
  etatPapiersVehicule,
  joursAvantEcheance,
  peutRecevoirOccupation,
  preremplir,
  SEUIL_RENOUVELLEMENT_JOURS,
  statutEmplacement,
  trierPapiers,
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

  it("une ligne par côté pour chaque symétrique, et une ligne pour chaque autre emplacement : 16 pour la Saxo", () => {
    const parVue = (vue: string) => emplacements.filter((e) => e.vue === vue).length
    expect(parVue("droite")).toBe(6)
    expect(parVue("gauche")).toBe(5)
    expect(parVue("avant")).toBe(1)
    expect(parVue("arriere")).toBe(2)
    expect(parVue("dessus")).toBe(2)
    expect(parVue("hors_plan")).toBe(0)
    expect(emplacements).toHaveLength(16)
  })

  it("le côté est dans le nom stocké, à droite comme à gauche", () => {
    const gauche = emplacements.filter((e) => e.vue === "gauche").map((e) => e.nom)
    expect(gauche).toEqual([
      "Portière gauche",
      "Custode arrière gauche",
      "Aile avant gauche",
      "Aile arrière gauche",
      "Bas de caisse gauche",
    ])
    expect(emplacements.find((e) => e.vue === "droite" && e.nom === "Portière droite")).toBeDefined()
    expect(emplacements.find((e) => e.nom === "Bandeau de pare-brise")?.symetrique).toBe(false)
  })

  it("la forme gauche est la forme droite retournée autour de l'axe du viewBox", () => {
    const droite = emplacements.find((e) => e.nom === "Portière droite")
    const gauche = emplacements.find((e) => e.nom === "Portière gauche")
    expect(droite?.forme).toEqual({ type: "rect", x: 150.7, y: 61.2, l: 87.1, h: 17.4 })
    expect(gauche?.forme?.type).toBe("rect")
    if (gauche?.forme?.type === "rect") {
      expect(gauche.forme.x).toBeCloseTo(370 - 150.7 - 87.1)
      expect(gauche.forme.y).toBe(61.2)
      expect(gauche.forme.l).toBe(87.1)
    }
  })

  it("chaque emplacement de la Saxo a une forme, et tous sont créés libres", () => {
    expect(emplacements.every((e) => e.forme !== null)).toBe(true)
    expect(emplacements.every((e) => e.statut === "libre")).toBe(true)
  })
})

describe("emplacements : complément d'un véhicule existant", () => {
  const attendus = emplacementsDepuisGabarit(gabaritSaxo)
  const CENTRE = { type: "rect" as const, x: 155, y: 70, l: 60, h: 20 }
  // Les lignes d'un véhicule, avec un id stable par ligne (le complément ne doit jamais le changer). Libre par défaut.
  const lignes = (rangees: Array<{ vue: VueGabarit; nom: string; libre?: boolean }>) =>
    rangees.map((r, i) => ({ id: `id-${i}`, vue: r.vue, nom: r.nom, libre: r.libre ?? true }))
  const options = (vueAjout: "droite" | "gauche" | "avant" | "arriere" | "dessus" = "dessus") => ({
    nomsRetires: gabaritSaxo.nomsRetires ?? [],
    vueAjout,
    formeAjout: CENTRE,
  })
  const droiteEtGauche = attendus.filter((e) => e.vue === "droite" || e.vue === "gauche").map((e) => ({ vue: e.vue, nom: e.nom }))
  // Un véhicule d'avant les vues ajoutées : ses emplacements hors plan (Capot, Hayon, Lunette arrière, Toit) sont
  // dans la liste « Autres emplacements », sans vue ni forme.
  const anciens = [
    ...lignes(droiteEtGauche),
    ...["Capot", "Hayon", "Lunette arrière", "Toit"].map((nom) => ({ id: `hp-${nom}`, vue: "hors_plan" as const, nom, libre: true })),
  ]

  // Applique le plan à la liste, comme le service le fait en base : une reprise change la vue, un retrait sort la ligne,
  // une création ajoute une ligne.
  function appliquer(existants: ReturnType<typeof lignes>, plan: ReturnType<typeof planComplement>) {
    const reprises = new Map(plan.reprendre.map((r) => [r.id, r]))
    const retirees = new Set(plan.retirer)
    return [
      ...existants
        .filter((e) => !retirees.has(e.id))
        .map((e) => {
          const reprise = reprises.get(e.id)
          return reprise ? { ...e, vue: reprise.vue } : e
        }),
      ...plan.creer.map((e, i) => ({ id: `nouveau-${i}`, vue: e.vue, nom: e.nom, libre: true })),
    ]
  }

  it("un véhicule déjà complet n'a rien à recevoir", () => {
    const existants = lignes(attendus.map((e) => ({ vue: e.vue, nom: e.nom })))
    expect(planComplement(existants, attendus, options())).toEqual({ creer: [], reprendre: [], retirer: [], conserves: [] })
  })

  it("un véhicule sans vues ajoutées reçoit les emplacements qui lui manquent, sans la lunette arrière", () => {
    const plan = planComplement(lignes(droiteEtGauche), attendus, options())
    expect(plan.reprendre).toEqual([])
    expect(plan.creer.map((e) => `${e.vue}:${e.nom}`)).toEqual([
      "dessus:Capot",
      "arriere:Hayon",
      "dessus:Toit",
      "avant:Pare-chocs avant",
      "arriere:Pare-chocs arrière",
    ])
  })

  it("une ligne hors plan au nom du gabarit est reprise dans sa vue, sans changer d'id ni de nom", () => {
    const plan = planComplement(anciens, attendus, options())
    expect(plan.reprendre.map((r) => `${r.id}→${r.vue}`)).toEqual(["hp-Capot→dessus", "hp-Hayon→arriere", "hp-Toit→dessus"])
    expect(plan.creer.map((e) => `${e.vue}:${e.nom}`)).toEqual(["avant:Pare-chocs avant", "arriere:Pare-chocs arrière"])
    // La reprise ne porte que l'id, la vue et la forme : le nom et l'occupation (rattachée par id) ne bougent pas.
    expect(Object.keys(plan.reprendre[0]).sort()).toEqual(["forme", "id", "vue"])
  })

  it("une lunette arrière libre est retirée, jamais recréée ni reprise", () => {
    const plan = planComplement(anciens, attendus, options())
    expect(plan.retirer).toEqual(["hp-Lunette arrière"])
    expect(plan.conserves).toEqual([])
    expect(plan.creer.some((e) => e.nom === "Lunette arrière")).toBe(false)
    expect(plan.reprendre.some((r) => r.id === "hp-Lunette arrière")).toBe(false)
  })

  it("une lunette arrière occupée ou liée reste : elle est signalée, jamais supprimée", () => {
    const existants = [...lignes(droiteEtGauche), { id: "lunette", vue: "arriere" as const, nom: "Lunette arrière", libre: false }]
    const plan = planComplement(existants, attendus, options())
    expect(plan.retirer).toEqual([])
    expect(plan.conserves).toEqual(["Lunette arrière"])
    expect(plan.creer.some((e) => e.nom === "Lunette arrière")).toBe(false)
  })

  it("une ligne hors plan sans équivalent part dans la vue affichée, au centre ; une ligne déjà posée n'est pas touchée", () => {
    const existants = [...lignes(droiteEtGauche), { id: "libre-hp", vue: "hors_plan" as const, nom: "Nouvel emplacement", libre: true }]
    const plan = planComplement(existants, attendus, options("avant"))
    expect(plan.reprendre.filter((r) => r.id === "libre-hp")).toEqual([{ id: "libre-hp", vue: "avant", forme: CENTRE }])
    expect(plan.reprendre.filter((r) => r.id !== "libre-hp")).toEqual([])
  })

  it("après reprise et retrait, une ligne par nom, plus de hors plan, et une seconde passe ne fait rien", () => {
    const apres = appliquer(anciens, planComplement(anciens, attendus, options()))
    const noms = apres.map((e) => `${e.vue}:${e.nom}`)
    expect(new Set(noms).size).toBe(noms.length)
    expect(apres.filter((e) => e.nom === "Capot")).toEqual([{ id: "hp-Capot", vue: "dessus", nom: "Capot", libre: true }])
    expect(apres.filter((e) => e.vue === "hors_plan")).toEqual([])
    expect(apres.some((e) => e.nom === "Lunette arrière")).toBe(false)
    expect(planComplement(apres, attendus, options())).toEqual({ creer: [], reprendre: [], retirer: [], conserves: [] })
  })

  it("une ligne déjà à la bonne vue n'est jamais touchée ; un hors plan en double part dans la vue affichée, sans doublon créé", () => {
    const existants = [...lignes(droiteEtGauche), { id: "capot-dessus", vue: "dessus" as const, nom: "Capot", libre: true }, { id: "capot-hp", vue: "hors_plan" as const, nom: "Capot", libre: true }]
    const plan = planComplement(existants, attendus, options("avant"))
    expect(plan.reprendre).toEqual([{ id: "capot-hp", vue: "avant", forme: CENTRE }])
    expect(plan.creer.find((e) => e.nom === "Capot")).toBeUndefined()
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

describe("papiers : etatPapiersVehicule", () => {
  const maintenant = new Date("2026-10-18T10:00:00Z")

  it("sans papier : « aucun », et non « valide »", () => {
    expect(etatPapiersVehicule([], maintenant)).toBe("aucun")
  })

  it("avec des papiers : le pire statut, comme etatPapiers", () => {
    const papiers = [{ valableJusquAu: new Date("2027-06-01T00:00:00Z") }, { valableJusquAu: new Date("2026-10-01T00:00:00Z") }]
    expect(etatPapiersVehicule(papiers, maintenant)).toBe("expire")
  })
})

describe("papiers : trierPapiers", () => {
  it("expirés d'abord, puis à renouveler, puis valides ; à statut égal, par échéance", () => {
    const papiers = [
      { nom: "valide-tard", statut: "valide" as const, valableJusquAu: new Date("2028-01-01T00:00:00Z") },
      { nom: "a-renouveler", statut: "a_renouveler" as const, valableJusquAu: new Date("2026-11-01T00:00:00Z") },
      { nom: "expire-recent", statut: "expire" as const, valableJusquAu: new Date("2026-10-10T00:00:00Z") },
      { nom: "expire-ancien", statut: "expire" as const, valableJusquAu: new Date("2026-01-10T00:00:00Z") },
      { nom: "valide-sans-echeance", statut: "valide" as const, valableJusquAu: null },
      { nom: "valide-tot", statut: "valide" as const, valableJusquAu: new Date("2027-01-01T00:00:00Z") },
    ]
    expect(trierPapiers(papiers).map((p) => p.nom)).toEqual(["expire-ancien", "expire-recent", "a-renouveler", "valide-tot", "valide-tard", "valide-sans-echeance"])
  })

  it("ne modifie pas le tableau reçu", () => {
    const papiers = [
      { statut: "valide" as const, valableJusquAu: null, nom: "a" },
      { statut: "expire" as const, valableJusquAu: null, nom: "b" },
    ]
    trierPapiers(papiers)
    expect(papiers[0].nom).toBe("a")
  })
})
