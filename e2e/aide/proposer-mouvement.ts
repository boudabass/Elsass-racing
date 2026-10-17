// Propose un mouvement à confirmer dans Budget, par le vrai service (proposerMouvementDans). Lancé par
// session.ts dans un processus tsx, avec la charge JSON en argument. Le client de l'app lit DATABASE_URL :
// env.ts le charge d'abord.
import "./env"

import { prismaPourTeam } from "../../src/lib/prisma"
import { proposerMouvementDans } from "../../src/apps/budget/services-serveur"

interface Charge {
  teamId: string
  userId: string
  membershipId: string
  libelle: string
  montant: number
}

async function principal(): Promise<void> {
  const charge = JSON.parse(process.argv[2] ?? "{}") as Charge
  const ctx = { teamId: charge.teamId, userId: charge.userId, membership: { id: charge.membershipId, role: "responsable" as const } }
  const categorie = await prismaPourTeam(charge.teamId, charge.userId).budgetCategory.findFirst({
    where: { teamId: charge.teamId, nom: "Pièces", sens: "depense" },
    select: { id: true },
  })
  if (!categorie) throw new Error("Catégorie « Pièces » introuvable : Budget n'est pas initialisé.")
  await proposerMouvementDans(ctx, {
    appOrigine: "garage",
    evenementOrigine: "garage.piece_achetee",
    sens: "depense",
    montant: charge.montant,
    categoryId: categorie.id,
    libelle: charge.libelle,
  })
}

principal()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error(erreur)
    process.exit(1)
  })
