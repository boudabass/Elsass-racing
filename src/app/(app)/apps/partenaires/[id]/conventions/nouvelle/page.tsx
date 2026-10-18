import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/partenaires/ecran"
import { FormulaireConvention } from "@/apps/partenaires/composants/formulaire-convention"
import { lireModeles } from "@/apps/partenaires/services-serveur"
import { lirePartenaire, lireSaisons } from "@/apps/partenaires/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"
import { LIEN } from "@/lib/classes-formulaire"

const jour = (date: Date) => date.toISOString().slice(0, 10)

// Nouvelle convention : saison en cours et son modèle actif par défaut. Les apports et l'échéancier se règlent ici ;
// les signataires s'indiquent à la signature, quand on sait qui signe.
export default async function PageNouvelleConvention({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const partenaire = await lirePartenaire(id)
  if (!partenaire) notFound()

  const [saisons, modeles] = await Promise.all([lireSaisons(), lireModeles()])
  const actifs = modeles.filter((m) => m.actif)
  const saisonEnCours = saisons.find((s) => s.enCours) ?? saisons[0] ?? null

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6">
      <Link href={`/apps/partenaires/${id}`} className={`${LIEN} self-start text-sm text-texte-discret`}>
        ← {partenaire.entreprise}
      </Link>
      <h1 className="titre-rallye text-3xl">Nouvelle convention</h1>
      {actifs.length === 0 ? (
        <p role="alert" className="text-etat-rouge">
          Aucun modèle de convention actif. Active un modèle dans Modèles avant de créer une convention.
        </p>
      ) : (
        <FormulaireConvention
          mode="creation"
          partnerId={id}
          modeles={actifs.map((m) => ({ id: m.id, nom: m.nom, version: m.version }))}
          saisons={saisons.map((s) => ({ id: s.id, nom: s.nom, dateDebut: jour(s.dateDebut), dateFin: jour(s.dateFin) }))}
          valeurs={{
            templateId: actifs[0].id,
            seasonId: saisonEnCours?.id ?? "",
            dateDebut: saisonEnCours ? jour(saisonEnCours.dateDebut) : "",
            dateFin: saisonEnCours ? jour(saisonEnCours.dateFin) : "",
            apportFinancier: "",
            apportNatureDescription: "",
            apportNatureValeur: "",
            echeancier: [],
          }}
        />
      )}
    </section>
  )
}
