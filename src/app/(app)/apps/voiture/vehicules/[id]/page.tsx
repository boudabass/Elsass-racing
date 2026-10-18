import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/voiture/ecran"
import { ErreurVoiture } from "@/apps/voiture/erreurs"
import { lireVehicule } from "@/apps/voiture/lectures-serveur"
import { COULEUR_ETAT_PAPIERS, LIBELLE_ETAT_PAPIERS, LIBELLE_TYPE_VEHICULE } from "@/apps/voiture/libelles"
import { ONGLETS_FICHE_VEHICULE } from "@/apps/onglets-fiches"
import { EcranVide } from "@/components/qg/ecran-vide"
import { Onglets } from "@/components/qg/onglets-fiche"
import { contexteQg } from "@/core/qg/donnees"
import { ongletsVisibles } from "@/core/sdk/onglets"

// Fiche d'un véhicule : en-tête (nom, type, état des papiers), puis les onglets. Identité est l'onglet par défaut.
export default async function PageVehicule({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour aux véhicules", href: "/apps/voiture" }} />
  }
  const { id } = await params
  const { onglet = "identite" } = await searchParams

  const fiche = await lireVehicule(id).catch((erreur: unknown) => {
    if (erreur instanceof ErreurVoiture) return null
    throw erreur
  })
  if (!fiche || !fiche.vehicule) notFound()

  const { contexte } = await contexteQg()
  const visibles = await ongletsVisibles(contexte, ONGLETS_FICHE_VEHICULE)
  const actif = visibles.find((tab) => tab.cle === onglet) ?? visibles[0]
  if (!actif) notFound()

  return (
    <section className="flex max-w-4xl flex-col gap-5">
      <Link href="/apps/voiture" className="cible-tactile inline-flex items-center text-sm text-texte-discret">
        ← Véhicules
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="font-titre text-2xl uppercase">{fiche.vehicule.nomCourt}</h1>
        <p className="text-sm text-texte-discret">
          {LIBELLE_TYPE_VEHICULE[fiche.vehicule.type]} · <span className={`font-medium ${COULEUR_ETAT_PAPIERS[fiche.etatPapiers]}`}>{LIBELLE_ETAT_PAPIERS[fiche.etatPapiers]}</span>
        </p>
      </header>

      <Onglets base={`/apps/voiture/vehicules/${id}`} nom="Onglets du véhicule" onglets={visibles.map((tab) => ({ cle: tab.cle, libelle: tab.libelle }))} actif={actif.cle} />

      {await actif.composant({ ficheId: id })}
    </section>
  )
}
