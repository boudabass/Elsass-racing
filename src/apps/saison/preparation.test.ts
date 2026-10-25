import { describe, expect, it } from "vitest"

import type { SituationPersonne } from "@/apps/equipe/lectures-partagees"
import type { PapierSituation } from "@/apps/voiture/lectures-partagees"

import {
  indicePourEngagement,
  lieuDeReglage,
  pointPapiersDeVehicule,
  pointsDePreparation,
  pointsEquipeDeEngagement,
  type PointEtabli,
  type PointsEquipe,
} from "./preparation"

const midi = new Date("2026-10-16T10:00:00Z")
const dans = (jours: number) => new Date(midi.getTime() + jours * 24 * 60 * 60 * 1000)

// Date d'épreuve : le 7 novembre 2026, minuit UTC comme les colonnes date.
const EPREUVE = new Date("2026-11-07T00:00:00Z")
const jour = (iso: string) => new Date(`${iso}T00:00:00Z`)
const tous = (etat: "regle" | "ouvert", personneId: string | null = null): PointsEquipe => ({
  licences: { etat, detail: etat === "ouvert" ? "Licence de Luc non renseignée" : null, personneId },
  homologations: { etat, detail: null, personneId: null },
})
const luc = (licences: SituationPersonne["licences"], equipements: SituationPersonne["equipements"] = []): SituationPersonne => ({
  personId: "luc",
  prenom: "Luc",
  licences,
  equipements,
})
const casqueOk = [{ type: "casque" as const, finHomologation: jour("2027-01-01") }]

describe("pointsDePreparation", () => {
  it("le paiement existe toujours : réglé ou ouvert selon l'inscription", () => {
    expect(pointsDePreparation(true, []).find((p) => p.point === "paiement")).toMatchObject({ etat: "regle", detail: null })
    expect(pointsDePreparation(false, []).find((p) => p.point === "paiement")).toMatchObject({ etat: "ouvert", detail: "Engagement non payé" })
  })

  it("un point sans ligne est « pas encore suivi », pas réglé", () => {
    const points = pointsDePreparation(true, [])
    expect(points.filter((p) => p.etat === "non_suivi").map((p) => p.point)).toEqual(["licences", "homologations", "papiers"])
  })

  it("les quatre points de préparation, sans les pièces : la zone rouge n'est pas un point", () => {
    expect(pointsDePreparation(true, []).map((p) => p.point)).toEqual(["paiement", "licences", "homologations", "papiers"])
  })

  it("une ligne papiers posée par signal avant la 5.2b est ignorée : Voiture fait foi", () => {
    const points = pointsDePreparation(true, [{ point: "papiers", statut: "ouvert", detail: "Assurance expire le 3 novembre" }])
    expect(points.find((p) => p.point === "papiers")).toEqual({ point: "papiers", etat: "non_suivi", detail: null, personneId: null, vehicleId: null })
  })

  it("Voiture activée : le point Papiers prend l'état lu chez Voiture, et le véhicule à régler", () => {
    const points = pointsDePreparation(true, [{ point: "papiers", statut: "regle", detail: null }], null, {
      etat: "ouvert",
      detail: "Carte grise expire le 3 novembre",
      vehicleId: "saxo",
    })
    expect(points.find((p) => p.point === "papiers")).toEqual({
      point: "papiers",
      etat: "ouvert",
      detail: "Carte grise expire le 3 novembre",
      personneId: null,
      vehicleId: "saxo",
    })
  })

  it("licences et homologations viennent d'Équipe, pas des lignes : une ligne signalée avant la 5.2 est ignorée", () => {
    const points = pointsDePreparation(true, [{ point: "licences", statut: "regle", detail: null }])
    expect(points.find((p) => p.point === "licences")).toMatchObject({ etat: "non_suivi" })
  })

  it("Équipe activée : licences et homologations prennent l'état lu chez Équipe", () => {
    const points = pointsDePreparation(true, [], tous("ouvert", "luc"))
    expect(points.find((p) => p.point === "licences")).toEqual({
      point: "licences",
      etat: "ouvert",
      detail: "Licence de Luc non renseignée",
      personneId: "luc",
      vehicleId: null,
    })
  })
})

