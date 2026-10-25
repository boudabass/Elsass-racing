import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/equipe/ecran"
import { PageEquipeEcran } from "@/apps/equipe/composants/page-equipe"
import { pageEquipe } from "@/apps/equipe/lectures-ecran"
import { EcranVide } from "@/components/qg/ecran-vide"

// L'équipe (tâche 5.2, brief §1) : les cartes de l'équipe, le filtre par rôle (dans l'URL), les anciens membres repliés.
export default async function PageEquipe({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const { role } = await searchParams
  const donnees = await pageEquipe()
  return <PageEquipeEcran donnees={donnees} role={role ?? null} />
}
