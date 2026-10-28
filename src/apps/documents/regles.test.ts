import { describe, expect, it } from "vitest"

import {
  completude,
  joursAvantEcheance,
  numeroVersionSuivant,
  peutAjouterDocument,
  peutArchiverDocument,
  peutDeplacerDocument,
  peutGererDossier,
  peutModifierDocument,
  peutPartagerDocument,
  peutVoirDocument,
  peutVoirDossier,
  pireZone,
  texteEcheance,
  zoneDocument,
  type DocumentPourDroits,
  type DossierPourDroits,
  type QuiAgit,
} from "./regles"

// Aujourd'hui : mercredi 28 octobre 2026, midi à Paris. Une date « dans n jours » est le jour civil n jours plus tard.
const MAINTENANT = new Date("2026-10-28T11:00:00Z")
const dans = (jours: number) => new Date(Date.UTC(2026, 9, 28 + jours))

describe("zone d'un document", () => {
  it("bornes : vert au-delà de 60 jours, orange de 60 à 8 jours, rouge à 7 jours et moins", () => {
    expect(zoneDocument(dans(61), MAINTENANT)).toBe("vert")
    expect(zoneDocument(dans(60), MAINTENANT)).toBe("orange")
    expect(zoneDocument(dans(8), MAINTENANT)).toBe("orange")
    expect(zoneDocument(dans(7), MAINTENANT)).toBe("rouge")
  })

  it("aujourd'hui et une date passée hier sont rouges ; sans date, pas de zone", () => {
    expect(zoneDocument(dans(0), MAINTENANT)).toBe("rouge")
    expect(zoneDocument(dans(-1), MAINTENANT)).toBe("rouge")
    expect(zoneDocument(null, MAINTENANT)).toBeNull()
  })

  it("jours civils de Paris : à 23 h 30 à Paris, la date du jour compte encore pour aujourd'hui", () => {
    // 21 h 30 UTC le 28 octobre = 22 h 30 à Paris : même jour civil que la date, 0 jour restant.
    expect(joursAvantEcheance(dans(0), new Date("2026-10-28T21:30:00Z"))).toBe(0)
    // 23 h 30 UTC = 0 h 30 à Paris le 29 : la date du 28 est passée.
    expect(joursAvantEcheance(dans(0), new Date("2026-10-28T23:30:00Z"))).toBe(-1)
  })
})

describe("pire zone d'un dossier", () => {
  it("prend la zone la plus grave, les documents sans date ne comptent pas", () => {
    expect(pireZone(["vert", "orange"])).toBe("orange")
    expect(pireZone(["vert", "orange", "rouge"])).toBe("rouge")
    expect(pireZone([null, "vert"])).toBe("vert")
  })

  it("aucun document avec une date : pas de zone", () => {
    expect(pireZone([])).toBeNull()
    expect(pireZone([null])).toBeNull()
  })
})

describe("texte d'échéance", () => {
  it("dit l'état en toutes lettres, sans compter sur la couleur", () => {
    expect(texteEcheance(null, MAINTENANT)).toBe("Sans échéance")
    expect(texteEcheance(dans(-1), MAINTENANT)).toBe("Expiré")
    expect(texteEcheance(dans(0), MAINTENANT)).toBe("Expire aujourd'hui")
    expect(texteEcheance(dans(1), MAINTENANT)).toBe("Expire dans 1 jour")
    expect(texteEcheance(dans(5), MAINTENANT)).toBe("Expire dans 5 jours")
    expect(texteEcheance(dans(61), MAINTENANT)).toBe("À jour")
  })
})

describe("complétude d'un dossier type", () => {
  const statuts = { docType: "statuts" as const, status: "actif" as const, valableJusquAu: null }
  const attendus = ["statuts", "recepisse_rna", "pv_ag"] as const

  it("un type compte une fois, même avec deux documents", () => {
    expect(completude(attendus, [statuts, statuts], MAINTENANT)).toEqual({ presents: 1, attendus: 3 })
  })

  it("un document archivé ne compte pas", () => {
    const archive = { docType: "recepisse_rna" as const, status: "archive" as const, valableJusquAu: null }
    expect(completude(attendus, [archive], MAINTENANT).presents).toBe(0)
  })

  it("un document expiré à ce jour ne compte pas, un document valable jusqu'à aujourd'hui compte", () => {
    const expire = { docType: "pv_ag" as const, status: "actif" as const, valableJusquAu: dans(-1) }
    const valableAujourdhui = { docType: "pv_ag" as const, status: "actif" as const, valableJusquAu: dans(0) }
    expect(completude(attendus, [expire], MAINTENANT).presents).toBe(0)
    expect(completude(attendus, [valableAujourdhui], MAINTENANT).presents).toBe(1)
  })
})