describe("pointsEquipeDeEngagement", () => {
  it("pilote et copilote avec licence et homologation valables le jour de l'épreuve : tout est réglé", () => {
    const pilote = luc([{ valableDu: null, valableAu: jour("2026-12-31") }], casqueOk)
    const copilote = { ...luc([{ valableDu: null, valableAu: jour("2026-12-31") }], casqueOk), personId: "anne", prenom: "Anne" }
    expect(pointsEquipeDeEngagement({ pilote, copilote }, EPREUVE)).toEqual({
      licences: { etat: "regle", detail: null, personneId: null },
      homologations: { etat: "regle", detail: null, personneId: null },
    })
  })

  it("licence qui expire avant l'épreuve : ouvert, avec la date, sur la fiche de la personne", () => {
    const pilote = luc([{ valableDu: null, valableAu: jour("2026-11-03") }], casqueOk)
    expect(pointsEquipeDeEngagement({ pilote, copilote: null }, EPREUVE).licences).toEqual({
      etat: "ouvert",
      detail: "Licence de Luc expire le 3 novembre",
      personneId: "luc",
    })
  })

  it("une licence qui expire après l'épreuve est valable à sa date : rien à signaler", () => {
    const pilote = luc([{ valableDu: null, valableAu: jour("2026-11-03") }], casqueOk)
    expect(pointsEquipeDeEngagement({ pilote, copilote: null }, jour("2026-11-01")).licences.etat).toBe("regle")
  })

  it("personne sans licence saisie : ouvert, « non renseignée »", () => {
    const pilote = luc([], casqueOk)
    expect(pointsEquipeDeEngagement({ pilote, copilote: null }, EPREUVE).licences.detail).toBe("Licence de Luc non renseignée")
  })

  it("pas encore valable à l'épreuve : ouvert, « pas encore valable »", () => {
    const pilote = luc([{ valableDu: jour("2026-11-10"), valableAu: null }], casqueOk)
    expect(pointsEquipeDeEngagement({ pilote, copilote: null }, EPREUVE).licences.detail).toBe("Licence de Luc pas encore valable à l'épreuve")
  })

  it("homologation expirée : ouvert, avec le nom de l'équipement", () => {
    const pilote = luc([{ valableDu: null, valableAu: null }], [{ type: "hans", finHomologation: jour("2026-11-06") }])
    expect(pointsEquipeDeEngagement({ pilote, copilote: null }, EPREUVE).homologations).toEqual({
      etat: "ouvert",
      detail: "HANS de Luc : homologation expire le 6 novembre",
      personneId: "luc",
    })
  })

  it("aucun équipement homologué saisi : ouvert", () => {
    const pilote = luc([{ valableDu: null, valableAu: null }], [])
    expect(pointsEquipeDeEngagement({ pilote, copilote: null }, EPREUVE).homologations.detail).toBe("Équipement homologué de Luc non renseigné")
  })

  it("sans pilote désigné : ouvert, sans personne à régler", () => {
    expect(pointsEquipeDeEngagement({ pilote: null, copilote: null }, EPREUVE).licences).toEqual({
      etat: "ouvert",
      detail: "Pilote non désigné",
      personneId: null,
    })
  })

  it("copilote non désigné : rien à signaler (il n'est pas requis)", () => {
    const pilote = luc([{ valableDu: null, valableAu: null }], casqueOk)
    expect(pointsEquipeDeEngagement({ pilote, copilote: null }, EPREUVE).licences.etat).toBe("regle")
  })
})

describe("indicePourEngagement", () => {
  it("ne compte que les points suivis : un point pas encore suivi ne fait pas baisser l'indice", () => {
    const points = pointsDePreparation(true, [])
    expect(indicePourEngagement(points, midi, dans(30))).toEqual({ pourcentage: 100, couleur: "vert" })
  })

  it("tous les points suivis réglés donnent 100 %, la zone rouge n'entrant dans aucun point", () => {
    const points = pointsDePreparation(
      true,
      [],
      { licences: { etat: "regle", detail: null, personneId: null }, homologations: { etat: "regle", detail: null, personneId: null } },
      { etat: "regle", detail: null, vehicleId: "saxo" },
    )
    expect(indicePourEngagement(points, midi, dans(30))).toEqual({ pourcentage: 100, couleur: "vert" })
  })

  it("100 n'apparaît que si chaque point suivi est réglé", () => {
    const points = pointsDePreparation(true, [], null, { etat: "ouvert", detail: "Carte grise expire le 3 novembre", vehicleId: "saxo" })
    expect(indicePourEngagement(points, midi, dans(30))).toEqual({ pourcentage: 50, couleur: "orange" })
  })

  it("Voiture non activée : le point Papiers ne compte pas dans l'indice", () => {
    const points = pointsDePreparation(true, [], null, null)
    expect(points.find((p) => p.point === "papiers")?.etat).toBe("non_suivi")
    expect(indicePourEngagement(points, midi, dans(30))).toEqual({ pourcentage: 100, couleur: "vert" })
  })

  it("rouge quand un point ouvert commence dans moins de 48 heures", () => {
    const points = pointsDePreparation(false, [])
    expect(indicePourEngagement(points, midi, dans(1))?.couleur).toBe("rouge")
    expect(indicePourEngagement(points, midi, dans(10))?.couleur).toBe("orange")
  })

  it("pas d'indice quand aucun point n'est suivi", () => {
    expect(indicePourEngagement([], midi, dans(1))).toBeNull()
  })
})

