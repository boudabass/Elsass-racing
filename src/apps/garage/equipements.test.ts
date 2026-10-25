import { describe, expect, it } from "vitest"

import {
  alerteEcheance,
  dateCivileValide,
  echeanceControle,
  formaterValeur,
  groupesParCategorie,
  libelleEcheance,
  resumeEquipements,
  validerSaisieEquipement,
  valeurEnCentimes,
  type SaisieBrute,
} from "./equipements"

const AUJOURDHUI = "2026-10-24"

describe("échéance du contrôle", () => {
  it("sans date : aucun contrôle prévu", () => {
    expect(echeanceControle(null, AUJOURDHUI)).toEqual({ etat: "aucun" })
    expect(libelleEcheance(echeanceControle(null, AUJOURDHUI))).toBe("Aucun contrôle prévu")
  })

  it("date passée : dépassé, avec le nombre de jours", () => {
    const echeance = echeanceControle("2026-10-21", AUJOURDHUI)
    expect(echeance).toEqual({ etat: "depasse", jours: 3 })
    expect(libelleEcheance(echeance)).toBe("Contrôle dépassé depuis 3 jours")
    expect(alerteEcheance(echeance)).toBe("depasse")
  })

  it("moins de 30 jours : bientôt, aujourd'hui compris", () => {
    expect(echeanceControle("2026-11-05", AUJOURDHUI)).toEqual({ etat: "bientot", jours: 12 })
    expect(libelleEcheance(echeanceControle("2026-11-05", AUJOURDHUI))).toBe("Contrôle dans 12 jours")
    expect(libelleEcheance(echeanceControle("2026-10-24", AUJOURDHUI))).toBe("Contrôle aujourd'hui")
    expect(alerteEcheance(echeanceControle("2026-10-24", AUJOURDHUI))).toBe("bientot")
  })

  it("trente jours ou plus : plus tard, sans alerte", () => {
    const echeance = echeanceControle("2026-11-23", AUJOURDHUI)
    expect(echeance).toEqual({ etat: "plus_tard", jours: 30 })
    expect(libelleEcheance(echeance)).toBe("Contrôle dans 30 jours")
    expect(alerteEcheance(echeance)).toBeNull()
  })

  it("frontière : vingt-neuf jours restent bientôt, trente jours passent à plus tard", () => {
    expect(echeanceControle("2026-11-22", AUJOURDHUI)).toEqual({ etat: "bientot", jours: 29 })
    expect(echeanceControle("2026-11-23", AUJOURDHUI)).toEqual({ etat: "plus_tard", jours: 30 })
  })

  it("un jour de retard se dit au singulier", () => {
    expect(libelleEcheance(echeanceControle("2026-10-23", AUJOURDHUI))).toBe("Contrôle dépassé depuis 1 jour")
  })

  it("le changement d'heure du 25/10 ne décale pas le compte des jours", () => {
    expect(echeanceControle("2026-10-26", "2026-10-24")).toEqual({ etat: "bientot", jours: 2 })
    expect(echeanceControle("2026-10-25", "2026-10-24")).toEqual({ etat: "bientot", jours: 1 })
    expect(echeanceControle("2026-10-24", "2026-10-25")).toEqual({ etat: "depasse", jours: 1 })
  })
})

describe("date civile", () => {
  it("accepte une date du calendrier et refuse les autres", () => {
    expect(dateCivileValide("2026-10-25")).toBe("2026-10-25")
    expect(dateCivileValide("2026-02-30")).toBeNull()
    expect(dateCivileValide("25/10/2026")).toBeNull()
    expect(dateCivileValide("2026-13-01")).toBeNull()
  })
})

describe("valeur saisie en euros", () => {
  it("convertit en centimes, avec virgule, point ou espaces de milliers", () => {
    expect(valeurEnCentimes("12,50")).toEqual({ valeurCents: 1250 })
    expect(valeurEnCentimes("12.5")).toEqual({ valeurCents: 1250 })
    expect(valeurEnCentimes("1 200,50")).toEqual({ valeurCents: 120050 })
    expect(valeurEnCentimes("0")).toEqual({ valeurCents: 0 })
  })

  it("vide devient null", () => {
    expect(valeurEnCentimes(null)).toEqual({ valeurCents: null })
    expect(valeurEnCentimes("  ")).toEqual({ valeurCents: null })
  })

  it("refuse une valeur négative ou illisible, avec sa raison", () => {
    expect(valeurEnCentimes("-5")).toHaveProperty("erreur")
    expect(valeurEnCentimes("abc")).toHaveProperty("erreur")
    expect(valeurEnCentimes("12,345")).toHaveProperty("erreur")
  })
})

