import { describe, expect, it } from "vitest"

import {
  compteARebours,
  dateReport,
  dureeAutorisee,
  etapeAEnvoyer,
  etapeAlerte,
  etatLien,
  finDuLien,
  groupeEcheance,
  peutCreerLien,
  peutRevoquerLien,
  prioriteEtape,
  titreRenouvellement,
  trierEcheances,
  type DocumentPourDroits,
  type DossierPourDroits,
  type QuiAgit,
} from "./regles"

// Aujourd'hui : mercredi 28 octobre 2026, midi à Paris. Une date « dans n jours » est le jour civil n jours plus tard.
const MAINTENANT = new Date("2026-10-28T11:00:00Z")
const dans = (jours: number) => new Date(Date.UTC(2026, 9, 28 + jours))

describe("étape d'alerte (bornes en jours civils)", () => {
  it("61 jours : aucune étape ; 60 et 31 : J60 ; 30 et 8 : J30 ; 7 et 0 : J7 ; hier : expiré ; sans date : aucune", () => {
    expect(etapeAlerte(dans(61), MAINTENANT)).toBeNull()
    expect(etapeAlerte(dans(60), MAINTENANT)).toBe("J60")
    expect(etapeAlerte(dans(31), MAINTENANT)).toBe("J60")
    expect(etapeAlerte(dans(30), MAINTENANT)).toBe("J30")
    expect(etapeAlerte(dans(8), MAINTENANT)).toBe("J30")
    expect(etapeAlerte(dans(7), MAINTENANT)).toBe("J7")
    expect(etapeAlerte(dans(0), MAINTENANT)).toBe("J7")
    expect(etapeAlerte(dans(-1), MAINTENANT)).toBe("expire")
    expect(etapeAlerte(null, MAINTENANT)).toBeNull()
  })
})

describe("étape à envoyer (une fois par étape)", () => {
  it("une étape déjà envoyée, ou moins grave, n'est pas renvoyée ; une étape plus grave l'est", () => {
    expect(etapeAEnvoyer("J30", "J30")).toBeNull()
    expect(etapeAEnvoyer("J30", "J7")).toBeNull()
    expect(etapeAEnvoyer("J7", "J30")).toBe("J7")
    expect(etapeAEnvoyer("expire", "J7")).toBe("expire")
  })

  it("un document créé à 5 jours de sa fin passe directement à J7, sans J60 ni J30", () => {
    expect(etapeAEnvoyer(etapeAlerte(dans(5), MAINTENANT), null)).toBe("J7")
  })

  it("sans étape courante, rien ; une nouvelle date (dernière étape remise à null) renvoie l'étape", () => {
    expect(etapeAEnvoyer(null, "J7")).toBeNull()
    expect(etapeAEnvoyer("J60", null)).toBe("J60")
  })
})

describe("priorités de l'action Renouveler", () => {
  it("expiré passe avant J7, J7 avant J30 et J60 ; J30 et J60 ont le même rang (la date départage)", () => {
    expect(prioriteEtape("expire")).toBeLessThan(prioriteEtape("J7"))
    expect(prioriteEtape("J7")).toBeLessThan(prioriteEtape("J30"))
    expect(prioriteEtape("J30")).toBe(prioriteEtape("J60"))
  })
})

describe("titre de l'action et compte à rebours", () => {
  it("titre à venir ou passé, date en jour/mois/année", () => {
    expect(titreRenouvellement("Assurance de l'association", dans(15), MAINTENANT)).toBe(
      "Renouveler Assurance de l'association : expire le 12/11/2026",
    )
    expect(titreRenouvellement("Assurance de l'association", dans(-4), MAINTENANT)).toBe(
      "Renouveler Assurance de l'association : expirée depuis le 24/10/2026",
    )
  })

  it("compte à rebours en toutes lettres : expiré depuis n jours, aujourd'hui, dans n jours, puis la date au-delà de 60 jours", () => {
    expect(compteARebours(dans(-3), MAINTENANT)).toBe("Expiré depuis 3 jours")
    expect(compteARebours(dans(-1), MAINTENANT)).toBe("Expiré depuis 1 jour")
    expect(compteARebours(dans(0), MAINTENANT)).toBe("Expire aujourd'hui")
    expect(compteARebours(dans(12), MAINTENANT)).toBe("Expire dans 12 jours")
    expect(compteARebours(dans(1), MAINTENANT)).toBe("Expire dans 1 jour")
    expect(compteARebours(new Date("2027-03-04T00:00:00Z"), MAINTENANT)).toBe("Expire le 4 mars 2027")
  })
})

