import { exigerContexte } from "@/core/droits/garde-serveur"
import { appliquerOperations } from "@/core/synchro/pousser"
import { analyserEnvoi, schemaEnveloppePousser } from "@/core/synchro/protocole"
import { reponseErreurAcces, reponseJson, reponseRequeteInvalide } from "@/core/synchro/reponses"

// Poussée : chaque opération est appliquée dans sa propre transaction, avec les droits du membre,
// et notée pour l'idempotence. Une opération mal formée est refusée seule, les autres passent.
// Seule l'enveloppe invalide donne un 400. Session et team exigées ; exclue du cache.
export const dynamic = "force-dynamic"

export async function POST(requete: Request) {
  const corps = schemaEnveloppePousser.safeParse(await requete.json().catch(() => null))
  if (!corps.success) return reponseRequeteInvalide()

  try {
    const { session, contexte } = await exigerContexte()
    const { valides, refusees } = analyserEnvoi(corps.data.operations)
    const resultats = await appliquerOperations(contexte, session.deviceId, valides)
    return reponseJson({ resultats: [...refusees, ...resultats] })
  } catch (erreur) {
    return reponseErreurAcces(erreur)
  }
}
