import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/voiture/ecran"
import { CarteVehicule } from "@/apps/voiture/composants/carte-vehicule"
import { listerVehicules } from "@/apps/voiture/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"
import { BOUTON, LIEN } from "@/lib/classes-formulaire"

// Mes véhicules : une carte par véhicule, l'état des papiers en toutes lettres. Sans véhicule, l'ajout est
// proposé par un bouton ; avec des véhicules, par un lien au-dessus des cartes (à partir du niveau écriture).
export default async function PageVehicules() {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const vehicules = await listerVehicules()
  const peutAjouter = aAuMoins(acces.niveau, "ecriture")

  return (
    <section className="flex max-w-5xl flex-col gap-6">
      <h1 className="titre-rallye text-3xl">Mes véhicules</h1>
      {vehicules.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p>Aucun véhicule pour l&apos;instant.</p>
          {peutAjouter && (
            <Link href="/apps/voiture/nouveau" className={BOUTON}>
              Ajouter un véhicule
            </Link>
          )}
        </div>
      ) : (
        <>
          {peutAjouter && (
            <Link href="/apps/voiture/nouveau" className={`${LIEN} self-start`}>
              Ajouter un véhicule
            </Link>
          )}
          <ul className="grid gap-4 md:grid-cols-2">
            {vehicules.map((vehicule) => (
              <CarteVehicule key={vehicule.vehicleId} vehicule={vehicule} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