describe("validation de la saisie", () => {
  const complete: SaisieBrute = {
    nom: "Remorque",
    categorie: "remorque",
    etat: "bon",
    acheteLe: "2024-03-01",
    valeur: "2 500",
    prochainControleLe: "2026-10-20",
    emplacement: "Parc",
  }

  it("accepte une saisie complète et la rend propre", () => {
    const resultat = validerSaisieEquipement(complete)
    expect(resultat).toEqual({
      saisie: {
        nom: "Remorque",
        categorie: "remorque",
        etat: "bon",
        acheteLe: "2024-03-01",
        valeurCents: 250000,
        prochainControleLe: "2026-10-20",
        emplacement: "Parc",
      },
    })
  })

  it("n'exige que le nom et la catégorie : le reste est facultatif", () => {
    const resultat = validerSaisieEquipement({ nom: "  Compresseur ", categorie: "outillage", etat: "", acheteLe: "", valeur: "", prochainControleLe: "", emplacement: null })
    expect(resultat).toEqual({
      saisie: { nom: "Compresseur", categorie: "outillage", etat: null, acheteLe: null, valeurCents: null, prochainControleLe: null, emplacement: null },
    })
  })

  it("refuse un nom vide, avec sa raison", () => {
    expect(validerSaisieEquipement({ ...complete, nom: "   " })).toEqual({ erreur: "Indique le nom de l'équipement." })
  })

  it("refuse une catégorie inconnue, avec sa raison", () => {
    expect(validerSaisieEquipement({ ...complete, categorie: "bateau" })).toEqual({ erreur: "Choisis la catégorie de l'équipement." })
  })

  it("refuse une valeur négative, avec sa raison", () => {
    expect(validerSaisieEquipement({ ...complete, valeur: "-10" })).toHaveProperty("erreur")
  })

  it("refuse une date qui n'existe pas au calendrier", () => {
    expect(validerSaisieEquipement({ ...complete, prochainControleLe: "2026-02-30" })).toEqual({
      erreur: "La date du prochain contrôle n'est pas une date valide.",
    })
  })
})

describe("résumé de l'écran", () => {
  it("compte les contrôles dépassés et proches, et somme la valeur", () => {
    const resume = resumeEquipements(
      [
        { valeurCents: 250000, prochainControleLe: "2026-10-21" },
        { valeurCents: 35000, prochainControleLe: null },
        { valeurCents: null, prochainControleLe: "2026-11-05" },
        { valeurCents: 10000, prochainControleLe: "2027-06-01" },
      ],
      AUJOURDHUI,
    )
    expect(resume).toEqual({ nombre: 4, depasses: 1, bientot: 1, valeurTotaleCents: 295000 })
  })

  it("une liste vide donne zéro partout", () => {
    expect(resumeEquipements([], AUJOURDHUI)).toEqual({ nombre: 0, depasses: 0, bientot: 0, valeurTotaleCents: 0 })
  })

  it("formate la valeur en euros avec espaces de milliers", () => {
    expect(formaterValeur(120050)).toBe("1 200,50 €")
    expect(formaterValeur(0)).toBe("0,00 €")
  })
})

describe("regroupement par catégorie", () => {
  it("suit l'ordre de référence, sans catégorie vide, nom par nom", () => {
    const groupes = groupesParCategorie([
      { categorie: "stand", nom: "Tente" },
      { categorie: "remorque", nom: "Remorque" },
      { categorie: "outillage", nom: "Visseuse" },
      { categorie: "outillage", nom: "Compresseur" },
    ])
    expect(groupes.map((groupe) => groupe.categorie)).toEqual(["remorque", "outillage", "stand"])
    expect(groupes[1].equipements.map((equipement) => equipement.nom)).toEqual(["Compresseur", "Visseuse"])
  })
})
