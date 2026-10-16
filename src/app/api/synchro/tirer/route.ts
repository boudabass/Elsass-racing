import { exigerContexte } from "@/core/droits/garde-serveur"
import { memoriserSynchro, tirerPaquets } from "@/core/synchro/tirer"
import { schemaTirer } from "@/core/synchro/protocole"
import { reponseErreurAcces, reponseJson, reponseRequeteInvalide } from "@/core/synchro/reponses"

// Tirage : les lignes de la team modifiées après les curseurs reçus. Session et team exigées ;
// exclue du cache.
export const dynamic = "force-dynamic"

export async function POST(requete: Request) {
  const corps = schemaTirer.safeParse(await requete.json().catch(() => null))
  if (!corps.success) return reponseRequeteInvalide()

  try {
    const { session, contexte } = await exigerContexte()
    const reponse = await tirerPaquets(contexte, corps.data.curseurs)
    await memoriserSynchro(contexte, session.deviceId, reponse.tables)
    return reponseJson(reponse)
  } catch (erreur) {
    return reponseErreurAcces(erreur)
  }
}
