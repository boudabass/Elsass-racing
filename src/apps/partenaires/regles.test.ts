import { describe, expect, it } from "vitest"

import {
  CHAMPS_CONNUS,
  enRetard,
  formaterMontant,
  jourParis,
  montantEnLettres,
  relanceDue,
  remplirModele,
  statutAutomatique,
  statutContrepartie,
  transitionConvention,
} from "./regles"
import { MODELE_DEFAUT_V1 } from "./modele-defaut"

describe("transitionConvention", () => {
  it("envoie un brouillon, puis le signe", () => {
    expect(transitionConvention("brouillon", "envoyer")).toEqual({ ok: true, statut: "envoyee" })
    expect(transitionConvention("envoyee", "signer")).toEqual({ ok: true, statut: "signee" })
  })

  it("refuse de signer un brouillon, et dit où il en est", () => {
    const refus = transitionConvention("brouillon", "signer")
    expect(refus).toEqual({
      ok: false,
      message: "Seule une convention envoyée peut être signée. Celle-ci est au brouillon.",
    })
  })

  it("refuse d'envoyer deux fois", () => {
    expect(transitionConvention("envoyee", "envoyer").ok).toBe(false)
  })

  it("résilie une convention signée ou en cours, mais pas une convention terminée", () => {
    expect(transitionConvention("signee", "resilier")).toEqual({ ok: true, statut: "resiliee" })
    expect(transitionConvention("en_cours", "resilier")).toEqual({ ok: true, statut: "resiliee" })
    const refus = transitionConvention("terminee", "resilier")
    expect(refus.ok).toBe(false)
    if (!refus.ok) expect(refus.message).toContain("Celle-ci est terminée.")
  })
})

describe("statutAutomatique", () => {
  const signee = { statut: "signee" as const, dateDebut: "2026-11-01", dateFin: "2027-10-31" }

  it("garde une convention signée avant le jour de début", () => {
    expect(statutAutomatique(signee, "2026-10-31")).toBe("signee")
  })

  it("passe en cours le jour de date_debut", () => {
    expect(statutAutomatique(signee, "2026-11-01")).toBe("en_cours")
  })

  it("garde une convention en cours le dernier jour, puis la termine le lendemain de date_fin", () => {
    const enCours = { ...signee, statut: "en_cours" as const }
    expect(statutAutomatique(enCours, "2027-10-31")).toBe("en_cours")
    expect(statutAutomatique(enCours, "2027-11-01")).toBe("terminee")
  })

  it("enchaîne les deux passages si le recalcul arrive après les deux dates", () => {
    expect(statutAutomatique({ statut: "signee", dateDebut: "2026-01-01", dateFin: "2026-06-30" }, "2026-10-18")).toBe("terminee")
  })

  it("ne touche ni un brouillon, ni une convention résiliée", () => {
    expect(statutAutomatique({ ...signee, statut: "brouillon" }, "2026-11-15")).toBe("brouillon")
    expect(statutAutomatique({ ...signee, statut: "resiliee" }, "2026-11-15")).toBe("resiliee")
  })

  it("compte les jours de Paris, pas ceux de UTC", () => {
    expect(jourParis(new Date("2026-10-17T23:30:00Z"))).toBe("2026-10-18")
    expect(jourParis(new Date("2026-10-18T10:00:00Z"))).toBe("2026-10-18")
  })
})

describe("montantEnLettres", () => {
  const cas: Array<[number, string]> = [
    [0, "zéro euro"],
    [100, "un euro"],
    [2100, "vingt et un euros"],
    [7100, "soixante et onze euros"],
    [8000, "quatre-vingts euros"],
    [8100, "quatre-vingt-un euros"],
    [9900, "quatre-vingt-dix-neuf euros"],
    [10000, "cent euros"],
    [20000, "deux cents euros"],
    [100000, "mille euros"],
    [150050, "mille cinq cents euros et cinquante centimes"],
    [200000000, "deux millions d'euros"],
  ]

  it.each(cas)("écrit %i centimes en lettres", (centimes, attendu) => {
    expect(montantEnLettres(centimes)).toBe(attendu)
  })

  it("écrit un centime au singulier", () => {
    expect(montantEnLettres(1)).toBe("un centime")
  })

  it("refuse un montant négatif ou non entier", () => {
    expect(() => montantEnLettres(-1)).toThrow()
    expect(() => montantEnLettres(1.5)).toThrow()
  })
})

