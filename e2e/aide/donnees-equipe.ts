// Données d'une team de test pour les captures : les données réelles de Koehling Racing, une
// alerte orange sur Garage, et une action en attente de priorité 3. Lancé par session.ts dans
// un processus tsx, avec la charge JSON en argument.
import "./env"

import { randomUUID } from "node:crypto"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../../src/generated/prisma/client"
import { emettre } from "../../src/core/evenements/bus-serveur"
import { appliquerDonneesKoehling } from "../../scripts/lib/donnees-koehling"

interface Charge {
  teamId: string
  userId: string
  membershipId: string
  horodatage: string
}

async function principal(): Promise<void> {
  const charge = JSON.parse(process.argv[2] ?? "{}") as Charge
  const connectionString = process.env.DATABASE_URL_MIGRATION
  if (!connectionString) throw new Error("DATABASE_URL_MIGRATION absente.")

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  try {
    await appliquerDonneesKoehling(prisma, charge.teamId)
    await prisma.coreAlert.create({
      data: {
        id: randomUUID(),
        teamId: charge.teamId,
        app: "garage",
        titre: "Contrôle des freins à faire",
        niveau: "orange",
        statut: "ouverte",
      },
    })
  } finally {
    await prisma.$disconnect()
  }

  await emettre(
    {
      teamId: charge.teamId,
      userId: charge.userId,
      membership: { id: charge.membershipId, role: "responsable" },
    },
    "saison.action_requise",
    {
      type: "saison.resultat_a_valider",
      cleUnicite: `gaschney-${charge.horodatage}`,
      titre: "Valider le résultat du Gaschney",
      contexte: "L'épreuve du 10 octobre est terminée.",
      destinataires: { roles: ["responsable"] },
      boutons: [
        { cle: "valider", libelle: "Valider" },
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
