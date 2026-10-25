import { Lock, Wrench } from "lucide-react"

import { dateDeParis } from "@/apps/garage/commandes"
import { accesEcran } from "@/apps/garage/ecran"
import { ChoixVehicule } from "@/apps/garage/composants/atelier"
import { FormulaireCommande } from "@/apps/garage/composants/formulaires-commandes"
import { listerVehiculesAtelier, lireChoixCommande } from "@/apps/garage/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Nouvelle commande (tâche 4.3, brief §5) : écriture seulement.
export default async function PageNouvelleCommande({ searchParams }: { searchParams: Promise<{ vehicule?: string }> }) {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const vehicules = await listerVehiculesAtelier()
  if (vehicules.length === 0) {
    return (
      <EcranVide
        icone={Wrench}
        titre="Nouvelle commande"
        lignes={["Ajoute d'abord ta voiture dans l'app Voiture."]}
        action={{ libelle: "Ouvrir l'app Voiture", href: "/apps/voiture" }}
      />
    )
  }

  const { vehicule } = await searchParams
  const choisi = vehicules.find((v) => v.id === vehicule) ?? vehicules[0]
  const choix = await lireChoixCommande()

  return (
    <section className="flex max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">Nouvelle commande</h1>
        {vehicules.length > 1 && <ChoixVehicule vehicules={vehicules} choisi={choisi.id} chemin="/apps/garage/commandes/nouvelle" />}
      </header>
      <FormulaireCommande
        key={choisi.id}
        vehicleId={choisi.id}
        fournisseurs={choix.fournisseurs}
        types={choix.types}
        aujourdhui={dateDeParis(new Date())}
      />
    </section>
  )
}
