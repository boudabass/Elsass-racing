import { describe, expect, it } from "vitest"

import { chargeActionRequise } from "./charges"

const BASE = {
  cleUnicite: "tache_probleme:33333333-3333-4333-8333-333333333333",
  titre: "Contrôle du moteur",
  contexte: "Avant départ",
  destinataires: { roles: ["responsable"] },
  boutons: [{ cle: "ouvrir", libelle: "Ouvrir la liste", lien: "/apps/checklist/liste/11111111-1111-4111-8111-111111111111" }],
  priorite: 7,
  niveauRequis: "contribution",
}

describe("charge de checklist.action_requise (5.8, §3.3)", () => {
  // Chaque type que Check-lists émet doit passer la charge : un type absent ici fait échouer l'émission entière.
  it.each([
    "creer_listes",
    "reassigner_points",
    "point_critique",
    "tache_probleme",
    "ajouter_point",
    "cocher_point",
    "creer_liste_retour",
    "relire_liste",
  ])("accepte le type %s", (type) => {
    expect(chargeActionRequise.safeParse({ ...BASE, type }).success).toBe(true)
  })

  // La personne affectée d'un problème : son adhésion s'ajoute aux responsables (points-critiques-serveur.ts).
  it("accepte les destinataires avec des adhésions en plus des responsables", () => {
    const charge = { ...BASE, type: "tache_probleme", destinataires: { roles: ["responsable"], memberships: ["55555555-5555-4555-8555-555555555555"] } }
    expect(chargeActionRequise.safeParse(charge).success).toBe(true)
  })

  it("refuse un type qui n'est pas dans le catalogue", () => {
    expect(chargeActionRequise.safeParse({ ...BASE, type: "type_inconnu" }).success).toBe(false)
  })
})