describe("formaterMontant", () => {
  it("écrit l'apport en chiffres puis en lettres", () => {
    expect(formaterMontant(150000)).toBe("1 500,00 € (mille cinq cents euros)")
    expect(formaterMontant(150050)).toBe("1 500,50 € (mille cinq cents euros et cinquante centimes)")
  })

  it("écrit « aucun » pour un apport nul", () => {
    expect(formaterMontant(0)).toBe("aucun")
  })
})

describe("remplirModele", () => {
  it("remplace un champ connu", () => {
    expect(remplirModele("Équipe : {{team.nom}}", { "team.nom": "Koehling Racing Team" })).toEqual({
      texte: "Équipe : Koehling Racing Team",
      inconnus: [],
      vides: [],
    })
  })

  it("remplace un champ connu mais vide par une ligne à compléter", () => {
    expect(remplirModele("Lieu : {{lieu}}.", { lieu: "" }).texte).toBe("Lieu : ________.")
    expect(remplirModele("Lieu : {{lieu}}.", {}).texte).toBe("Lieu : ________.")
  })

  it("signale les champs connus restés vides, sauf ceux qu'on remplit à la main", () => {
    const resultat = remplirModele("{{team.rna}} {{partenaire.adresse}} {{lieu}} {{date}}", { "team.rna": "", "partenaire.adresse": "1 rue X" })
    expect(resultat.vides).toEqual(["team.rna"])
  })

  it("laisse un champ inconnu visible et le signale", () => {
    const resultat = remplirModele("Bonjour {{partenaire.inventé}} et {{partenaire.inventé}}", {})
    expect(resultat.texte).toBe("Bonjour {{partenaire.inventé}} et {{partenaire.inventé}}")
    expect(resultat.inconnus).toEqual(["partenaire.inventé"])
  })

  it("retire la mention du numéro quand le RNA est vide", () => {
    const texte = "Association, inscrite sous le numéro {{team.rna}}, dont le siège est {{team.adresse}}."
    expect(remplirModele(texte, { "team.rna": null, "team.adresse": "Haguenau" }).texte).toBe(
      "Association, dont le siège est Haguenau.",
    )
  })

  it("garde la mention du numéro quand il est renseigné", () => {
    const texte = "Association, inscrite sous le numéro {{team.rna}}, dont le siège est {{team.adresse}}."
    expect(remplirModele(texte, { "team.rna": "W671000001", "team.adresse": "Haguenau" }).texte).toBe(
      "Association, inscrite sous le numéro W671000001, dont le siège est Haguenau.",
    )
  })

  it("écrit chaque contrepartie sur sa ligne, avec l'emplacement, les épreuves et l'échéance", () => {
    const texte = remplirModele("{{contreparties}}", {
      contreparties: [
        {
          libelle: "Logo sur la voiture",
          quantite: 2,
          unite: "épreuves",
          emplacement: "Portière droite",
          epreuves: ["Rallye du Nord", "Gaschney"],
          echeance: "2027-06-30",
        },
        { libelle: "Publication sur les réseaux", quantite: 1, unite: "publication" },
      ],
    }).texte
    expect(texte).toBe(
      "- Logo sur la voiture : 2 épreuves ; emplacement Portière droite ; épreuves Rallye du Nord, Gaschney ; échéance 30/06/2027\n" +
        "- Publication sur les réseaux : 1 publication",
    )
  })

  it("écrit « ________ » pour une liste de contreparties vide", () => {
    expect(remplirModele("{{contreparties}}", { contreparties: [] }).texte).toBe("________")
  })
})

