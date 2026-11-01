import { describe, expect, it } from "vitest"

import { objetLogo, objetPapier } from "./objets-checklist"

const maintenant = new Date("2026-10-20T12:00:00Z")

describe("objets de Voiture lus par Check-lists (5.7a)", () => {
  it("un papier expiré : alerte, date dans le texte, libellé du type si le papier n'en a pas", () => {
    const objet = objetPapier(
      { id: "p1", vehicleId: "v1", type: "passeport_technique", libelle: null, valableJusquAu: new Date("2026-10-01T00:00:00Z") },
      maintenant,
    )
    expect(objet.libelle).toBe("Passeport technique")
    expect(objet.alerte).toBe(true)
    expect(objet.etat).toBe("Expiré le 1 octobre 2026")
    expect(objet.vehicleId).toBe("v1")
  })

  it("un papier valide sans date de fin : pas d'alerte, libellé saisi conservé", () => {
    const objet = objetPapier({ id: "p2", vehicleId: "v1", type: "passeport_technique", libelle: "  Carte grise  ", valableJusquAu: null }, maintenant)
    expect(objet).toMatchObject({ libelle: "Carte grise", etat: "Sans date de fin", alerte: false })
  })

  it("un logo : l'état suit l'emplacement, sans alerte", () => {
    expect(objetLogo({ id: "e1", nom: "Portière gauche", vehicleId: "v1", statut: "occupe" })).toMatchObject({ etat: "Logo posé", alerte: false })
    expect(objetLogo({ id: "e2", nom: "Pare-brise", vehicleId: "v1", statut: "libre" }).etat).toBe("Logo pas encore posé")
    expect(objetLogo({ id: "e3", nom: "Capot", vehicleId: "v1", statut: "indisponible" }).etat).toBe("Emplacement indisponible")
  })
})
