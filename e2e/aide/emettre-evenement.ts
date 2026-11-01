// Émet un événement du catalogue par le vrai bus de l'app, dans un processus tsx (cf. emettre-action.ts).
// Lancé par session.ts (emettreEvenement) avec une charge JSON : la team, le responsable, le nom et les données.
// Les gestionnaires sont chargés : les apps abonnées (Check-lists, Garage…) réagissent comme en production.
import "./env"

import "../../src/apps/gestionnaires-serveur"
import { emettre } from "../../src/core/evenements/bus-serveur"

interface Charge {
  teamId: string
  userId: string
  membershipId: string
  nom: string
  donnees: Record<string, unknown>
}

async function principal(): Promise<void> {
  const charge = JSON.parse(process.argv[2] ?? "{}") as Charge
  await emettre(
    {
      teamId: charge.teamId,
      userId: charge.userId,
      membership: { id: charge.membershipId, role: "responsable" },
    },
    charge.nom,
    charge.donnees,
  )
}

principal()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error(erreur)
    process.exit(1)
  })
