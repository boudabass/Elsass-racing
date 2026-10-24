import { describe, expect, it, vi } from "vitest"

// Le client Prisma se crée à l'import sans se connecter : une URL factice suffit, aucune requête n'est faite.
vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgresql://invalide@127.0.0.1:1/invalide"
})

// Importer seulement le traitement : c'est le point d'entrée de toute émission (bus-serveur.ts, routes).
import "./traitement-serveur"
import { EVENEMENTS } from "./catalogue"
import { trouverGestionnaire } from "./gestionnaires"

// Chaque couple (app, événement) codé par une app ou par le socle. Un couple absent de cette liste
// n'a pas de gestionnaire : l'ajouter ici oblige à l'enregistrer dans src/apps/gestionnaires-serveur.ts.
const COUPLES_CODES: Array<[string, string]> = [
  ["saison", "core.action_decidee"],
  ["saison", "equipe.licence_expire_bientot"],
  ["saison", "equipe.homologation_expire_bientot"],
  ["saison", "voiture.papier_expire_bientot"],
  ["budget", "core.action_decidee"],
  ["core", "saison.action_requise"],
  ["core", "saison.action_levee"],
  ["core", "budget.action_requise"],
]

describe("gestionnaires d'événements : enregistrement en un seul point", () => {
  it.each(COUPLES_CODES)("%s reçoit %s", (app, nom) => {
    expect(trouverGestionnaire(app, nom)).toBeDefined()
  })

  it("chaque couple codé est écouté par son app dans le catalogue (ou relève d'un motif générique)", () => {
    for (const [app, nom] of COUPLES_CODES) {
      if (nom === "core.action_decidee") continue // destinataire fixé à l'émission, pas dans le catalogue
      const evenement = EVENEMENTS.find((e) => e.nom === nom)
      if (evenement) {
        expect(evenement.ecoutePar, `${nom} → ${app}`).toContain(app)
      }
    }
  })

  it("un événement hors liste n'a pas de gestionnaire", () => {
    expect(trouverGestionnaire("budget", "saison.action_requise")).toBeUndefined()
  })
})