describe("lieuDeReglage", () => {
  const point = (p: PointEtabli["point"], personneId: string | null = null, vehicleId: string | null = null): PointEtabli => ({
    point: p,
    etat: "ouvert",
    detail: null,
    personneId,
    vehicleId,
  })

  it("le paiement se règle sur la fiche engagement", () => {
    expect(lieuDeReglage(point("paiement"))).toEqual({ type: "fiche_engagement" })
  })

  it("licences et homologations mènent à la fiche de la personne, onglet Licences ou Équipement", () => {
    expect(lieuDeReglage(point("licences", "luc"))).toEqual({ type: "fiche_personne", personneId: "luc", onglet: "licences" })
    expect(lieuDeReglage(point("homologations", "luc"))).toEqual({ type: "fiche_personne", personneId: "luc", onglet: "equipement" })
  })

  it("sans personne à régler (pilote non désigné), rien à ouvrir", () => {
    expect(lieuDeReglage(point("licences"))).toBeNull()
  })

  it("les papiers mènent à l'onglet Papiers de la fiche du véhicule, dans Voiture", () => {
    expect(lieuDeReglage(point("papiers", null, "saxo"))).toEqual({ type: "fiche_vehicule", vehicleId: "saxo", onglet: "papiers" })
  })

  it("sans véhicule (Voiture non suivie), rien à ouvrir pour les papiers", () => {
    expect(lieuDeReglage(point("papiers"))).toBeNull()
  })
})

describe("pointPapiersDeVehicule", () => {
  const papier = (type: "carte_grise" | "assurance", valableJusquAu: string | null, libelle: string | null = null): PapierSituation => ({
    type,
    libelle,
    valableJusquAu: valableJusquAu === null ? null : jour(valableJusquAu),
  })

  it("aucun papier saisi : ouvert, « non renseignés »", () => {
    expect(pointPapiersDeVehicule("saxo", [], EPREUVE)).toEqual({ etat: "ouvert", detail: "Papiers du véhicule non renseignés", vehicleId: "saxo" })
  })

  it("tous les papiers valables à l'épreuve : réglé", () => {
    const papiers = [papier("carte_grise", "2027-06-30"), papier("assurance", "2027-01-15")]
    expect(pointPapiersDeVehicule("saxo", papiers, EPREUVE)).toEqual({ etat: "regle", detail: null, vehicleId: "saxo" })
  })

  it("un papier expiré à la date de l'épreuve, encore valable aujourd'hui : ouvert, avec la date", () => {
    const pointe = pointPapiersDeVehicule("saxo", [papier("carte_grise", "2026-11-03")], EPREUVE)
    expect(pointe).toEqual({ etat: "ouvert", detail: "Carte grise expire le 3 novembre", vehicleId: "saxo" })
    expect(pointPapiersDeVehicule("saxo", [papier("carte_grise", "2026-11-03")], jour("2026-11-01")).etat).toBe("regle")
  })

  it("un papier expiré renouvelé par une ligne valable du même type : réglé", () => {
    const papiers = [papier("carte_grise", "2026-11-06"), papier("carte_grise", "2027-06-30")]
    expect(pointPapiersDeVehicule("saxo", papiers, EPREUVE).etat).toBe("regle")
  })

  it("un papier sans date de fin ne bloque jamais", () => {
    expect(pointPapiersDeVehicule("saxo", [papier("assurance", null)], EPREUVE).etat).toBe("regle")
  })

  it("un papier « à renouveler » à l'épreuve, pas encore expiré : réglé", () => {
    expect(pointPapiersDeVehicule("saxo", [papier("carte_grise", "2026-11-10")], EPREUVE).etat).toBe("regle")
  })

  it("plusieurs types expirés : ouvert, chacun avec sa date", () => {
    const papiers = [papier("carte_grise", "2026-11-03"), papier("assurance", "2026-11-05")]
    expect(pointPapiersDeVehicule("saxo", papiers, EPREUVE).detail).toBe("Carte grise expire le 3 novembre ; Assurance expire le 5 novembre")
  })

  it("« Autre » : chaque libellé saisi est un papier à part, nommé par son libellé", () => {
    const papiers: PapierSituation[] = [
      { type: "autre", libelle: "Vignette", valableJusquAu: jour("2026-11-02") },
      { type: "autre", libelle: "Certificat", valableJusquAu: jour("2027-03-01") },
    ]
    expect(pointPapiersDeVehicule("saxo", papiers, EPREUVE)).toEqual({ etat: "ouvert", detail: "Vignette expire le 2 novembre", vehicleId: "saxo" })
  })
})
