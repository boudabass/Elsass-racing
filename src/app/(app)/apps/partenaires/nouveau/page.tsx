import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/partenaires/ecran"
import { FormulaireProspect } from "@/apps/partenaires/composants/formulaire-prospect"
import { EcranVide } from "@/components/qg/ecran-vide"
import { LIEN } from "@/lib/classes-formulaire"

// Nouveau prospect : deux champs. Le reste (coordonnées, statut, échanges) se remplit dans la fiche.
export default async function PageNouveauProspect() {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  return (
    <section className="flex max-w-xl flex-col gap-6">
      <Link href="/apps/partenaires" className={`${LIEN} self-start text-sm text-texte-discret`}>
        ← Prospection
      </Link>
      <h1 className="titre-rallye text-3xl">Nouveau prospect</h1>
      <FormulaireProspect />
    </section>
  )
}
