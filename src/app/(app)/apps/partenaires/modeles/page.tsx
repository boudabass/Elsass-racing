import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/partenaires/ecran"
import { CatalogueBase } from "@/apps/partenaires/composants/catalogue-base"
import { lireCatalogue, lireModeles } from "@/apps/partenaires/services-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"
import { LIEN } from "@/lib/classes-formulaire"

// Modèles de convention (gestion seulement) : la liste, puis la liste de base des contreparties.
export default async function PageModeles() {
  const acces = await accesEcran("gestion")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const [modeles, catalogue] = await Promise.all([lireModeles(), lireCatalogue()])

  return (
    <section className="flex w-full max-w-4xl flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="titre-rallye text-3xl">Modèles</h1>
        <p className="text-texte-discret">Le texte des conventions. Une convention reprend le modèle choisi à sa création.</p>
      </div>

      <section aria-labelledby="liste-modeles" className="flex flex-col gap-3">
        <h2 id="liste-modeles" className="text-lg font-medium">
          Modèles de convention
        </h2>
        <ul className="flex flex-col gap-2">
          {modeles.map((modele) => (
            <li key={modele.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-bordure bg-surface p-4">
              <Link href={`/apps/partenaires/modeles/${modele.id}`} className={`${LIEN} font-medium`}>
                {modele.nom}
              </Link>
              <span className="text-sm text-texte-discret">
                Version {modele.version} · {modele.actif ? "Actif" : "Désactivé"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <CatalogueBase lignes={catalogue} />
    </section>
  )
}
