import { describe, expect, it } from "vitest"

import {
  clotureProposee,
  indicePreparation,
  jourDeParis,
  masquerMontants,
  minuitParis,
  prochaineEpreuve,
  statutEngagement,
  statutEpreuve,
  transitionResultat,
  type EntreeStatut,
  type EpreuvePourCloture,
  type EpreuvePourProchaine,
} from "./regles"

// Dates calendaires : minuit UTC, comme Prisma les renvoie pour @db.Date.
const jour = (texte: string) => new Date(`${texte}T00:00:00Z`)
// Instants : midi à Paris (11 h UTC en été, 12 h UTC en hiver) pour rester dans le bon jour.
const midi = (texte: string) => new Date(`${texte}T12:00:00+02:00`)

const SANS_INFO: EntreeStatut = { dossierEnvoyeLe: null, payeLe: null, dateDebutEpreuve: jour("2026-11-11"), resultat: null }

describe("calendrier de Paris", () => {
  it("un instant de la nuit UTC compte pour le lendemain à Paris", () => {
    expect(jourDeParis(new Date("2026-10-15T23:30:00Z"))).toBe("2026-10-16")
  })

  it("minuit de Paris est décalé d'une heure en hiver et de deux en été", () => {
    expect(minuitParis(jour("2026-01-15")).toISOString()).toBe("2026-01-14T23:00:00.000Z")
    expect(minuitParis(jour("2026-07-15")).toISOString()).toBe("2026-07-14T22:00:00.000Z")
  })
})

describe("statutEngagement", () => {
  it("sans information, l'engagement est envisagé", () => {
    expect(statutEngagement(SANS_INFO, midi("2026-10-16"))).toBe("envisage")
  })

  it("le dossier envoyé fait passer à inscrit", () => {
    const entree = { ...SANS_INFO, dossierEnvoyeLe: midi("2026-10-01") }
    expect(statutEngagement(entree, midi("2026-10-16"))).toBe("inscrit")
  })

  it("le paiement fait passer à payé, même si le dossier n'est pas noté envoyé", () => {
    const entree = { ...SANS_INFO, payeLe: jour("2026-10-10") }
    expect(statutEngagement(entree, midi("2026-10-16"))).toBe("paye")
  })

  it("le jour même de l'épreuve, l'engagement est parti, payé ou non", () => {
    const aujourdhui = midi("2026-11-11")
    expect(statutEngagement(SANS_INFO, aujourdhui)).toBe("parti")
    expect(statutEngagement({ ...SANS_INFO, payeLe: jour("2026-11-01") }, aujourdhui)).toBe("parti")
  })

  it("la veille de l'épreuve, un engagement payé reste payé", () => {
    const entree = { ...SANS_INFO, payeLe: jour("2026-11-01") }
    expect(statutEngagement(entree, midi("2026-11-10"))).toBe("paye")
  })

  it("un résultat validé donne arrivee, abandon ou forfait", () => {
    const base = { ...SANS_INFO, dateDebutEpreuve: jour("2026-10-10") }
    const valide = (statutFinal: "arrivee" | "abandon" | "forfait") => ({ ...base, resultat: { statutFinal, validation: "valide" as const } })
    expect(statutEngagement(valide("arrivee"), midi("2026-10-16"))).toBe("arrivee")
    expect(statutEngagement(valide("abandon"), midi("2026-10-16"))).toBe("abandon")
    expect(statutEngagement(valide("forfait"), midi("2026-10-16"))).toBe("forfait")
  })

  it("une exclusion validée reste arrivee : la sanction est une décision de classement", () => {
    const entree = { ...SANS_INFO, resultat: { statutFinal: "exclusion" as const, validation: "valide" as const } }
    expect(statutEngagement(entree, midi("2026-11-12"))).toBe("arrivee")
  })

  it("un résultat non validé ne change pas le statut", () => {
    const entree = { ...SANS_INFO, dateDebutEpreuve: jour("2026-10-10"), resultat: { statutFinal: "abandon" as const, validation: "a_verifier" as const } }
    expect(statutEngagement(entree, midi("2026-10-16"))).toBe("parti")
  })

  it("le statut recule quand l'information est retirée", () => {
    const paye = { ...SANS_INFO, dossierEnvoyeLe: midi("2026-10-01"), payeLe: jour("2026-10-10") }
    expect(statutEngagement(paye, midi("2026-10-16"))).toBe("paye")
    expect(statutEngagement({ ...paye, payeLe: null }, midi("2026-10-16"))).toBe("inscrit")
    expect(statutEngagement({ ...paye, payeLe: null, dossierEnvoyeLe: null }, midi("2026-10-16"))).toBe("envisage")
  })

  it("un résultat contesté fait revenir au statut calculé sans lui", () => {
    const entree = { ...SANS_INFO, dateDebutEpreuve: jour("2026-10-10"), payeLe: jour("2026-10-05"), resultat: { statutFinal: "arrivee" as const, validation: "conteste" as const } }
    expect(statutEngagement(entree, midi("2026-10-16"))).toBe("parti")
  })
})

