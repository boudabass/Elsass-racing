import Link from "next/link"
import { redirect } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/voiture/ecran"
import { listerVehicules } from "@/apps/voiture/lectures-serveur"
import { LIBELLE_TYPE_VEHICULE } from "@/apps/voiture/libelles"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"

// Bouton + « Réglage » : avec un seul véhicule de course, la nouvelle fiche s'ouvre tout de suite ; sinon, la
// question « Pour quel véhicule ? » avec la liste. Accessible à l'assistance, y compris en mode terrain.
export default async function PageReglageRapide() {
  const acces = await accesEcran("contribution")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const vehicules = await listerVehicules()
  const courses = vehicules.filter((v) => v.type === "course")
  if (courses.length === 1) redirect(`/apps/voiture/vehicules/${courses[0].vehicleId}/reglages/nouveau`)

  return (
    <section className="flex max-w-xl flex-col gap-6">
      <h1 className="titre-rallye text-3xl">Pour quel véhicule ?</h1>
      {vehicules.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p>Aucun véhicule pour l&apos;instant.</p>
          {aAuMoins(acces.niveau, "ecriture") && (
            <Link href="/apps/voiture/nouveau" className="cible-tactile inline-flex items-center underline underline-offset-4">
              Ajouter un véhicule
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-bordure">
          {vehicules.map((vehicule) => (
            <li key={vehicule.vehicleId}>
              <Link href={`/apps/voiture/vehicules/${vehicule.vehicleId}/reglages/nouveau`} className="cible-tactile flex flex-col py-3">
                <span className="font-medium">{vehicule.nom}</span>
                <span className="text-sm text-texte-discret">{LIBELLE_TYPE_VEHICULE[vehicule.type]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
