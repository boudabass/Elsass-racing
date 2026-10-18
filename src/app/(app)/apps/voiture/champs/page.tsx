import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/voiture/ecran"
import { FormulaireChampsMasques } from "@/apps/voiture/composants/actions-reglage"
import { lireChampsMasques } from "@/apps/voiture/lectures-serveur"
import { CHAMPS_REGLAGE } from "@/apps/voiture/regles"
import { EcranVide } from "@/components/qg/ecran-vide"

// Champs masqués par la team (gestion) : une case par champ avancé. Les essentiels restent visibles.
export default async function PageChampsMasques() {
  const acces = await accesEcran("gestion")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour aux véhicules", href: "/apps/voiture" }} />
  }
  const masques = await lireChampsMasques()
  const avances = CHAMPS_REGLAGE.filter((c) => c.groupe === "avance")

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <h1 className="titre-rallye text-3xl">Champs de réglage</h1>
      <p className="text-texte-discret">
        Un champ masqué n&apos;apparaît ni dans les nouvelles fiches, ni dans les fiches existantes. Les pressions et la hauteur de caisse
        (essentiels) ne se masquent pas.
      </p>
      <FormulaireChampsMasques
        groupes={[
          {
            titre: "Plus de réglages",
            champs: avances.map((c) => ({ cle: c.cle, libelle: c.libelle, masque: masques.includes(c.cle) })),
          },
        ]}
      />
    </section>
  )
}