describe("statutEpreuve", () => {
  const epreuve = { statut: "envisagee" as const, dateDebut: jour("2026-10-10"), dateFin: jour("2026-10-11") }

  it("annulée reste annulée, même après la date", () => {
    expect(statutEpreuve({ ...epreuve, statut: "annulee" }, midi("2026-12-01"))).toBe("annulee")
  })

  it("avant le premier jour, l'épreuve est envisagée", () => {
    expect(statutEpreuve(epreuve, midi("2026-10-09"))).toBe("envisagee")
  })

  it("du premier au dernier jour inclus, l'épreuve est en cours", () => {
    expect(statutEpreuve(epreuve, midi("2026-10-10"))).toBe("en_cours")
    expect(statutEpreuve(epreuve, midi("2026-10-11"))).toBe("en_cours")
  })

  it("après le dernier jour, l'épreuve est terminée", () => {
    expect(statutEpreuve(epreuve, midi("2026-10-12"))).toBe("terminee")
  })
})

describe("indicePreparation", () => {
  const debut = minuitParis(jour("2026-11-11"))
  const heures = (nombre: number) => new Date(debut.getTime() - nombre * 3600 * 1000)

  it("aucun point : pas d'indice, jamais 100 par défaut", () => {
    expect(indicePreparation([], heures(500), debut)).toBeNull()
  })

  it("tous les points réglés : 100, vert", () => {
    expect(indicePreparation([{ statut: "regle" }, { statut: "regle" }], heures(1), debut)).toEqual({ pourcentage: 100, couleur: "vert" })
  })

  it("arrondi à l'entier inférieur : deux points réglés sur trois donne 66", () => {
    const points = [{ statut: "regle" as const }, { statut: "regle" as const }, { statut: "ouvert" as const }]
    expect(indicePreparation(points, heures(500), debut)).toEqual({ pourcentage: 66, couleur: "orange" })
  })

  it("un point ouvert à moins de 48 heures du début donne rouge", () => {
    const points = [{ statut: "regle" as const }, { statut: "ouvert" as const }]
    expect(indicePreparation(points, heures(47), debut)).toEqual({ pourcentage: 50, couleur: "rouge" })
  })

  it("à exactement 48 heures du début, le point ouvert reste orange", () => {
    const points = [{ statut: "regle" as const }, { statut: "ouvert" as const }]
    expect(indicePreparation(points, heures(48), debut)).toEqual({ pourcentage: 50, couleur: "orange" })
  })

  it("un point ouvert après le début de l'épreuve reste rouge", () => {
    const points = [{ statut: "ouvert" as const }]
    expect(indicePreparation(points, heures(-3), debut)).toEqual({ pourcentage: 0, couleur: "rouge" })
  })
})