describe("numéro de version suivant", () => {
  it("à partir de 1, puis le maximum existant plus un, archivées comprises", () => {
    expect(numeroVersionSuivant([])).toBe(1)
    expect(numeroVersionSuivant([1, 2])).toBe(3)
    expect(numeroVersionSuivant([1, 3])).toBe(4)
  })
})

// ─── Droits ──────────────────────────────────────────────────────────────────

const GESTION: QuiAgit = { personId: "gestion", niveau: "gestion" }
const ECRIVAIN: QuiAgit = { personId: "ecrivain", niveau: "ecriture" }
const LECTEUR: QuiAgit = { personId: "lecteur", niveau: "lecture" }
const ASSISTANCE: QuiAgit = { personId: "assistance", niveau: "contribution" }
const AUCUN: QuiAgit = { personId: "aucun", niveau: "aucun" }

const dossierTeam: DossierPourDroits = { ownerPersonId: null, visibility: "team" }
const dossierGestion: DossierPourDroits = { ownerPersonId: null, visibility: "gestion" }

const doc = (partiel: Partial<DocumentPourDroits> = {}): DocumentPourDroits => ({
  ownerPersonId: "ecrivain",
  visibility: "team",
  accesPersonne: null,
  ...partiel,
})

describe("peutVoirDossier", () => {
  it("un dossier team se voit au niveau lecture ; gestion se voit en gestion, un dossier gestion se cache aux autres", () => {
    expect(peutVoirDossier(dossierTeam, LECTEUR)).toBe(true)
    expect(peutVoirDossier(dossierGestion, ECRIVAIN)).toBe(false)
    expect(peutVoirDossier(dossierGestion, GESTION)).toBe(true)
    expect(peutVoirDossier(dossierTeam, AUCUN)).toBe(false)
  })

  it("le propriétaire d'un dossier le voit même en gestion", () => {
    expect(peutVoirDossier({ ownerPersonId: "ecrivain", visibility: "gestion" }, ECRIVAIN)).toBe(true)
  })
})

describe("peutVoirDocument (visibilité)", () => {
  it("visibilité team : tout membre au niveau lecture ou plus ; l'assistance seulement les siens", () => {
    const d = doc({ visibility: "team" })
    expect(peutVoirDocument(d, dossierTeam, LECTEUR)).toBe(true)
    expect(peutVoirDocument(d, dossierTeam, ECRIVAIN)).toBe(true)
    expect(peutVoirDocument(d, dossierTeam, ASSISTANCE)).toBe(false)
    expect(peutVoirDocument(d, dossierTeam, AUCUN)).toBe(false)
  })

  it("visibilité gestion : niveau gestion et propriétaire seulement, l'accès interne ne suffit pas", () => {
    const sansAcces = doc({ visibility: "gestion" })
    const avecAcces = doc({ visibility: "gestion", accesPersonne: "lecture" })
    expect(peutVoirDocument(sansAcces, dossierTeam, GESTION)).toBe(true)
    expect(peutVoirDocument(sansAcces, dossierTeam, ECRIVAIN)).toBe(true)
    expect(peutVoirDocument(sansAcces, dossierTeam, LECTEUR)).toBe(false)
    expect(peutVoirDocument(avecAcces, dossierTeam, LECTEUR)).toBe(false)
  })

  it("visibilité prive : propriétaire, personnes ouvertes et gestion", () => {
    const d = doc({ visibility: "prive", ownerPersonId: "ecrivain" })
    expect(peutVoirDocument(d, dossierTeam, GESTION)).toBe(true)
    expect(peutVoirDocument(d, dossierTeam, ECRIVAIN)).toBe(true)
    expect(peutVoirDocument(d, dossierTeam, LECTEUR)).toBe(false)
    expect(peutVoirDocument({ ...d, accesPersonne: "lecture" }, dossierTeam, LECTEUR)).toBe(true)
  })

  it("l'assistance voit un document qui lui est ouvert, quelle que soit la visibilité", () => {
    expect(peutVoirDocument(doc({ visibility: "prive", accesPersonne: "lecture" }), dossierTeam, ASSISTANCE)).toBe(true)
    expect(peutVoirDocument(doc({ visibility: "gestion", accesPersonne: "contribution" }), dossierGestion, ASSISTANCE)).toBe(true)
  })

  it("l'assistance voit ses propres documents, même dans un dossier de gestion", () => {
    const sien = doc({ ownerPersonId: "assistance", visibility: "gestion" })
    expect(peutVoirDocument(sien, dossierGestion, ASSISTANCE)).toBe(true)
  })

  it("un dossier invisible cache ses documents aux membres (sauf le niveau gestion)", () => {
    const d = doc({ visibility: "team", ownerPersonId: "ecrivain" })
    expect(peutVoirDocument(d, dossierGestion, ECRIVAIN)).toBe(false)
    expect(peutVoirDocument(d, dossierGestion, LECTEUR)).toBe(false)
    expect(peutVoirDocument(d, dossierGestion, GESTION)).toBe(true)
  })

  it("le niveau aucun ne voit rien, même un document qui lui est ouvert", () => {
    expect(peutVoirDocument(doc({ visibility: "team", accesPersonne: "lecture" }), dossierTeam, AUCUN)).toBe(false)
  })
})

