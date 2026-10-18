// Encaisse une recette prévue de Budget par le vrai service (encaisserRecetteDans), dans un processus tsx.
// Lancé par session.ts avec la charge JSON en argument. Le client de l'app lit DATABASE_URL : env.ts le charge d'abord.
// Budget n'a pas encore de bouton « Encaisser » sur une recette prévue : le test passe donc par le service.
import "./env"

import { prismaPourTeam } from "../../src/lib/prisma"
import { encaisserRecetteDans } from "../../src/apps/budget/services-serveur"

interface Charge {
  teamId: string
  userId: string
  membershipId: string
  libelle: string
}

async function principal(): Promise<void> {
  const charge = JSON.parse(process.argv[2] ?? "{}") as Charge
  const ctx = { teamId: charge.teamId, userId: charge.userId, membership: { id: charge.membershipId, role: "responsable" as const } }
  const client = prismaPourTeam(charge.teamId, charge.userId)
  const recette = await client.budgetIncome.findFirst({
    where: { teamId: charge.teamId, libelle: charge.libelle, statut: "prevue", deletedAt: null },
    select: { id: true },
  })
  if (!recette) throw new Error(`Recette prévue « ${charge.libelle} » introuvable.`)
  const caisse = await client.budgetPayer.findFirst({
    where: { teamId: charge.teamId, type: "caisse_team", actif: true, deletedAt: null },
    select: { id: true },
  })
  if (!caisse) throw new Error("Caisse de la team introuvable.")
  await encaisserRecetteDans(ctx, { recetteId: recette.id, payerId: caisse.id })
}

principal()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error(erreur)
    process.exit(1)
  })