describe("transitionResultat", () => {
  const responsable = { membershipId: "resp", role: "responsable" as const }
  const equipier = { membershipId: "equi", role: "equipage" as const }
  const assistance = { membershipId: "assi", role: "assistance" as const }
  const invite = { membershipId: "invi", role: "invite" as const }

  it("saisi → a_verifier quand une preuve est jointe", () => {
    expect(transitionResultat({ validation: "saisi", saisiParMembershipId: "equi" }, { type: "joindre_preuve" }, equipier)).toEqual({ ok: true, validation: "a_verifier" })
  })

  it("un autre membre d'équipage valide un résultat à vérifier", () => {
    const etat = { validation: "a_verifier" as const, saisiParMembershipId: "resp" }
    expect(transitionResultat(etat, { type: "valider" }, equipier)).toEqual({ ok: true, validation: "valide" })
  })

  it("on ne valide pas son propre résultat quand on est équipage", () => {
    const etat = { validation: "a_verifier" as const, saisiParMembershipId: "equi" }
    const resultat = transitionResultat(etat, { type: "valider" }, equipier)
    expect(resultat.ok).toBe(false)
    if (!resultat.ok) expect(resultat.message).toContain("un autre membre doit le valider")
  })

  it("le responsable peut valider son propre résultat", () => {
    const etat = { validation: "a_verifier" as const, saisiParMembershipId: "resp" }
    expect(transitionResultat(etat, { type: "valider" }, responsable)).toEqual({ ok: true, validation: "valide" })
  })

  it("l'assistance et les invités ne valident pas, avec un message qui le dit", () => {
    const etat = { validation: "a_verifier" as const, saisiParMembershipId: "resp" }
    for (const acteur of [assistance, invite]) {
      const resultat = transitionResultat(etat, { type: "valider" }, acteur)
      expect(resultat.ok).toBe(false)
      if (!resultat.ok) expect(resultat.message).toContain("responsable ou un membre d'équipage")
    }
  })

  it("un résultat sans preuve (saisi) ne se valide pas directement", () => {
    const resultat = transitionResultat({ validation: "saisi", saisiParMembershipId: "resp" }, { type: "valider" }, responsable)
    expect(resultat.ok).toBe(false)
  })

  it("contester un résultat validé exige un commentaire", () => {
    const etat = { validation: "valide" as const, saisiParMembershipId: "resp" }
    expect(transitionResultat(etat, { type: "contester", commentaire: "   " }, equipier).ok).toBe(false)
    expect(transitionResultat(etat, { type: "contester", commentaire: "Temps erroné" }, equipier)).toEqual({ ok: true, validation: "conteste" })
  })

  it("on ne conteste pas un résultat qui n'est pas validé", () => {
    const resultat = transitionResultat({ validation: "a_verifier", saisiParMembershipId: "resp" }, { type: "contester", commentaire: "x" }, equipier)
    expect(resultat.ok).toBe(false)
  })

  it("conteste → a_verifier par une nouvelle preuve, sans revalider directement", () => {
    const etat = { validation: "conteste" as const, saisiParMembershipId: "resp" }
    expect(transitionResultat(etat, { type: "joindre_preuve" }, equipier)).toEqual({ ok: true, validation: "a_verifier" })
    expect(transitionResultat(etat, { type: "valider" }, equipier).ok).toBe(false)
  })

  it("une preuve ne s'ajoute pas à un résultat validé", () => {
    const resultat = transitionResultat({ validation: "valide", saisiParMembershipId: "resp" }, { type: "joindre_preuve" }, equipier)
    expect(resultat.ok).toBe(false)
  })
})