describe("groupes de l'écran Échéances", () => {
  it("rouge à traiter, orange bientôt, vert à jour ; sans zone, pas de groupe", () => {
    expect(groupeEcheance("rouge")).toBe("a_traiter")
    expect(groupeEcheance("orange")).toBe("bientot")
    expect(groupeEcheance("vert")).toBe("a_jour")
    expect(groupeEcheance(null)).toBeNull()
  })

  it("tri par date de fin, la plus proche d'abord, sans modifier la liste d'origine", () => {
    const liste = [{ due: dans(20), nom: "b" }, { due: dans(3), nom: "a" }, { due: dans(-2), nom: "c" }]
    expect(trierEcheances(liste).map((e) => e.nom)).toEqual(["c", "a", "b"])
    expect(liste.map((e) => e.nom)).toEqual(["b", "a", "c"])
  })
})

describe("report d'une semaine", () => {
  it("aujourd'hui plus sept jours, en jour civil", () => {
    expect(dateReport(MAINTENANT).toISOString().slice(0, 10)).toBe("2026-11-04")
  })
})

describe("liens de partage : durée et état", () => {
  it("durées proposées : 1, 7 ou 30 jours seulement", () => {
    expect(dureeAutorisee(1)).toBe(true)
    expect(dureeAutorisee(7)).toBe(true)
    expect(dureeAutorisee(30)).toBe(true)
    expect(dureeAutorisee(14)).toBe(false)
    expect(dureeAutorisee(0)).toBe(false)
  })

  it("fin du lien : la durée à partir de maintenant", () => {
    expect(finDuLien(MAINTENANT, 7).getTime() - MAINTENANT.getTime()).toBe(7 * 86_400_000)
  })

  it("état : révoqué d'abord, puis expiré, puis document indisponible, sinon actif", () => {
    const valide = { expiresAt: dans(7), revokedAt: null }
    expect(etatLien(valide, true, MAINTENANT)).toBe("actif")
    expect(etatLien(valide, false, MAINTENANT)).toBe("indisponible")
    expect(etatLien({ expiresAt: dans(7), revokedAt: MAINTENANT }, true, MAINTENANT)).toBe("revoque")
    expect(etatLien({ expiresAt: dans(-1), revokedAt: null }, true, MAINTENANT)).toBe("expire")
    expect(etatLien({ expiresAt: dans(-1), revokedAt: MAINTENANT }, false, MAINTENANT)).toBe("revoque")
  })
})

describe("garde de création et de révocation d'un lien", () => {
  const dossier: DossierPourDroits = { ownerPersonId: null, visibility: "team" }
  const document: DocumentPourDroits = { ownerPersonId: "moi", visibility: "team", accesPersonne: null }
  const qui = (niveau: QuiAgit["niveau"]): QuiAgit => ({ personId: "moi", niveau })

  it("l'assistance ne crée jamais de lien, et le dit ; l'écriture et la gestion le peuvent", () => {
    const refus = peutCreerLien(document, dossier, qui("contribution"), true)
    expect(refus.permis).toBe(false)
    if (!refus.permis) expect(refus.raison).toContain("ne peut pas partager")
    expect(peutCreerLien(document, dossier, qui("ecriture"), true).permis).toBe(true)
    expect(peutCreerLien(document, dossier, qui("gestion"), true).permis).toBe(true)
  })

  it("un document archivé ne se partage pas, même au niveau gestion, et le dit", () => {
    const decision = peutCreerLien(document, dossier, qui("gestion"), false)
    expect(decision.permis).toBe(false)
    if (!decision.permis) expect(decision.raison).toContain("archivé")
  })

  it("un document qu'on ne voit pas ne se partage pas", () => {
    const cache: DocumentPourDroits = { ownerPersonId: null, visibility: "prive", accesPersonne: null }
    expect(peutCreerLien(cache, dossier, qui("ecriture"), true).permis).toBe(false)
  })

  it("révoquer : l'auteur au niveau écriture, ou le niveau gestion ; un autre membre au niveau écriture est refusé", () => {
    expect(peutRevoquerLien("compte-a", "compte-a", "ecriture").permis).toBe(true)
    expect(peutRevoquerLien("compte-a", "compte-a", "gestion").permis).toBe(true)
    expect(peutRevoquerLien("compte-a", "compte-b", "ecriture").permis).toBe(false)
    expect(peutRevoquerLien("compte-a", "compte-b", "gestion").permis).toBe(true)
    const refus = peutRevoquerLien("compte-a", "compte-b", "ecriture")
    if (!refus.permis) expect(refus.raison).toContain("auteur")
  })
})
