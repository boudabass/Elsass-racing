import { describe, expect, it } from "vitest"

import { rappelsDues, type EpreuveRappel } from "./rappels"

// Instants en heure de Paris (été : UTC+2). 10 h à Paris le 16 octobre.
const matin = new Date("2026-10-16T08:00:00Z")
const jour = (aaaammjj: string) => new Date(`${aaaammjj}T00:00:00Z`)

function epreuve(partiel: Partial<EpreuveRappel>): EpreuveRappel {
  return {
    id: "e1",
    nom: "Rallye test",
    statut: "envisagee",
    dateDebut: jour("2026-10-30"),
    dateFin: jour("2026-10-31"),
    clotureEngagements: null,
    aUneReco: false,
    engagements: [],
    ...partiel,
  }
}

const cles = (liste: ReturnType<typeof rappelsDues>) => liste.map((rappel) => rappel.cle)

describe("rappels : clôture des engagements", () => {
  const engagementNonPaye = { id: "n1", statut: "inscrit" as const, membershipsEquipage: [], resultat: null }

  it("J-14 avant la clôture tant qu'un engagement n'est pas payé", () => {
    const liste = rappelsDues([epreuve({ clotureEngagements: jour("2026-10-30"), engagements: [engagementNonPaye] })], jour("2026-10-16"), new Set())
    expect(cles(liste)).toContain("rappel:cloture:e1:14")
  })

  it("J-14 s'éteint à J-7, remplacé par J-7", () => {
    const epreuves = [epreuve({ clotureEngagements: jour("2026-10-30"), engagements: [engagementNonPaye] })]
    expect(cles(rappelsDues(epreuves, jour("2026-10-23"), new Set()))).toContain("rappel:cloture:e1:7")
    expect(cles(rappelsDues(epreuves, jour("2026-10-23"), new Set()))).not.toContain("rappel:cloture:e1:14")
  })

  it("aucun rappel quand tous les engagements sont payés", () => {
    const paye = { id: "n1", statut: "paye" as const, membershipsEquipage: [], resultat: null }
    expect(rappelsDues([epreuve({ clotureEngagements: jour("2026-10-30"), engagements: [paye] })], jour("2026-10-16"), new Set())).toEqual([])
  })

  it("priorité 2 et destinataires responsable et équipage", () => {
    const [rappel] = rappelsDues([epreuve({ clotureEngagements: jour("2026-10-30"), engagements: [engagementNonPaye] })], jour("2026-10-16"), new Set())
    expect(rappel.priorite).toBe(2)
    expect(rappel.destinataires).toEqual({ kind: "roles", roles: ["responsable", "equipage"] })
  })
})

describe("rappels : reconnaissance", () => {
  it("J-3 avant le début si une reco est définie, pour l'équipage", () => {
    const liste = rappelsDues([epreuve({ aUneReco: true })], jour("2026-10-27"), new Set())
    expect(cles(liste)).toContain("rappel:reco:e1")
    expect(liste.find((rappel) => rappel.cle === "rappel:reco:e1")?.destinataires).toEqual({ kind: "roles", roles: ["equipage"] })
  })

  it("pas de rappel sans reco, ni plus tôt que J-3", () => {
    expect(cles(rappelsDues([epreuve({ aUneReco: false })], jour("2026-10-27"), new Set()))).not.toContain("rappel:reco:e1")
    expect(cles(rappelsDues([epreuve({ aUneReco: true })], jour("2026-10-20"), new Set()))).not.toContain("rappel:reco:e1")
  })
})

