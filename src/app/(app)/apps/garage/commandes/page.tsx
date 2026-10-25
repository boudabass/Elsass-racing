import { notFound } from "next/navigation"
import { Lock, Wrench } from "lucide-react"

import { dateDeParis } from "@/apps/garage/commandes"
import { accesEcran } from "@/apps/garage/ecran"
import { CommandesEcran } from "@/apps/garage/composants/commandes"
import { lireCommandes, listerVehiculesAtelier } from "@/apps/garage/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Commandes du Garage (tâche 4.3, brief §5) : écriture seulement. Les livraisons attendues d'abord, puis les reçues.
export default async function PageCommandes({ searchParams }: { searchParams: Promise<{ vehicule?: string }> }) {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const vehicules = await listerVehiculesAtelier()
  if (vehicules.length === 0) {
    return (
      <EcranVide
        icone={Wrench}
        titre="Commandes"
        lignes={["Ajoute d'abord ta voiture dans l'app Voiture."]}
        action={{ libelle: "Ouvrir l'app Voiture", href: "/apps/voiture" }}
      />
    )
  }

  const { vehicule } = await searchParams
  const choisi = vehicules.find((v) => v.id === vehicule) ?? vehicules[0]
  const commandes = await lireCommandes(choisi.id)
  if (!commandes) notFound()

  return <CommandesEcran vehicules={vehicules} choisi={choisi} commandes={commandes} aujourdhui={dateDeParis(new Date())} />
}