describe("modèle de convention par défaut (version 1)", () => {
  const valeurs = {
    "team.nom": "Koehling Racing Team",
    "team.forme_juridique": "association de droit local d'Alsace-Moselle",
    "team.rna": "W671000001",
    "team.adresse": "Haguenau",
    "team.representant": "Jo Koehling, président",
    "partenaire.entreprise": "The Elsassisch",
    "partenaire.adresse": "Mundolsheim",
    "partenaire.representant": "John, gérant",
    "convention.apport_financier": formaterMontant(150000),
    "convention.apport_nature": "aucun",
    "convention.echeancier": "15/01/2027 : 1 500,00 € (mille cinq cents euros)",
    "convention.date_debut": "01/11/2026",
    "convention.date_fin": "31/10/2027",
    "convention.saison": "2027",
    contreparties: [{ libelle: "Logo sur la voiture", quantite: 1, unite: "saison", emplacement: "Portière" }],
    lieu: "Haguenau",
    date: "18/10/2026",
  }

  it("ne laisse aucune accolade quand toutes les valeurs sont fournies", () => {
    const { texte, inconnus } = remplirModele(MODELE_DEFAUT_V1.texte, valeurs)
    expect(inconnus).toEqual([])
    expect(texte).not.toMatch(/[{}]/)
    expect(texte).toContain("inscrite sous le numéro W671000001, ")
  })

  it("retire la mention du numéro quand l'association n'en a pas", () => {
    const { texte } = remplirModele(MODELE_DEFAUT_V1.texte, { ...valeurs, "team.rna": "" })
    expect(texte).not.toContain("inscrite sous le numéro")
    expect(texte).not.toMatch(/[{}]/)
    expect(texte).toContain("Koehling Racing Team, association de droit local d'Alsace-Moselle, dont le siège est situé Haguenau")
  })

  it("connaît tous les champs qu'il utilise", () => {
    const champsDuTexte = Array.from(MODELE_DEFAUT_V1.texte.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g), ([, cle]) => cle)
    for (const cle of champsDuTexte) expect(CHAMPS_CONNUS).toContain(cle)
  })
})

describe("statutContrepartie", () => {
  const base = { quantitePromise: 2, quantiteTenue: 0, echeance: null }

  it("passe à tenue dès que la quantité promise est atteinte", () => {
    expect(statutContrepartie({ ...base, statut: "en_cours", quantiteTenue: 2 })).toBe("tenue")
  })

  it("revient en cours si la quantité redescend", () => {
    expect(statutContrepartie({ ...base, statut: "tenue", quantiteTenue: 1 })).toBe("en_cours")
  })

  it("garde une contrepartie reportée tant que la quantité n'est pas atteinte", () => {
    expect(statutContrepartie({ ...base, statut: "reportee", quantiteTenue: 1 })).toBe("reportee")
  })

  it("passe une contrepartie reportée à tenue quand la quantité est atteinte", () => {
    expect(statutContrepartie({ ...base, statut: "reportee", quantiteTenue: 2 })).toBe("tenue")
  })
})

describe("enRetard", () => {
  const base = { quantitePromise: 1, quantiteTenue: 0, echeance: "2026-10-17" }

  it("signale une échéance passée non tenue", () => {
    expect(enRetard({ ...base, statut: "a_faire" }, "2026-10-18")).toBe(true)
  })

  it("ne signale pas le jour même de l'échéance", () => {
    expect(enRetard({ ...base, statut: "a_faire", echeance: "2026-10-18" }, "2026-10-18")).toBe(false)
  })

  it("ne signale ni une contrepartie tenue, ni une contrepartie reportée, ni une contrepartie sans échéance", () => {
    expect(enRetard({ ...base, statut: "tenue" }, "2026-10-18")).toBe(false)
    expect(enRetard({ ...base, statut: "reportee" }, "2026-10-18")).toBe(false)
    expect(enRetard({ ...base, statut: "a_faire", echeance: null }, "2026-10-18")).toBe(false)
  })
})

describe("relanceDue", () => {
  it("est due le jour prévu et après", () => {
    expect(relanceDue({ statut: "contacte", prochaineRelance: "2026-10-18" }, "2026-10-18")).toBe(true)
    expect(relanceDue({ statut: "contacte", prochaineRelance: "2026-10-17" }, "2026-10-18")).toBe(true)
  })

  it("n'est pas due avant la date", () => {
    expect(relanceDue({ statut: "contacte", prochaineRelance: "2026-10-19" }, "2026-10-18")).toBe(false)
  })

  it("ne concerne ni un partenaire, ni un ancien partenaire, ni un refus", () => {
    for (const statut of ["partenaire", "ancien_partenaire", "refus"] as const) {
      expect(relanceDue({ statut, prochaineRelance: "2026-10-01" }, "2026-10-18")).toBe(false)
    }
  })

  it("n'est pas due sans date de relance", () => {
    expect(relanceDue({ statut: "a_contacter", prochaineRelance: null }, "2026-10-18")).toBe(false)
  })
})
