import { describe, expect, it } from "vitest"

import { actionsPourMembre, lireDestinataires, type ActionBoite } from "./filtrage"
import { grouperActions, LIBELLES_TYPES } from "./regroupement"
import { choisirProchaineEtape, pourquoi } from "./prochaine-etape"

const T0 = new Date("2026-10-16T10:00:00Z")
const JOUR = 24 * 60 * 60 * 1000

function action(partiel: Partial<ActionBoite> & { id: string }): ActionBoite {
  return {
    appOrigine: "saison",
    type: "test",
    cleUnicite: partiel.id,
    titre: `Action ${partiel.id}`,
    contexte: null,
    ficheType: null,
    ficheId: null,
    eventId: null,
    priorite: 5,
    bloquant: false,
    echeance: null,
    cleRegroupement: null,
    destinataires: { roles: ["responsable"], memberships: [], niveauRequis: "ecriture", terrain: false },
    boutons: [{ cle: "ok", libelle: "OK" }],
    createdAt: T0,
    reporteeJusquAu: null,
    statut: "en_attente",
    messageRefus: null,
    ...partiel,
  }
}

describe("filtrage pour un membre", () => {
  const pourResponsable = { membershipId: "m1", role: "responsable", niveauParApp: { saison: "gestion" as const } }

  it("garde une action dont le rôle est destinataire et le niveau suffisant", () => {
    expect(actionsPourMembre([action({ id: "a" })], pourResponsable)).toHaveLength(1)
  })

  it("garde une action adressée à la membership", () => {
    const a = action({ id: "a", destinataires: { roles: [], memberships: ["m1"], niveauRequis: "lecture", terrain: false } })
    expect(actionsPourMembre([a], { ...pourResponsable, role: "equipage", niveauParApp: { saison: "lecture" } })).toHaveLength(1)
  })

  it("écarte une action dont le membre n'est pas destinataire", () => {
    const a = action({ id: "a", destinataires: { roles: ["invite"], memberships: [], niveauRequis: "lecture", terrain: false } })
    expect(actionsPourMembre([a], pourResponsable)).toHaveLength(0)
  })

  it("écarte une action si le niveau sur l'app d'origine est insuffisant", () => {
    const a = action({ id: "a", destinataires: { roles: ["equipage"], memberships: [], niveauRequis: "gestion", terrain: false } })
    expect(actionsPourMembre([a], { ...pourResponsable, role: "equipage", niveauParApp: { saison: "ecriture" } })).toHaveLength(0)
  })

  it("lit un Json inattendu comme un destinataire vide", () => {
    const d = lireDestinataires("n'importe quoi")
    expect(d).toEqual({ roles: [], memberships: [], niveauRequis: "ecriture", terrain: false })
  })
})

describe("regroupement", () => {
  it("regroupe par cleRegroupement et donne le titre au pluriel", () => {
    const actions = [
      action({ id: "1", type: "depense_a_confirmer", cleRegroupement: "dep", appOrigine: "budget" }),
      action({ id: "2", type: "depense_a_confirmer", cleRegroupement: "dep", appOrigine: "budget" }),
      action({ id: "3", type: "depense_a_confirmer", cleRegroupement: "dep", appOrigine: "budget" }),
      action({ id: "4", type: "depense_a_confirmer", cleRegroupement: "dep", appOrigine: "budget" }),
    ]
    const groupes = grouperActions(actions)
    expect(groupes).toHaveLength(1)
    expect(groupes[0].nombre).toBe(4)
    expect(groupes[0].titreGroupe).toBe("4 dépenses à confirmer")
    expect(LIBELLES_TYPES.depense_a_confirmer).toBeDefined()
  })

  it("donne un titre générique sans entrée dans la table", () => {
    const actions = [
      action({ id: "1", type: "inconnu", cleRegroupement: "x" }),
      action({ id: "2", type: "inconnu", cleRegroupement: "x" }),
    ]
    expect(grouperActions(actions)[0].titreGroupe).toBe("2 actions : inconnu")
  })

  it("garde une action sans cleRegroupement seule, avec son titre", () => {
    const groupes = grouperActions([action({ id: "1", titre: "Seule" }), action({ id: "2", titre: "Seule 2" })])
    expect(groupes).toHaveLength(2)
    expect(groupes.map((g) => g.titreGroupe)).toEqual(["Seule", "Seule 2"])
  })
})

