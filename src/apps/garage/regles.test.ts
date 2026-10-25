import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  additionnerKm,
  dureesEffectives,
  derniereSaisie,
  destinationManqueePourIntervention,
  droitPreparerAtelier,
  etatPiece,
  etatPneus,
  etatSaisiValide,
  fiabiliteChangee,
  franchitZoneRouge,
  indiceFiabilite,
  kmRestantsAvantRouge,
  prixImposeFournisseur,
  saisieParPiece,
  SEUILS_DEFAUT,
  seuilsValides,
  statutDeDestination,
  zoneDeEtat,
  type SaisieEtat,
} from "./regles"

// Saisie de test : 80 % saisis à 1 000 km et 2 épreuves ; la date sert à départager deux saisies.
const saisie = (extra: Partial<SaisieEtat> = {}): SaisieEtat => ({
  etatPct: 80,
  kmAuSaisie: 1000,
  epreuvesAuSaisie: 2,
  saisiLe: new Date("2026-10-23T10:00:00Z"),
  ...extra,
})

describe("état après réparation (954 v1.3, §4)", () => {
  const durees = { km: 1000, epreuves: 10 }

  it("sans saisie, l'état est celui du calcul ordinaire, inchangé", () => {
    expect(etatPiece("km", durees, { km: 500, epreuves: 0 }, null)).toBe(50)
    expect(etatPiece("km", durees, { km: 500, epreuves: 0 })).toBe(50)
    expect(etatPiece("epreuves", durees, { km: 0, epreuves: 4 }, null)).toBe(60)
    expect(etatPiece("les_deux", durees, { km: 500, epreuves: 4 }, null)).toBe(50)
  })

  it("saisie puis km : l'état saisi moins l'usure en km depuis la saisie", () => {
    // 80 % saisis à 1 000 km ; 200 km ajoutés sur une durée de 1 000 km : 80 − 20 = 60.
    expect(etatPiece("km", durees, { km: 1200, epreuves: 2 }, saisie())).toBe(60)
  })

  it("saisie puis épreuves : l'état saisi moins l'usure en épreuves depuis la saisie", () => {
    // 80 % saisis à deux épreuves ; deux épreuves de plus sur une durée de dix : 80 − 20 = 60.
    expect(etatPiece("epreuves", durees, { km: 1200, epreuves: 4 }, saisie())).toBe(60)
  })

  it("mode les deux : le plus bas des deux, depuis la saisie", () => {
    // Km : 80 − 20 = 60. Épreuves : 80 − 10 = 70. Le plus bas : 60.
    expect(etatPiece("les_deux", durees, { km: 1200, epreuves: 3 }, saisie())).toBe(60)
    // Les épreuves sont plus usées : 80 − 40 = 40, alors que les km donnent 70.
    expect(etatPiece("les_deux", durees, { km: 1100, epreuves: 6 }, saisie())).toBe(40)
  })

  it("une saisie n'ajoute pas l'usure déjà faite avant elle", () => {
    // 1 000 km cumulés au moment de la saisie : rien depuis, l'état reste celui saisi.
    expect(etatPiece("km", durees, { km: 1000, epreuves: 2 }, saisie())).toBe(80)
  })

  it("bornes : jamais au-dessus de 100, jamais sous 0", () => {
    expect(etatPiece("km", durees, { km: 1000, epreuves: 2 }, saisie({ etatPct: 100 }))).toBe(100)
    expect(etatPiece("km", durees, { km: 1900, epreuves: 2 }, saisie({ etatPct: 10 }))).toBe(0)
  })

  it("sans durée requise, l'état reste « à renseigner » même avec une saisie", () => {
    expect(etatPiece("km", { km: null, epreuves: 10 }, { km: 1200, epreuves: 2 }, saisie())).toBeNull()
    expect(etatPiece("les_deux", { km: 1000, epreuves: null }, { km: 1200, epreuves: 2 }, saisie())).toBeNull()
  })

  it("marge avant la zone rouge : part de l'état saisi, usure depuis la saisie", () => {
    // Saisie à 80 %, zone rouge à 10 % : 70 % de marge sur 1 000 km, moins 200 km depuis la saisie = 500 km.
    expect(kmRestantsAvantRouge("km", durees, { km: 1200, epreuves: 2 }, 10, saisie())).toBe(500)
    // Sans saisie, la même usure donne 1 000 × 0,9 − 1 200 : jamais négatif, donc 0.
    expect(kmRestantsAvantRouge("km", durees, { km: 1200, epreuves: 2 }, 10)).toBe(0)
  })

  it("deux saisies : seule la dernière compte, quel que soit l'ordre des lignes", () => {
    const ancienne = saisie({ etatPct: 50, saisiLe: new Date("2026-06-01T10:00:00Z") })
    const recente = saisie({ etatPct: 90, saisiLe: new Date("2026-10-23T10:00:00Z") })
    expect(derniereSaisie([recente, ancienne])).toBe(recente)
    expect(derniereSaisie([ancienne, recente])).toBe(recente)
    expect(derniereSaisie([])).toBeNull()
    expect(etatPiece("km", durees, { km: 1000, epreuves: 2 }, derniereSaisie([ancienne, recente]))).toBe(90)
  })

  it("saisieParPiece garde la dernière saisie de chaque pièce, et rien pour une pièce sans saisie", () => {
    const ancienne = saisie({ etatPct: 50, saisiLe: new Date("2026-06-01T10:00:00Z") })
    const recente = saisie({ etatPct: 90, saisiLe: new Date("2026-10-23T10:00:00Z") })
    const parPiece = saisieParPiece([
      { partId: "a", ...ancienne },
      { partId: "b", ...saisie({ etatPct: 70 }) },
      { partId: "a", ...recente },
    ])
    expect(parPiece.get("a")?.etatPct).toBe(90)
    expect(parPiece.get("b")?.etatPct).toBe(70)
    expect(parPiece.has("c")).toBe(false)
  })

  it("un état saisi est un entier de 0 à 100", () => {
    expect([0, 50, 100].every(etatSaisiValide)).toBe(true)
    expect([-1, 101, 50.5, Number.NaN].some(etatSaisiValide)).toBe(false)
  })
})

