import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { RubriqueEquipe } from "@/apps/settings/composants/rubriques"
import { Affichage, Appareils, Compte, Donnees, Notifications } from "@/apps/settings/composants/personnelles"
import { estRubriqueEquipe, RUBRIQUES_PERSONNELLES } from "@/apps/settings/rubriques"
import { aAuMoins } from "@/core/droits/niveaux"
import { niveauDe } from "@/core/actions/actions-serveur"
import { contexteQg, redirigerSiSansContexte } from "@/core/qg/donnees"
import { lireSession } from "@/core/auth/session-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Une rubrique de Réglages. Les rubriques de la team demandent le niveau lecture sur Réglages ;
// les rubriques personnelles sont ouvertes à tout membre de la team.
export default async function PageRubrique({
  params,
  searchParams,
}: {
  params: Promise<{ rubrique: string }>
  searchParams: Promise<{ ok?: string; erreur?: string }>
}) {
  const { rubrique } = await params
  const { ok, erreur } = await searchParams
  const { contexte } = await contexteQg().catch((erreur: unknown) => {
    redirigerSiSansContexte(erreur)
    throw erreur
  })

  if (estRubriqueEquipe(rubrique)) {
    if (!aAuMoins(await niveauDe(contexte, "settings"), "lecture")) {
      return (
        <EcranVide
          icone={Lock}
          titre="Cette rubrique est réservée à la team"
          lignes={["Elle est ouverte à ceux qui ont accès à Réglages.", "Demande l'accès au responsable de la team."]}
          action={{ libelle: "Mes rubriques", href: "/apps/settings/compte" }}
        />
      )
    }
    return <RubriqueEquipe chemin={rubrique} messageOk={ok === "1"} erreur={erreur} />
  }

  if (!RUBRIQUES_PERSONNELLES.some((r) => r.chemin === rubrique)) notFound()

  const session = await lireSession()
  const contenu = await rubriquePersonnelle(rubrique, contexte, session?.deviceId ?? "")
  return (
    <div className="flex flex-col gap-6">
      {ok === "1" && <p role="status" className="max-w-2xl rounded-md border border-bordure bg-surface px-4 py-2">Enregistré.</p>}
      {erreur && (
        <p role="alert" className="max-w-2xl rounded-md border border-etat-rouge bg-surface px-4 py-2 text-etat-rouge">
          {erreur}
        </p>
      )}
      {contenu}
    </div>
  )
}

async function rubriquePersonnelle(
  chemin: string,
  contexte: Awaited<ReturnType<typeof contexteQg>>["contexte"],
  appareilCourant: string,
) {
  if (chemin === "notifications") return <Notifications contexte={contexte} />
  if (chemin === "affichage") return <Affichage contexte={contexte} />
  if (chemin === "appareils") return <Appareils contexte={contexte} appareilCourant={appareilCourant} />
  if (chemin === "donnees") return <Donnees contexte={contexte} />
  return <Compte contexte={contexte} />
}
