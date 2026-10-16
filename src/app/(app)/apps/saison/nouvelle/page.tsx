import Link from "next/link"

import { accesEcran } from "@/apps/saison/ecran"
import { FormulaireNouvelleEpreuve } from "@/apps/saison/composants/formulaires"
import { EcranVide } from "@/components/qg/ecran-vide"
import { Lock } from "lucide-react"

// Nouvelle épreuve : trois champs (nom, dates, type). Réservé à l'écriture : pas à l'assistance.
export default async function PageNouvelleEpreuve() {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au calendrier", href: "/apps/saison" }} />
  }
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <Link href="/apps/saison" className="text-sm text-texte-discret">
        ← Calendrier
      </Link>
      <h1 className="font-titre text-2xl uppercase">Nouvelle épreuve</h1>
      <FormulaireNouvelleEpreuve />
    </section>
  )
}