describe("additionnerKm (correction A : décimaux sans dérive)", () => {
  it("garde le dixième exact : 0,1 + 0,2 vaut 0,3", () => {
    expect(additionnerKm(0.1, 0.2)).toBe(0.3)
  })

  it("accumule 12,3 km sur trois épreuves sans arrondi à l'entier", () => {
    let total = 0
    for (const ajout of [4.1, 4.1, 4.1]) total = additionnerKm(total, ajout)
    expect(total).toBe(12.3)
  })
})

describe("dureesEffectives", () => {
  it("prend la durée de la pièce quand elle est saisie, sinon celle de l'organe", () => {
    const organe = { km: 100, epreuves: 6 }
    expect(dureesEffectives({ km: 80, epreuves: null }, organe)).toEqual({ km: 80, epreuves: 6 })
  })

  it("renvoie null quand ni la pièce ni l'organe ne la renseignent", () => {
    expect(dureesEffectives({ km: null, epreuves: null }, { km: null, epreuves: 4 })).toEqual({ km: null, epreuves: 4 })
  })
})

describe("etatPiece", () => {
  it("mode km : 100 moins km ÷ durée", () => {
    expect(etatPiece("km", { km: 100, epreuves: null }, { km: 25, epreuves: 0 })).toBe(75)
  })

  it("mode km avec des km à virgule : 12,3 km sur 100 donnent 87,7 %", () => {
    expect(etatPiece("km", { km: 100, epreuves: null }, { km: 12.3, epreuves: 3 })).toBeCloseTo(87.7, 10)
  })

  it("mode épreuves : 12,3 km sur trois épreuves ne comptent que les épreuves (3 sur 6 donnent 50 %)", () => {
    expect(etatPiece("epreuves", { km: 100, epreuves: 6 }, { km: 12.3, epreuves: 3 })).toBe(50)
  })

  it("mode les deux : le plus bas des deux (km 87,7 %, épreuves 50 % donnent 50 %)", () => {
    expect(etatPiece("les_deux", { km: 100, epreuves: 6 }, { km: 12.3, epreuves: 3 })).toBe(50)
  })

  it("borné à 0 : une pièce usée au-delà de sa vie n'est jamais négative", () => {
    expect(etatPiece("km", { km: 100, epreuves: null }, { km: 180, epreuves: 0 })).toBe(0)
  })

  it("renvoie null (à renseigner) quand la durée du mode manque", () => {
    expect(etatPiece("km", { km: null, epreuves: 6 }, { km: 10, epreuves: 1 })).toBeNull()
    expect(etatPiece("epreuves", { km: 100, epreuves: null }, { km: 10, epreuves: 1 })).toBeNull()
  })

  it("mode les deux exige les deux durées : une seule ne suffit pas", () => {
    expect(etatPiece("les_deux", { km: 100, epreuves: null }, { km: 10, epreuves: 1 })).toBeNull()
  })
})

