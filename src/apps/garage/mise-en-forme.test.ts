import { describe, expect, it } from "vitest"

import {
  enumererOrganes,
  etatCarte,
  libelleZone,
  motIndice,
  ordreDesOrganes,
  phraseKmRestants,
  phrasesIndiceAbsent,
  pourcentage,
  regrouperStock,
  zoneIndice,
  type OrganeMot,
  type PieceStock,
} from "./mise-en-forme"

const organe = (nom: string, zone: OrganeMot["zone"], extra: Partial<OrganeMot> = {}): OrganeMot => ({
  nom,
  critique: true,
  pieceMontee: true,
  zone,
  ...extra,
})

describe("mot de l'indice", () => {
  it("sans organe critique renseigné, « À renseigner »", () => {
    expect(motIndice([])).toBe("À renseigner")
    expect(motIndice([organe("Freins", "a_renseigner")])).toBe("À renseigner")
    expect(motIndice([organe("Transmissions", "vert", { pieceMontee: false })])).toBe("À renseigner")
  })

  it("tous vert, « Bon »", () => {
    expect(motIndice([organe("Moteur", "vert"), organe("Freins", "vert")])).toBe("Bon")
  })

  it("un rouge nomme l'organe : « Zone rouge : embrayage »", () => {
    expect(motIndice([organe("Moteur", "vert"), organe("Embrayage", "rouge")])).toBe("Zone rouge : embrayage")
  })

  it("plusieurs rouges se comptent : « embrayage et 1 autre », « et 2 autres »", () => {
    const deux = [organe("Embrayage", "rouge"), organe("Freins", "rouge"), organe("Moteur", "vert")]
    expect(motIndice(deux)).toBe("Zone rouge : embrayage et 1 autre")
    const trois = [...deux, organe("Boîte de vitesses", "rouge")]
    expect(motIndice(trois)).toBe("Zone rouge : embrayage et 2 autres")
  })

  it("un orange, sans rouge : « À surveiller : boîte de vitesses »", () => {
    expect(motIndice([organe("Moteur", "vert"), organe("Boîte de vitesses", "orange")])).toBe("À surveiller : boîte de vitesses")
  })

  it("le rouge l'emporte sur l'orange, qui n'est pas nommé", () => {
    const organes = [organe("Boîte de vitesses", "orange"), organe("Embrayage", "rouge")]
    expect(motIndice(organes)).toBe("Zone rouge : embrayage")
  })

  it("un organe non critique, ou sans pièce montée, ne compte pas", () => {
    expect(motIndice([organe("Amortisseurs", "rouge", { critique: false }), organe("Moteur", "vert")])).toBe("Bon")
    expect(motIndice([organe("Transmissions", "rouge", { pieceMontee: false }), organe("Moteur", "vert")])).toBe("Bon")
  })

  it("l'exemple de la capture : « Zone rouge : embrayage », l'orange n'est pas nommé", () => {
    const capture = [
      organe("Moteur", "vert"),
      organe("Boîte de vitesses", "orange"),
      organe("Embrayage", "rouge"),
      organe("Amortisseurs", "vert", { critique: false }),
    ]
    expect(motIndice(capture)).toBe("Zone rouge : embrayage")
  })

  it("enumererOrganes : un nom seul, puis le premier et le nombre d'autres", () => {
    expect(enumererOrganes(["Moteur"])).toBe("Moteur")
    expect(enumererOrganes(["Moteur", "Freins"])).toBe("Moteur et 1 autre")
    expect(enumererOrganes(["Moteur", "Freins", "Pneus"])).toBe("Moteur et 2 autres")
  })
})

describe("mot de la zone", () => {
  it("écrit le mot de chaque zone, sur les seuils par défaut des pièces", () => {
    expect(libelleZone("vert")).toBe("Bon")
    expect(libelleZone("orange")).toBe("À surveiller")
    expect(libelleZone("rouge")).toBe("Zone rouge")
    expect(libelleZone("a_renseigner")).toBe("À renseigner")
  })

  // Aucun mot de la zone n'appelle l'achat : pas de « à changer », ni de « à remplacer ».
  it("aucun mot de zone ne dit « à changer » ni « à remplacer »", () => {
    for (const zone of ["vert", "orange", "rouge", "a_renseigner"] as const) {
      expect(libelleZone(zone)).not.toMatch(/changer|remplacer/i)
    }
  })

  it("donne la zone de l'indice : 30 % et 10 % comme seuils, sans indice à renseigner", () => {
    expect(zoneIndice(null)).toBe("a_renseigner")
    expect(zoneIndice(30)).toBe("vert")
    expect(zoneIndice(29.9)).toBe("orange")
    expect(zoneIndice(10)).toBe("orange")
    expect(zoneIndice(9.9)).toBe("rouge")
  })
})

describe("pourcentage", () => {
  it("arrondit à l'entier et ajoute l'espace insécable avant %", () => {
    expect(pourcentage(72.4)).toBe("72 %")
    expect(pourcentage(72.6)).toBe("73 %")
  })

  it("renvoie null sans état", () => {
    expect(pourcentage(null)).toBeNull()
  })
})

describe("ordre des cartes", () => {
  it("met les organes critiques d'abord, en gardant l'ordre des types à l'intérieur de chaque groupe", () => {
    const organes = [
      { nom: "Amortisseurs", critique: false },
      { nom: "Moteur", critique: true },
      { nom: "Éclairage", critique: false },
      { nom: "Freins", critique: true },
    ]
    expect(ordreDesOrganes(organes).map((o) => o.nom)).toEqual(["Moteur", "Freins", "Amortisseurs", "Éclairage"])
  })

  it("ne modifie pas le tableau reçu", () => {
    const organes = [
      { nom: "Éclairage", critique: false },
      { nom: "Moteur", critique: true },
    ]
    ordreDesOrganes(organes)
    expect(organes[0].nom).toBe("Éclairage")
  })
})

