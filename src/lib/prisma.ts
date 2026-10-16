import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/generated/prisma/client"

// Client Prisma unique du processus.
//
// En développement, Next recharge les modules à chaque édition : sans ce cache
// sur `globalThis`, chaque rechargement ouvrirait un nouveau pool de connexions.
//
// Prisma 7 n'embarque plus de moteur Rust : la connexion passe par l'adapter
// `pg`. La chaîne vient de DATABASE_URL, variable d'environnement de RUNTIME. Elle
// n'est pas nécessaire au build tant qu'aucune page ne lit la base à la
// génération statique. Ne jamais la graver dans l'image : elle contient le mot
// de passe de la base.

const creerClient = () => {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
        // Échouer ici et clairement, plutôt que de laisser l'adapter rendre une
        // erreur de connexion obscure à la première requête.
        throw new Error(
            "DATABASE_URL manquante : le client Prisma ne peut pas se connecter.",
        )
    }
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

const global_ = globalThis as unknown as { prisma?: ReturnType<typeof creerClient> }

export const prisma = global_.prisma ?? creerClient()

if (process.env.NODE_ENV !== "production") global_.prisma = prisma
