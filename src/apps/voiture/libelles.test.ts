import { describe, expect, it } from "vitest"

import { COULEUR_ETAT_PAPIERS, LIBELLE_ETAT_PAPIERS, LIBELLE_STATUT_EMPLACEMENT, LIBELLE_TYPE_PAPIER, LIBELLE_TYPE_VEHICULE, groupeEtClasse, libelleDuPapier } from "./libelles"

describe("libellés de Voiture", () => {
  it("chaque type de véhicule a son libellé français", () => {
    expect(Object.values(LIBELLE_TYPE_VEHICULE)).toEqual(["Course", "Reco", "Assistance", "Remorque"])
  })

  it("chaque état des papiers se lit en toutes lettres, pas seulement en couleur", () => {
    expect(LIBELLE_ETAT_PAPIERS).toEqual({
      valide: "Papiers à jour",
      a_renouveler: "Papier à renouveler",
      expire: "Papier expiré",
      aucun: "Aucun papier",
    })
    for (const libelle of Object.values(LIBELLE_ETAT_PAPIERS)) expect(libelle.length).toBeGreaterThan(0)
    expect(Object.keys(COULEUR_ETAT_PAPIERS).sort()).toEqual(Object.keys(LIBELLE_ETAT_PAPIERS).sort())
  })

  it("les statuts d'emplacement correspondent aux quatre états de la spécification", () => {
    expect(LIBELLE_STATUT_EMPLACEMENT).toEqual({ libre: "Libre", reserve: "Réservé", occupe: "Occupé", indisponible: "Indisponible" })
  })

  it("le libellé d'un papier « Autre » est celui qui a été saisi", () => {
    expect(libelleDuPapier("autre", "Attestation d'assurance club")).toBe("Attestation d'assurance club")
    expect(libelleDuPapier("assurance", null)).toBe(LIBELLE_TYPE_PAPIER.assurance)
  })

  it("groupe et classe : « N2 · classe 11 », ou ce qui est renseigné, ou rien", () => {
    expect(groupeEtClasse("N2", "11")).toBe("N2 · classe 11")
    expect(groupeEtClasse("N2", null)).toBe("N2")
    expect(groupeEtClasse(null, "11")).toBe("classe 11")
    expect(groupeEtClasse(null, null)).toBeNull()
  })
})