describe("rappels : programme du jour", () => {
  const equipe = { id: "n1", statut: "paye" as const, membershipsEquipage: ["m1", "m2"], resultat: null }

  it("le matin de chaque jour de l'épreuve, pour les membres engagés, en terrain", () => {
    const liste = rappelsDues([epreuve({ statut: "en_cours", dateDebut: jour("2026-10-15"), dateFin: jour("2026-10-17"), engagements: [equipe] })], matin, new Set())
    const rappel = liste.find((r) => r.type === "programme_du_jour")
    expect(rappel?.cle).toBe("rappel:programme:e1:2026-10-16")
    expect(rappel?.terrain).toBe(true)
    expect(rappel?.membershipsEquipage).toEqual(["m1", "m2"])
  })

  it("l'après-midi, pas de création nouvelle ; une clé déjà créée reste attendue", () => {
    const apresMidi = new Date("2026-10-16T14:00:00Z")
    const epreuves = [epreuve({ statut: "en_cours", dateDebut: jour("2026-10-15"), dateFin: jour("2026-10-17"), engagements: [equipe] })]
    expect(cles(rappelsDues(epreuves, apresMidi, new Set()))).not.toContain("rappel:programme:e1:2026-10-16")
    expect(cles(rappelsDues(epreuves, apresMidi, new Set(["rappel:programme:e1:2026-10-16"])))).toContain("rappel:programme:e1:2026-10-16")
  })
})

describe("rappels : résultats", () => {
  const parti = (resultat: { validation: "saisi" | "a_verifier" | "valide"; createdAt: Date } | null) => ({
    id: "n1",
    statut: "parti" as const,
    membershipsEquipage: ["m1"],
    resultat,
  })

  it("résultat à saisir le lendemain de la fin, engagement parti sans résultat", () => {
    const epreuves = [epreuve({ statut: "terminee", dateDebut: jour("2026-10-10"), dateFin: jour("2026-10-11"), engagements: [parti(null)] })]
    const liste = rappelsDues(epreuves, jour("2026-10-12"), new Set())
    expect(cles(liste)).toContain("rappel:resultat_saisir:n1")
  })

  it("pas de résultat à saisir le jour même de la fin", () => {
    const epreuves = [epreuve({ statut: "en_cours", dateDebut: jour("2026-10-10"), dateFin: jour("2026-10-11"), engagements: [parti(null)] })]
    expect(cles(rappelsDues(epreuves, jour("2026-10-11"), new Set()))).not.toContain("rappel:resultat_saisir:n1")
  })

  it("relance de validation 48 heures après la saisie, tant que le résultat n'est pas validé", () => {
    const saisi = new Date("2026-10-14T08:00:00Z")
    const epreuves = [epreuve({ statut: "terminee", engagements: [parti({ validation: "saisi", createdAt: saisi })] })]
    const apres48h = new Date("2026-10-16T09:00:00Z")
    const relance = rappelsDues(epreuves, apres48h, new Set()).find((rappel) => rappel.type === "resultat_a_valider")
    expect(relance).toMatchObject({ cle: "resultat_a_valider:n1", priorite: 6, relance: true, destinataires: { kind: "validation" } })
    expect(rappelsDues(epreuves, new Date("2026-10-15T08:00:00Z"), new Set()).some((rappel) => rappel.type === "resultat_a_valider")).toBe(false)
  })

  it("pas de relance pour un résultat déjà validé", () => {
    const saisi = new Date("2026-10-10T08:00:00Z")
    const epreuves = [epreuve({ statut: "terminee", engagements: [parti({ validation: "valide", createdAt: saisi })] })]
    expect(rappelsDues(epreuves, new Date("2026-10-16T09:00:00Z"), new Set())).toEqual([])
  })
})

describe("rappels : épreuves hors champ", () => {
  it("une épreuve annulée ne donne aucun rappel", () => {
    const engagements = [{ id: "n1", statut: "inscrit" as const, membershipsEquipage: [], resultat: null }]
    expect(rappelsDues([epreuve({ statut: "annulee", clotureEngagements: jour("2026-10-30"), engagements })], matin, new Set())).toEqual([])
  })

  it("une épreuve terminée ne rappelle plus la clôture ni la reco", () => {
    const engagements = [{ id: "n1", statut: "inscrit" as const, membershipsEquipage: [], resultat: null }]
    expect(rappelsDues([epreuve({ statut: "terminee", aUneReco: true, clotureEngagements: jour("2026-10-30"), engagements })], matin, new Set())).toEqual([])
  })
})
