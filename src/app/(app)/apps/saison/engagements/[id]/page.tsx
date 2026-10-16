import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/saison/ecran"
import { lireEngagement, listerChoixEngagement } from "@/apps/saison/lectures-serveur"
import { FormulaireInscription, FormulairePaiement } from "@/apps/saison/composants/formulaires"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"

// Fiche d'un engagement : voiture, équipage, puis l'inscription. Sous lecture (assistance),
// l'inscription est lue sans montants ni moyens de paiement, et aucun bouton n'est rendu.
const LIBELLE_STATUT: Record<string, string> = {
  envisage: "Envisagé",
  inscrit: "Inscrit",
  paye: "Payé",
  parti: "Parti",
  arrivee: "Arrivé",
  abandon: "Abandon",
  forfait: "Forfait",
}

export default async function PageEngagement({ params }: { params: Promise<{ id: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au calendrier", href: "/apps/saison" }} />
  }
  const { id } = await params
  const fiche = await lireEngagement(id)
  if (!fiche) notFound()

  const { niveau, engagement, inscription } = fiche
  const peutEcrire = aAuMoins(niveau, "ecriture")
  const choix = peutEcrire ? await listerChoixEngagement() : null
  // Lecture seule : l'inscription a déjà ses montants retirés par masquerMontants.
  const inscriptionEcriture = inscription as {
    concurrentNom: string | null
    montantDu: number | null
    listeEngagesPubliee: boolean
    remarques: string | null
    dossierEnvoyeLe: Date | null
    confirmationRecueLe: Date | null
    payeLe: Date | null
    montantPaye?: number | null
    modePaiement?: string | null
    reference?: string | null
  } | null

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <Link href={`/apps/saison/epreuves/${engagement.epreuve.id}?onglet=engagements`} className="text-sm text-texte-discret">
        ← {engagement.epreuve.nom}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="font-titre text-2xl uppercase">{engagement.voiture}</h1>
        <p className="text-sm text-texte-discret">
          {LIBELLE_STATUT[engagement.statut] ?? engagement.statut}
          {engagement.numeroCourse ? ` · n° ${engagement.numeroCourse}` : ""}
        </p>
      </header>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <dt className="text-texte-discret">Pilote</dt>
        <dd>{engagement.pilote ?? "—"}</dd>
        <dt className="text-texte-discret">Copilote</dt>
        <dd>{engagement.copilote ?? "—"}</dd>
        <dt className="text-texte-discret">Groupe</dt>
        <dd>{engagement.groupe ?? "—"}</dd>
        <dt className="text-texte-discret">Classe</dt>
        <dd>{engagement.classe ?? "—"}</dd>
      </dl>

      {inscriptionEcriture && (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium">Inscription</h2>
          {peutEcrire ? (
            <>
              <FormulaireInscription entryId={id} inscription={inscriptionEcriture} />
              <div className="flex flex-col gap-2 border-t border-bordure pt-4">
                <h3 className="font-medium">Paiement</h3>
                <FormulairePaiement
                  entryId={id}
                  montantDu={inscriptionEcriture.montantDu}
                  personnes={choix?.personnes ?? []}
                />
              </div>
            </>
          ) : (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <dt className="text-texte-discret">Concurrent</dt>
              <dd>{inscriptionEcriture.concurrentNom ?? "—"}</dd>
              <dt className="text-texte-discret">Liste des engagés publiée</dt>
              <dd>{inscriptionEcriture.listeEngagesPubliee ? "Oui" : "Non"}</dd>
              <dt className="text-texte-discret">Remarques</dt>
              <dd>{inscriptionEcriture.remarques ?? "—"}</dd>
            </dl>
          )}
        </section>
      )}
    </section>
  )
}