describe("prochaine étape", () => {
  it("prend la priorité la plus basse en premier", () => {
    const actions = [9, 3, 6].map((p) => action({ id: `p${p}`, priorite: p }))
    const etape = choisirProchaineEtape({ actions, maintenant: T0, modeTerrain: false })
    expect(etape.genre === "action" && etape.action.priorite).toBe(3)
  })

  it("donne l'ordre 1 à 9 pour une action par priorité", () => {
    const actions = [9, 8, 7, 6, 5, 4, 3, 2, 1].map((p) => action({ id: `p${p}`, priorite: p }))
    const ordre: number[] = []
    const restantes = [...actions]
    while (restantes.length > 0) {
      const etape = choisirProchaineEtape({ actions: restantes, maintenant: T0, modeTerrain: false })
      if (etape.genre !== "action") break
      ordre.push(etape.action.priorite)
      restantes.splice(restantes.indexOf(etape.action), 1)
    }
    expect(ordre).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it("départage une égalité de priorité par l'échéance la plus proche, puis l'ancienneté", () => {
    const tard = action({ id: "tard", priorite: 4, echeance: new Date(T0.getTime() + 10 * JOUR) })
    const tot = action({ id: "tot", priorite: 4, echeance: new Date(T0.getTime() + 2 * JOUR) })
    const sansEcheance = action({ id: "sans", priorite: 4, echeance: null })
    const etape = choisirProchaineEtape({ actions: [sansEcheance, tard, tot], maintenant: T0, modeTerrain: false })
    expect(etape.genre === "action" && etape.action.id).toBe("tot")

    const ancienne = action({ id: "ancienne", priorite: 4, createdAt: new Date("2026-01-01") })
    const recente = action({ id: "recente", priorite: 4, createdAt: new Date("2026-10-01") })
    const e2 = choisirProchaineEtape({ actions: [recente, ancienne], maintenant: T0, modeTerrain: false })
    expect(e2.genre === "action" && e2.action.id).toBe("ancienne")
  })

  it("à moins de 48 heures d'une épreuve, la priorité 1 passe devant tout, puis la 7", () => {
    const epreuve = { nom: "Rallye du Florival", dateDebut: new Date(T0.getTime() + 24 * 60 * 60 * 1000) }
    const actions = [
      action({ id: "p2", priorite: 2 }),
      action({ id: "p7", priorite: 7 }),
      action({ id: "p1", priorite: 1 }),
    ]
    const etape = choisirProchaineEtape({ actions, maintenant: T0, prochaineEpreuve: epreuve, modeTerrain: false })
    expect(etape.genre === "action" && etape.action.id).toBe("p1")
    expect(etape.genre === "action" && etape.pourquoi).toBe("Bloquant pour Rallye du Florival")
  })

  it("au-delà de 48 heures, la règle de l'épreuve ne s'applique pas", () => {
    const epreuve = { nom: "Rallye", dateDebut: new Date(T0.getTime() + 5 * JOUR) }
    const actions = [action({ id: "p2", priorite: 2 }), action({ id: "p7", priorite: 7 })]
    const etape = choisirProchaineEtape({ actions, maintenant: T0, prochaineEpreuve: epreuve, modeTerrain: false })
    expect(etape.genre === "action" && etape.action.id).toBe("p2")
  })

  it("en mode terrain, seules les actions terrain sont proposées", () => {
    const bureau = action({ id: "bureau", priorite: 1 })
    const terrain = action({ id: "terrain", priorite: 5, destinataires: { roles: ["responsable"], memberships: [], niveauRequis: "ecriture", terrain: true } })
    const etape = choisirProchaineEtape({ actions: [bureau, terrain], maintenant: T0, modeTerrain: true })
    expect(etape.genre === "action" && etape.action.id).toBe("terrain")
  })

  it("sans action et épreuve à 12 jours, renvoie le compte à rebours J-12", () => {
    const epreuve = { nom: "Rallye du Florival", dateDebut: new Date(T0.getTime() + 12 * JOUR) }
    const etape = choisirProchaineEtape({ actions: [], maintenant: T0, prochaineEpreuve: epreuve, modeTerrain: false })
    expect(etape).toMatchObject({ genre: "compte_a_rebours", libelle: "J-12 Rallye du Florival" })
  })

  it("sans action ni épreuve, ne propose rien", () => {
    expect(choisirProchaineEtape({ actions: [], maintenant: T0, modeTerrain: false })).toEqual({ genre: "rien" })
  })

  it("donne une ligne « pourquoi » par priorité", () => {
    expect(pourquoi(2)).toBe("Échéance dépassée ou aujourd'hui")
    expect(pourquoi(9)).toBe("Échéance proche")
    expect(pourquoi(1)).toBe("Bloquant")
  })
})
