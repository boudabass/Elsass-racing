import { describe, expect, it } from "vitest"

import { PRIORITE } from "@/core/actions/priorites"
import { rappelsDues, type EngagementRappel, type EpreuveRappel } from "./rappels"

// 16 octobre 2026, 10 h à Paris : la fenêtre bloquante va jusqu'au 23 octobre (J+7 compris).
const maintenant = new Date("2026-10-16T08:00:00Z")
const jour = (aaaammjj: string) => new Date(`${aaaammjj}T00:00:00Z`)

function epreuve(partiel: Partial<EpreuveRappel>): EpreuveRappel {
  return {
    id: "e1",
    nom: "Rallye test",
    statut: "envisagee",
    dateDebut: jour("2026-10-20"),
    dateFin: jour("2026-10-21"),
    clotureEngagements: null,
    aUneReco: false,
    engagements: [],
    ...partiel,
  }
}

function engagement(partiel: Partial<EngagementRappel>): EngagementRappel {
  return { id: "n1", statut: "inscrit", membershipsEquipage: [], resultat: null, ...partiel }
}

const payer = (liste: ReturnType<typeof rappelsDues>) => liste.filter((rappel) => rappel.type === "payer_engagement")

describe("rappels : engagement à payer (rang 1, fenêtre des 7 jours)", () => {
  it("un engagement inscrit non payé, épreuve dans 4 jours : rang 1, responsable, un bouton-lien vers l'engagement", () => {
    const [rappel] = payer(rappelsDues([epreuve({ engagements: [engagement({})] })], maintenant, new Set()))
    expect(rappel.cle).toBe("rappel:payer:n1")
    expect(rappel.priorite).toBe(PRIORITE.bloquant)
    expect(rappel.destinataires).toEqual({ kind: "roles", roles: ["responsable"] })
    expect(rappel.niveauRequis).toBe("ecriture")
    expect(rappel.boutons).toEqual([{ cle: "voir", libelle: "Voir l'engagement", lien: "/apps/saison/engagements/n1" }])
  })

  it("envisagé : aussi à payer", () => {
    expect(payer(rappelsDues([epreuve({ engagements: [engagement({ statut: "envisage" })] })], maintenant, new Set()))).toHaveLength(1)
  })

  it("épreuve à J+7 : dans la fenêtre ; à J+8 : hors de la fenêtre", () => {
    const dans = epreuve({ dateDebut: jour("2026-10-23"), dateFin: jour("2026-10-24"), engagements: [engagement({})] })
    const hors = epreuve({ dateDebut: jour("2026-10-24"), dateFin: jour("2026-10-25"), engagements: [engagement({})] })
    expect(payer(rappelsDues([dans], maintenant, new Set()))).toHaveLength(1)
    expect(payer(rappelsDues([hors], maintenant, new Set()))).toHaveLength(0)
  })

  it("épreuve en cours : à payer tant qu'elle n'est pas finie", () => {
    const enCours = epreuve({ statut: "en_cours", dateDebut: jour("2026-10-14"), dateFin: jour("2026-10-17"), engagements: [engagement({})] })
    expect(payer(rappelsDues([enCours], maintenant, new Set()))).toHaveLength(1)
  })

  it("payé, forfait, parti : rien à payer", () => {
    for (const statut of ["paye", "forfait", "parti"] as const) {
      expect(payer(rappelsDues([epreuve({ engagements: [engagement({ statut })] })], maintenant, new Set()))).toHaveLength(0)
    }
  })

  it("épreuve annulée ou terminée : rien à payer", () => {
    expect(payer(rappelsDues([epreuve({ statut: "annulee", engagements: [engagement({})] })], maintenant, new Set()))).toHaveLength(0)
    expect(payer(rappelsDues([epreuve({ statut: "terminee", engagements: [engagement({})] })], maintenant, new Set()))).toHaveLength(0)
  })
})
