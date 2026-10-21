import { notFound } from "next/navigation"
import { Lock, Wrench } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { CartesOrganes, ChoixVehicule, IndiceBloc, SilhouetteAtelier } from "@/apps/garage/composants/atelier"
import { listerVehiculesAtelier, lireVehiculeAtelier } from "@/apps/garage/lectures-serveur"
import { motIndice, phrasesIndiceAbsent } from "@/apps/garage/mise-en-forme"
import { EcranVide } from "@/components/qg/ecran-vide"

// Atelier du Garage (tâche 4.2, brief §1) : la voiture choisie dans l'URL (la première par défaut), son indice, sa
// silhouette et ses cartes. Sans voiture, l'écran dit où en ajouter une.
export default async function PageAtelier({ searchParams }: { searchParams: Promise<{ vehicule?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const vehicules = await listerVehiculesAtelier()
  if (vehicules.length === 0) {
    return (
      <EcranVide
        icone={Wrench}
        titre="Atelier"
        lignes={["Ajoutez d'abord votre voiture dans l'app Voiture."]}
        action={{ libelle: "Ouvrir l'app Voiture", href: "/apps/voiture" }}
      />
    )
  }

  const { vehicule } = await searchParams
  const choisi = vehicules.find((v) => v.id === vehicule) ?? vehicules[0]
  const atelier = await lireVehiculeAtelier(choisi.id)
  if (!atelier) notFound()

  const mot = motIndice(
    atelier.organes.map((o) => ({ nom: o.nom, critique: o.critique, pieceMontee: Boolean(o.piece || o.trainMonte), zone: o.zone })),
  )
  const nommes = (ids: string[]) => atelier.organes.filter((o) => ids.includes(o.id)).map((o) => ({ id: o.id, nom: o.nom }))
  const phrases = phrasesIndiceAbsent(nommes(atelier.sansPiece), nommes(atelier.sansEtat))

  return (
    <section className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">Atelier</h1>
        {vehicules.length > 1 && <ChoixVehicule vehicules={vehicules} choisi={choisi.id} />}
      </header>

      <IndiceBloc indice={atelier.indice} mot={mot} phrases={phrases} />

      {atelier.silhouette ? (
        <SilhouetteAtelier vehicule={choisi.nomCourt} silhouette={atelier.silhouette} organes={atelier.organes} />
      ) : null}

      <CartesOrganes organes={atelier.organes} niveau={acces.niveau} />
    </section>
  )
}
