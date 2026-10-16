import { executerPourTeam } from "@/lib/prisma"
import type { ContexteTeam } from "@/core/contexte"

export interface ResultatRecherche {
  app: string
  ficheType: string
  ficheId: string
  titre: string
  texte: string
}

const LONGUEUR_MAX = 100
const RESULTATS_MAX = 50

// Recherche plein texte dans les fiches indexées de la team (core_search_index).
// La requête passe par le contexte de team : le RLS ne renvoie que les fiches de la team.
// Les droits par app sont filtrés par l'appelant.
export async function rechercher(ctx: ContexteTeam, requete: string): Promise<ResultatRecherche[]> {
  const texte = requete.trim().slice(0, LONGUEUR_MAX)
  if (texte.length === 0) return []

  return executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.$queryRaw<ResultatRecherche[]>`
      SELECT app, fiche_type AS "ficheType", fiche_id::text AS "ficheId", titre, texte
      FROM core_search_index
      WHERE vecteur @@ plainto_tsquery('french', ${texte})
      ORDER BY ts_rank(vecteur, plainto_tsquery('french', ${texte})) DESC
      LIMIT ${RESULTATS_MAX}
    `,
  )
}

// Regroupe les résultats par app, pour l'affichage.
export function grouperParApp(resultats: ResultatRecherche[]): Record<string, ResultatRecherche[]> {
  const groupes: Record<string, ResultatRecherche[]> = {}
  for (const resultat of resultats) {
    ;(groupes[resultat.app] ??= []).push(resultat)
  }
  return groupes
}
