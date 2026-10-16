// Santé de l'application : la base répond, le rôle de l'app a ses droits, le catalogue est là.
// La décision est une fonction pure ; la vérification lit la base avec le client applicatif.
// La réponse ne donne qu'une raison courte. Le détail des erreurs part dans les logs serveur.

import { APPS } from "@/core/catalogue"
import { prisma } from "@/lib/prisma"

import { decider, type EtapesSante, type ResultatSante } from "./sante-decision"

// Trois étapes, dans l'ordre : un SELECT 1 ; les privilèges du rôle courant sur core_user (lecture)
// et core_team (écriture), qui couvrent le cas de la 1.12 ; le nombre d'apps du catalogue.
export async function verifierSante(): Promise<ResultatSante> {
  const etapes: EtapesSante = { base: false, droits: false, catalogue: false }
  try {
    await prisma.$queryRaw`SELECT 1`
    etapes.base = true

    const [privileges] = await prisma.$queryRaw<Array<{ lecture: boolean; ecriture: boolean }>>`
      SELECT has_table_privilege(current_user, 'core_user', 'SELECT') AS lecture,
             has_table_privilege(current_user, 'core_team', 'INSERT') AS ecriture`
    etapes.droits = privileges.lecture && privileges.ecriture

    if (etapes.droits) {
      const [{ nombre }] = await prisma.$queryRaw<Array<{ nombre: number }>>`SELECT count(*)::int AS nombre FROM core_app`
      etapes.catalogue = nombre === APPS.length
    }
  } catch (erreur) {
    console.error("[santé] erreur pendant la vérification :", erreur)
  }

  const resultat = decider(etapes)
  if (!resultat.ok) console.error(`[santé] ${resultat.raison} (étapes : ${JSON.stringify(etapes)})`)
  return resultat
}