describe("prochaineEpreuve", () => {
  const epreuve = (nom: string, debut: string, fin: string, statut: EpreuvePourProchaine["statut"], engagements: EpreuvePourProchaine["engagements"]) => ({
    nom,
    statut,
    dateDebut: jour(debut),
    dateFin: jour(fin),
    engagements,
  })

  it("prend la première épreuve à venir avec un engagement non envisagé", () => {
    const epreuves = [
      epreuve("passée", "2026-09-01", "2026-09-02", "terminee", ["arrivee"]),
      epreuve("sans engagement", "2026-10-10", "2026-10-11", "envisagee", ["envisage"]),
      epreuve("engagée", "2026-10-20", "2026-10-21", "envisagee", ["inscrit"]),
    ]
    expect(prochaineEpreuve(epreuves, midi("2026-10-16"))?.nom).toBe("engagée")
  })

  it("une épreuve dont le dernier jour est aujourd'hui reste candidate", () => {
    const epreuves = [epreuve("aujourd'hui", "2026-10-15", "2026-10-16", "en_cours", ["paye"])]
    expect(prochaineEpreuve(epreuves, midi("2026-10-16"))?.nom).toBe("aujourd'hui")
  })

  it("les épreuves annulées sont ignorées", () => {
    const epreuves = [epreuve("annulée", "2026-10-20", "2026-10-21", "annulee", ["paye"]), epreuve("suivante", "2026-11-01", "2026-11-02", "envisagee", ["envisage"])]
    expect(prochaineEpreuve(epreuves, midi("2026-10-16"))?.nom).toBe("suivante")
  })

  it("à défaut d'épreuve engagée, prend la première qui commence à venir", () => {
    const epreuves = [epreuve("à venir", "2026-11-01", "2026-11-02", "envisagee", ["envisage"]), epreuve("plus tard", "2026-12-01", "2026-12-02", "envisagee", ["envisage"])]
    expect(prochaineEpreuve(epreuves, midi("2026-10-16"))?.nom).toBe("à venir")
  })

  it("renvoie null quand il ne reste rien", () => {
    expect(prochaineEpreuve([epreuve("passée", "2026-09-01", "2026-09-02", "terminee", ["arrivee"])], midi("2026-10-16"))).toBeNull()
  })
})

describe("clotureProposee", () => {
  const engagement = (statut: EpreuvePourCloture["engagements"][number]["statut"], validation: EpreuvePourCloture["engagements"][number]["validation"]) => ({ statut, validation })
  const epreuve = (debut: string, statut: EpreuvePourCloture["statut"], engagements: EpreuvePourCloture["engagements"]): EpreuvePourCloture => ({
    statut,
    dateDebut: jour(debut),
    engagements,
  })

  it("vraie quand chaque engagement parti de la dernière épreuve a un résultat validé", () => {
    const saison = [epreuve("2026-03-28", "terminee", [engagement("arrivee", "valide")]), epreuve("2026-10-10", "terminee", [engagement("arrivee", "valide"), engagement("abandon", "valide")])]
    expect(clotureProposee(saison)).toBe(true)
  })

  it("fausse si un engagement parti n'a pas de résultat validé", () => {
    const saison = [epreuve("2026-10-10", "terminee", [engagement("arrivee", "valide"), engagement("parti", "a_verifier")])]
    expect(clotureProposee(saison)).toBe(false)
  })

  it("fausse quand aucun engagement n'est parti", () => {
    expect(clotureProposee([epreuve("2026-11-11", "envisagee", [engagement("paye", null)])])).toBe(false)
  })

  it("ignore les épreuves annulées pour trouver la dernière", () => {
    const saison = [epreuve("2026-10-10", "terminee", [engagement("arrivee", "valide")]), epreuve("2026-11-11", "annulee", [engagement("parti", null)])]
    expect(clotureProposee(saison)).toBe(true)
  })

  it("fausse sans épreuve active", () => {
    expect(clotureProposee([epreuve("2026-11-11", "annulee", [])])).toBe(false)
  })
})

describe("masquerMontants", () => {
  const registration = { id: "r1", montantDu: 4500, tarifNormal: 3000, tarifLicencieAsa: 2500, modePaiement: "virement", reference: "REF-1", remarques: "ok" }

  it("l'assistance (lecture) ne voit ni montants, ni mode, ni référence", () => {
    const vue = masquerMontants(registration, "lecture")
    expect(vue).toEqual({ id: "r1", remarques: "ok" })
    expect("montantDu" in vue).toBe(false)
    expect("modePaiement" in vue).toBe(false)
  })

  it("la contribution et les niveaux supérieurs gardent les montants", () => {
    expect(masquerMontants(registration, "contribution")).toEqual(registration)
    expect(masquerMontants(registration, "gestion")).toEqual(registration)
  })

  it("ne modifie pas l'objet d'origine", () => {
    masquerMontants(registration, "lecture")
    expect(registration.montantDu).toBe(4500)
  })
})
