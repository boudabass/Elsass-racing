import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/generated/prisma/client"

// Client Prisma unique du processus, sur DATABASE_URL (rôle applicatif, soumis au RLS).
//
// Le client nu ne sert qu'à l'authentification (core_user, core_auth_token, core_device),
// qui n'a pas de team_id. Pour toute donnée de team, passer par prismaPourTeam ;
// pour la liste des teams d'un compte, par prismaPourCompte.
//
// En développement, Next recharge les modules à chaque édition : sans ce cache sur
// `globalThis`, chaque rechargement ouvrirait un nouveau pool de connexions.
//
// DATABASE_URL est une variable d'environnement de RUNTIME. Elle n'est pas nécessaire
// au build tant qu'aucune page ne lit la base à la génération statique.

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

// Motif documenté pour le RLS avec Prisma : chaque opération s'exécute dans une
// transaction qui fixe d'abord le contexte (set_config, portée transaction), puis
// lance la requête. Le contexte ne survit donc pas à la transaction, et ne fuit pas
// d'une requête à l'autre dans le pool de connexions.
function clientAvecContexte(reglages: Array<{ nom: string; valeur: string }>) {
    return prisma.$extends({
        query: {
            $allModels: {
                async $allOperations({ args, query }) {
                    const contexte = reglages.map(
                        ({ nom, valeur }) =>
                            prisma.$executeRaw`SELECT set_config(${nom}, ${valeur}, true)`,
                    )
                    const resultats = await prisma.$transaction([...contexte, query(args)])
                    return resultats[resultats.length - 1]
                },
            },
        },
    })
}

// Opérations sur les données d'une team : le RLS ne laisse voir et modifier que cette team.
export function prismaPourTeam(teamId: string, userId: string) {
    return clientAvecContexte([
        { nom: "app.team_id", valeur: teamId },
        { nom: "app.user_id", valeur: userId },
    ])
}

// Opérations sur le compte seul (liste de ses teams, choix d'une team) : pas de team fixée.
export function prismaPourCompte(userId: string) {
    return clientAvecContexte([{ nom: "app.user_id", valeur: userId }])
}

// Requêtes brutes ($queryRaw, $executeRaw) dans le contexte de team : l'extension des
// modèles ne les couvre pas. Toute la fonction s'exécute dans une seule transaction.
export async function executerPourTeam<T>(
    teamId: string,
    userId: string,
    requete: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.team_id', ${teamId}, true)`
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`
        return requete(tx)
    })
}

// Contexte public (brief 3.7, point 2) : la page partenaire, sans compte. Seul app.team_id est posé, pas app.user_id :
// les politiques « membre de la team » ne laissent passer aucune ligne qui dépende d'un utilisateur. Le contexte
// tient dans la transaction, il ne fuit pas vers la requête suivante. Chaque lecture filtre elle-même par partenaire.
export async function avecContextePublic<T>(
    teamId: string,
    requete: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.team_id', ${teamId}, true)`
        return requete(tx)
    })
}
