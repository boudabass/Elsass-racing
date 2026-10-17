import Link from "next/link"

import type { ProchaineEtape } from "@/core/actions/prochaine-etape"
import { libelleCompteARebours } from "@/core/actions/prochaine-etape"

// Bouton flottant « Prochaine étape », sur tous les écrans du QG.
export function BoutonProchaineEtape({ etape, maintenant }: { etape: ProchaineEtape; maintenant: Date }) {
  if (etape.genre === "rien") {
    return (
      // Sur téléphone, la bulle masquée : elle recouvrait le bas du contenu pour un message sans action.
      <div className="fixed bottom-24 right-4 z-40 hidden max-w-xs rounded-lg border border-bordure bg-surface px-4 py-3 text-sm text-texte-discret shadow-lg md:bottom-6 md:right-6 md:block">
        Rien d'urgent pour l'instant.
      </div>
    )
  }

  // Action : la boîte d'actions s'ouvre sur cette action (pas l'app d'origine, qui n'a pas
  // encore d'écran). Compte à rebours : la saison.
  const destination = etape.genre === "action" ? `/qg?boite=${etape.action.id}` : "/apps/saison"
  // Action : son titre et sa raison. Compte à rebours : le décompte, puis le nom de l'épreuve.
  const compteARebours = etape.genre === "compte_a_rebours" ? libelleCompteARebours(etape.epreuve, maintenant) : null
  const titreAffiche = etape.genre === "action" ? etape.libelle : etape.epreuve.nom
  const pourquoi = etape.genre === "action" ? etape.pourquoi : null

  return (
    <Link
      href={destination}
      className="cible-tactile fixed bottom-24 right-4 z-40 flex max-w-xs flex-col rounded-lg bg-marque px-4 py-3 text-white shadow-lg hover:opacity-90 md:bottom-6 md:right-6"
    >
      {compteARebours && <span className="chiffre titre-rallye text-lg leading-none">{compteARebours}</span>}
      <span className={compteARebours ? "mt-1 text-sm" : "font-semibold leading-snug"}>{titreAffiche}</span>
      {pourquoi && <span className="mt-1 text-xs opacity-90">{pourquoi}</span>}
    </Link>
  )
}
