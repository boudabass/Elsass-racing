// Émet saison.action_requise par le bus de l'app. Lancé par session.ts dans un processus tsx,
// avec la charge JSON en argument. Le client de l'app lit DATABASE_URL : env.ts le charge d'abord.
import "./env"

import { emettre } from "../../src/core/evenements/bus-serveur"

interface Charge {
  teamId: string
  userId: string
  membershipId: string
  cleUnicite: string
}

async function principal(): Promise<void> {
  const charge = JSON.parse(process.argv[2] ?? "{}") as Charge
  await emettre(
    {
      teamId: charge.teamId,
      userId: charge.userId,
      membership: { id: charge.membershipId, role: "responsable" },
    },
    "saison.action_requise",
    {
      type: "saison.confirmation_test",
      cleUnicite: charge.cleUnicite,
      titre: "Confirmer le calendrier de la saison (test)",
      contexte: "Action créée par le test de bout en bout.",
      destinataires: { roles: ["responsable"] },
      boutons: [
        { cle: "confirmer", libelle: "Confirmer" },
        { cle: "refuser", libelle: "Refuser" },
      ],
      priorite: 3,
    },
  )
}

principal()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error(erreur)
    process.exit(1)
  })
