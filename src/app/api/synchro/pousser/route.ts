import { exigerContexte } from "@/core/droits/garde-serveur"
import { appliquerOperations } from "@/core/synchro/pousser"
import { schemaPousser } from "@/core/synchro/protocole"
import { reponseErreurAcces, reponseJson, reponseRequeteInvalide } from "@/core/synchro/reponses"

// Poussée : chaque opération est appliquée dans sa propre transaction, avec les droits du membre,
// et notée pour l'idempotence. Session et team exigées ; exclue du cache.
export const dynamic = "force-dynamic"

export async function POST(requete: Request) {
  const corps = schemaPousser.safeParse(await requete.json().catch(() => null))
  if (!corps.success) return reponseRequeteInvalide()

  try {
    const { session, contexte } = await exigerContexte()
    const resultats = await appliquerOperations(contexte, session.deviceId, corps.data.operations)
    return reponseJson({ resultats })
  } catch (erreur) {
    return reponseErreurAcces(erreur)
  }
}