describe("phrases de l'atelier", () => {
  it("dit les km restants, ou que la zone rouge est atteinte à zéro", () => {
    expect(phraseKmRestants(null)).toBeNull()
    expect(phraseKmRestants(0)).toBe("Zone rouge atteinte")
    expect(phraseKmRestants(1240.4)).toBe("1 240 km avant la zone rouge")
  })

  it("sans organe critique, le dit en une phrase", () => {
    expect(phrasesIndiceAbsent([], [])).toEqual([{ debut: "Aucun organe critique sur cette voiture.", organes: [], fin: "" }])
  })

  it("une pièce manquante nomme les organes, chacun avec sa fiche", () => {
    const freins = { id: "freins", nom: "Freins" }
    const moteur = { id: "moteur", nom: "Moteur" }
    expect(phrasesIndiceAbsent([freins, moteur], [])).toEqual([
      { debut: "Il manque une pièce montée sur : ", organes: [freins, moteur], fin: "." },
    ])
  })

  it("une pièce montée à durée inconnue demande la durée, jamais « rien ne manque »", () => {
    const embrayage = { id: "embrayage", nom: "Embrayage" }
    const phrases = phrasesIndiceAbsent([], [embrayage])
    expect(phrases).toEqual([{ debut: "Renseigne la durée de vie de : ", organes: [embrayage], fin: " pour calculer l'indice." }])
    expect(JSON.stringify(phrases)).not.toContain("Aucun organe critique")
  })

  it("pièce manquante et durée à renseigner : les deux phrases, la pièce d'abord", () => {
    const boite = { id: "boite", nom: "Boîte de vitesses" }
    const embrayage = { id: "embrayage", nom: "Embrayage" }
    expect(phrasesIndiceAbsent([boite], [embrayage]).map((p) => p.debut)).toEqual([
      "Il manque une pièce montée sur : ",
      "Renseigne la durée de vie de : ",
    ])
  })
})

describe("ligne de la carte", () => {
  const ZONES = ["vert", "orange", "rouge", "a_renseigner"] as const

  it("à zéro km, la durée de vie prévue est atteinte", () => {
    expect(etatCarte("rouge", 0)).toBe("durée de vie prévue atteinte")
  })

  it("en zone rouge avec des km restants, rien ne s'ajoute : la zone le dit déjà", () => {
    expect(etatCarte("rouge", 500)).toBeNull()
  })

  it("sans durée, rien ; hors zone rouge, les km avant la zone rouge", () => {
    expect(etatCarte("vert", null)).toBeNull()
    expect(etatCarte("vert", 12000)).toBe(phraseKmRestants(12000))
    expect(etatCarte("vert", 12000)).toMatch(/avant la zone rouge$/)
  })

  // Une même ligne n'écrit jamais deux fois le mot de sa zone (« Zone rouge · Zone rouge atteinte » ne doit plus arriver).
  it("une ligne de carte ne répète jamais le mot de sa zone", () => {
    for (const zone of ZONES) {
      for (const km of [null, 0, 500, 12000]) {
        const mot = libelleZone(zone)
        const ligne = [mot, etatCarte(zone, km)].filter((partie): partie is string => partie !== null).join(" · ")
        const occurrences = ligne.split(mot).length - 1
        expect(occurrences, `${zone}, ${km} km : « ${ligne} »`).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe("regroupement du stock", () => {
  const piece = (id: string, extra: Partial<PieceStock> = {}): PieceStock => ({
    id,
    designation: "Plaquettes avant",
    marque: "Brembo",
    reference: "P85",
    qualite: "origine",
    statut: "en_stock",
    emplacement: "Atelier",
    componentTypeId: "freins",
    organeNom: "Freins",
    organeOrdre: 5,
    ...extra,
  })

  it("regroupe les pièces identiques, avec leur quantité, et garde chacune ouvrable", () => {
    const [organe] = regrouperStock([piece("a"), piece("b"), piece("c")])
    expect(organe.groupes).toHaveLength(1)
    expect(organe.groupes[0].pieces.map((p) => p.id)).toEqual(["a", "b", "c"])
  })

  it("sépare ce qui diffère par la qualité, la référence ou la marque", () => {
    const groupes = regrouperStock([
      piece("a"),
      piece("b", { qualite: "competition" }),
      piece("c", { reference: "P86" }),
      piece("d", { marque: "Ferodo" }),
    ])[0].groupes
    expect(groupes).toHaveLength(4)
  })

  it("range les organes dans l'ordre des types, puis les désignations", () => {
    const pieces = [
      piece("1", { componentTypeId: "pneus", organeNom: "Pneus", organeOrdre: 7, designation: "Pneu" }),
      piece("2", { designation: "Disque" }),
      piece("3", { designation: "Coupelle" }),
      piece("4", { componentTypeId: "moteur", organeNom: "Moteur", organeOrdre: 1, designation: "Joint" }),
    ]
    const organes = regrouperStock(pieces)
    expect(organes.map((o) => o.organeNom)).toEqual(["Moteur", "Freins", "Pneus"])
    expect(organes[1].groupes.map((g) => g.designation)).toEqual(["Coupelle", "Disque"])
  })

  it("sans pièce, pas de groupe", () => {
    expect(regrouperStock([])).toEqual([])
  })
})
