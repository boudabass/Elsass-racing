import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/voiture/ecran"
import { FormulaireReglage, type OptionEpreuveReglage } from "@/apps/voiture/composants/formulaire-reglage"
import { ErreurVoiture } from "@/apps/voiture/erreurs"
import { lireChampsMasques, lireEpreuvesDuVehicule, lireReglages, lireVehicule } from "@/apps/voiture/lectures-serveur"
import { valeurDeReglageEnTexte } from "@/apps/voiture/libelles"
import { valeursDeDepart } from "@/apps/voiture/services-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"
import { jourDeParis } from "@/core/dates"

// Nouvelle fiche : la date du jour, l'épreuve en cours si le véhicule y est engagé, et « Partir de » : la dernière
// fiche (par défaut) ou une référence. Les champs se pré-remplissent avec valeursDeDepart (préremplir).
export default async function PageNouvelleFiche({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ partir?: string }>
}) {
  const acces = await accesEcran("contribution")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour aux véhicules", href: "/apps/voiture" }} />
  }
  const { id } = await params
  const { partir } = await searchParams
  const fiche = await lireVehicule(id).catch((erreur: unknown) => {
    if (erreur instanceof ErreurVoiture) return null
    throw erreur
  })
  if (!fiche) notFound()
  const { references } = await lireReglages(id)

  const referenceChoisie = partir && references.some((r) => r.id === partir) ? partir : null
  const valeurs = await valeursDeDepart(id, referenceChoisie)
  const aujourdhui = jourDeParis(new Date())
  const epreuves = await lireEpreuvesDuVehicule(id, new Date(`${aujourdhui}T00:00:00Z`))
  const enCours = epreuves.find((e) => e.enCours)
  const options: OptionEpreuveReglage[] = epreuves.map((e) => ({ valeur: `${e.entryId}|${e.eventId}`, libelle: e.nom }))
  const masques = await lireChampsMasques()

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <Link href={`/apps/voiture/vehicules/${id}?onglet=reglages`} className="cible-tactile inline-flex items-center text-sm text-texte-discret">
        ← Réglages
      </Link>
      <h1 className="titre-rallye text-3xl">Nouvelle fiche de réglage</h1>

      <FormulaireReglage
        key={referenceChoisie ?? "derniere"}
        vehicleId={id}
        references={references.map((reference) => ({ id: reference.id, nom: reference.nom }))}
        referenceChoisie={referenceChoisie}
        initiales={{
          date: aujourdhui,
          epreuve: enCours ? `${enCours.entryId}|${enCours.eventId}` : "",
          conditions: "",
          revetement: "",
          remarques: "",
          note: "",
          valeurs: Object.fromEntries(Object.entries(valeurs).map(([cle, valeur]) => [cle, valeurDeReglageEnTexte(cle, valeur)])),
        }}
        masques={masques}
        epreuves={options}
        modeleId={referenceChoisie}
      />
    </section>
  )
}