describe("zoneDeEtat (seuils par défaut 30 et 10)", () => {
  const seuils = { orange: SEUILS_DEFAUT.orange, rouge: SEUILS_DEFAUT.rouge }

  it("bornes comprises : 30 est vert, 29,9 est orange", () => {
    expect(zoneDeEtat(30, seuils)).toBe("vert")
    expect(zoneDeEtat(29.9, seuils)).toBe("orange")
  })

  it("bornes comprises : 10 est orange, 9,9 est rouge", () => {
    expect(zoneDeEtat(10, seuils)).toBe("orange")
    expect(zoneDeEtat(9.9, seuils)).toBe("rouge")
  })

  it("un état inconnu est à renseigner, jamais rouge", () => {
    expect(zoneDeEtat(null, seuils)).toBe("a_renseigner")
  })

  it("respecte des seuils réglés par organe", () => {
    expect(zoneDeEtat(20, { orange: 20, rouge: 5 })).toBe("vert")
    expect(zoneDeEtat(6, { orange: 20, rouge: 5 })).toBe("orange")
  })
})

describe("kmRestantsAvantRouge", () => {
  it("mode km : durée × (1 − seuil rouge) moins l'usure (100 km, seuil 10, 12,3 km donnent 77,7)", () => {
    expect(kmRestantsAvantRouge("km", { km: 100, epreuves: null }, { km: 12.3, epreuves: 0 }, 10)).toBe(77.7)
  })

  it("est null en mode épreuves seul", () => {
    expect(kmRestantsAvantRouge("epreuves", { km: 100, epreuves: 6 }, { km: 12.3, epreuves: 3 }, 10)).toBeNull()
  })

  it("est null sans durée de km", () => {
    expect(kmRestantsAvantRouge("km", { km: null, epreuves: 6 }, { km: 12.3, epreuves: 3 }, 10)).toBeNull()
  })

  it("ne descend jamais sous zéro", () => {
    expect(kmRestantsAvantRouge("km", { km: 100, epreuves: null }, { km: 95, epreuves: 0 }, 10)).toBe(0)
  })
})

describe("indiceFiabilite", () => {
  it("moyenne à poids égaux des organes critiques renseignés qui ont une pièce montée", () => {
    const indice = indiceFiabilite([
      { id: "moteur", critique: true, pieceMontee: true, etat: 80 },
      { id: "freins", critique: true, pieceMontee: true, etat: 60 },
    ])
    expect(indice).toEqual({ indice: 70, sansPiece: [], sansEtat: [] })
  })

  it("ignore les organes non critiques (pneus, amortisseurs)", () => {
    const indice = indiceFiabilite([
      { id: "moteur", critique: true, pieceMontee: true, etat: 80 },
      { id: "pneus", critique: false, pieceMontee: true, etat: 10 },
    ])
    expect(indice.indice).toBe(80)
  })

  it("signale à part un organe critique sans pièce, sans le compter à 0", () => {
    const indice = indiceFiabilite([
      { id: "moteur", critique: true, pieceMontee: true, etat: 80 },
      { id: "boite", critique: true, pieceMontee: false, etat: null },
    ])
    expect(indice).toEqual({ indice: 80, sansPiece: ["boite"], sansEtat: [] })
  })

  it("exclut un organe avec pièce mais à renseigner, sans le compter à 0, et le nomme à part", () => {
    const indice = indiceFiabilite([
      { id: "moteur", critique: true, pieceMontee: true, etat: 80 },
      { id: "embrayage", critique: true, pieceMontee: true, etat: null },
    ])
    expect(indice).toEqual({ indice: 80, sansPiece: [], sansEtat: ["embrayage"] })
  })

  it("renvoie null s'il n'y a aucun organe retenu, et nomme la pièce manquante", () => {
    expect(indiceFiabilite([{ id: "moteur", critique: true, pieceMontee: false, etat: null }])).toEqual({
      indice: null,
      sansPiece: ["moteur"],
      sansEtat: [],
    })
  })

  it("sans organe critique : indice null, aucune liste", () => {
    expect(indiceFiabilite([{ id: "pneus", critique: false, pieceMontee: true, etat: 50 }])).toEqual({
      indice: null,
      sansPiece: [],
      sansEtat: [],
    })
  })

  it("une pièce montée à état inconnu, seule : indice null, et l'organe est dans sansEtat", () => {
    expect(indiceFiabilite([{ id: "freins", critique: true, pieceMontee: true, etat: null }])).toEqual({
      indice: null,
      sansPiece: [],
      sansEtat: ["freins"],
    })
  })
})

describe("droitPreparerAtelier", () => {
  it("l'écriture et plus peuvent préparer l'atelier, sans raison", () => {
    expect(droitPreparerAtelier("ecriture")).toEqual({ possible: true, raison: null })
    expect(droitPreparerAtelier("gestion")).toEqual({ possible: true, raison: null })
  })

  it("en dessous de l'écriture, la raison est dite", () => {
    expect(droitPreparerAtelier("contribution")).toEqual({ possible: false, raison: "Seul l'équipage peut préparer l'atelier." })
    expect(droitPreparerAtelier("lecture")).toEqual({ possible: false, raison: "Seul l'équipage peut préparer l'atelier." })
  })
})