describe("peutModifierDocument (garde des services)", () => {
  it("écriture et gestion modifient tout document qu'ils voient", () => {
    expect(peutModifierDocument(doc(), dossierTeam, ECRIVAIN)).toEqual({ permis: true })
    expect(peutModifierDocument(doc({ ownerPersonId: "autre" }), dossierTeam, GESTION)).toEqual({ permis: true })
  })

  it("le niveau lecture refuse et dit pourquoi", () => {
    const decision = peutModifierDocument(doc(), dossierTeam, LECTEUR)
    expect(decision).toEqual({ permis: false, raison: "Ton niveau d'accès ne permet que la lecture du coffre-fort." })
  })

  it("l'assistance modifie les siens", () => {
    expect(peutModifierDocument(doc({ ownerPersonId: "assistance" }), dossierTeam, ASSISTANCE)).toEqual({ permis: true })
  })

  it("l'assistance modifie un document ouvert en contribution, pas en lecture", () => {
    expect(peutModifierDocument(doc({ accesPersonne: "contribution" }), dossierTeam, ASSISTANCE)).toEqual({ permis: true })
    const refus = peutModifierDocument(doc({ accesPersonne: "lecture" }), dossierTeam, ASSISTANCE)
    expect(refus).toEqual({ permis: false, raison: "Ce document ne t'appartient pas et ne t'est pas ouvert en contribution." })
  })

  it("l'assistance ne modifie pas un document qu'elle ne voit pas, et le dit", () => {
    const refus = peutModifierDocument(doc(), dossierTeam, ASSISTANCE)
    expect(refus).toEqual({ permis: false, raison: "Tu ne vois pas ce document." })
  })
})

describe("gestes réservés au niveau écriture", () => {
  it("l'assistance n'archive, ne déplace, ne partage pas, même ses documents", () => {
    const sien = doc({ ownerPersonId: "assistance" })
    expect(peutArchiverDocument(sien, dossierTeam, ASSISTANCE)).toEqual({ permis: false, raison: "L'assistance ne peut pas archiver un document." })
    expect(peutDeplacerDocument(sien, dossierTeam, ASSISTANCE)).toEqual({ permis: false, raison: "L'assistance ne peut pas déplacer un document." })
    expect(peutPartagerDocument(sien, dossierTeam, ASSISTANCE)).toEqual({ permis: false, raison: "L'assistance ne peut pas partager un document." })
  })

  it("l'écriture archive, déplace et partage ce qu'elle voit", () => {
    expect(peutArchiverDocument(doc(), dossierTeam, ECRIVAIN)).toEqual({ permis: true })
    expect(peutDeplacerDocument(doc(), dossierTeam, ECRIVAIN)).toEqual({ permis: true })
    expect(peutPartagerDocument(doc(), dossierTeam, ECRIVAIN)).toEqual({ permis: true })
  })
})

describe("ajouter un document et gérer les dossiers", () => {
  it("ajouter : l'assistance et l'écriture ; lecture et aucun refusés avec la raison", () => {
    expect(peutAjouterDocument(ASSISTANCE)).toEqual({ permis: true })
    expect(peutAjouterDocument(ECRIVAIN)).toEqual({ permis: true })
    expect(peutAjouterDocument(LECTEUR)).toEqual({ permis: false, raison: "Ton niveau d'accès ne permet que la lecture du coffre-fort." })
    expect(peutAjouterDocument(AUCUN).permis).toBe(false)
  })

  it("dossiers : niveau écriture seulement, l'assistance a la raison", () => {
    expect(peutGererDossier(ECRIVAIN)).toEqual({ permis: true })
    expect(peutGererDossier(ASSISTANCE)).toEqual({
      permis: false,
      raison: "Tu ne peux pas gérer les dossiers : ajoute tes documents dans un dossier existant.",
    })
  })
})