describe("franchitZoneRouge", () => {
  it("vrai quand l'état passe de 10 (égal au seuil) à 9,9", () => {
    expect(franchitZoneRouge(10, 9.9, 10)).toBe(true)
  })

  it("faux quand l'état était déjà sous le seuil", () => {
    expect(franchitZoneRouge(9.9, 5, 10)).toBe(false)
  })

  it("faux quand l'état reste au seuil", () => {
    expect(franchitZoneRouge(10, 10, 10)).toBe(false)
  })

  it("faux quand un état est inconnu", () => {
    expect(franchitZoneRouge(null, 5, 10)).toBe(false)
    expect(franchitZoneRouge(20, null, 10)).toBe(false)
  })
})

describe("fiabiliteChangee (indice arrondi à l'unité)", () => {
  it("faux quand l'arrondi ne change pas (70,4 puis 70,2)", () => {
    expect(fiabiliteChangee(70.4, 70.2)).toBe(false)
  })

  it("vrai quand l'arrondi change (70,5 puis 69,9 : 71 puis 70)", () => {
    expect(fiabiliteChangee(70.5, 69.9)).toBe(true)
  })

  it("passer de rien à un indice compte comme un changement", () => {
    expect(fiabiliteChangee(null, 50)).toBe(true)
    expect(fiabiliteChangee(null, null)).toBe(false)
  })
})

describe("etatPneus (correction C)", () => {
  it("100 moins l'usure estimée du train monté", () => {
    expect(etatPneus(true, 40)).toBe(60)
  })

  it("à renseigner sans train monté ou sans usure saisie", () => {
    expect(etatPneus(false, 40)).toBeNull()
    expect(etatPneus(true, null)).toBeNull()
  })

  it("borné à 0", () => {
    expect(etatPneus(true, 120)).toBe(0)
  })
})

describe("seuilsValides", () => {
  it("accepte 0 ≤ rouge < orange ≤ 100", () => {
    expect(seuilsValides({ orange: 30, rouge: 10 })).toBe(true)
    expect(seuilsValides({ orange: 100, rouge: 0 })).toBe(true)
  })

  it("refuse rouge égal ou supérieur à orange, orange au-delà de 100, rouge négatif, valeurs non entières", () => {
    expect(seuilsValides({ orange: 10, rouge: 10 })).toBe(false)
    expect(seuilsValides({ orange: 101, rouge: 10 })).toBe(false)
    expect(seuilsValides({ orange: 30, rouge: -1 })).toBe(false)
    expect(seuilsValides({ orange: 30.5, rouge: 10 })).toBe(false)
  })
})

describe("défauts des seuils, égaux à la migration", () => {
  it("SEUILS_DEFAUT correspond aux défauts de garage_vehicle_component dans le schéma", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8")
    const orange = /seuilOrangePct\s+Int\s+@default\((\d+)\)/.exec(schema)?.[1]
    const rouge = /seuilRougePct\s+Int\s+@default\((\d+)\)/.exec(schema)?.[1]
    expect(Number(orange)).toBe(SEUILS_DEFAUT.orange)
    expect(Number(rouge)).toBe(SEUILS_DEFAUT.rouge)
  })
})

describe("remplacement : destination de l'ancienne pièce et prix", () => {
  it("la destination donne le statut de la pièce déposée : réserve, rebut, vendue", () => {
    expect(statutDeDestination("reserve")).toBe("en_stock")
    expect(statutDeDestination("rebut")).toBe("cassee")
    expect(statutDeDestination("vendue")).toBe("vendue")
  })

  it("une pièce avec un prix sans fournisseur est refusée, avec sa raison", () => {
    expect(prixImposeFournisseur(1250, null)).toBe("Une pièce avec un prix demande son fournisseur.")
    expect(prixImposeFournisseur(0, null)).toBe("Une pièce avec un prix demande son fournisseur.")
  })

  it("un prix avec fournisseur passe, et une pièce sans prix ne demande pas de fournisseur", () => {
    expect(prixImposeFournisseur(1250, "fournisseur-1")).toBeNull()
    expect(prixImposeFournisseur(null, null)).toBeNull()
  })
})

describe("destination de l'ancienne pièce à l'intervention rapide", () => {
  it("une pose sur un organe occupé sans destination est refusée, avec sa raison", () => {
    expect(destinationManqueePourIntervention(true, true, null)).toBe("Indique ce que devient l'ancienne pièce : réserve, rebut ou vendue.")
  })

  it("avec une destination, la pose passe", () => {
    expect(destinationManqueePourIntervention(true, true, "rebut")).toBeNull()
  })

  it("sans pièce, ou sur un organe libre, rien n'est demandé", () => {
    expect(destinationManqueePourIntervention(false, true, null)).toBeNull()
    expect(destinationManqueePourIntervention(true, false, null)).toBeNull()
  })
})
