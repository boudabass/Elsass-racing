import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/saison/ecran"
import { lireDebriefs, lireEngagement, lireFinDEpreuve, listerChoixEngagement } from "@/apps/saison/lectures-serveur"
import { FormulaireInscription, FormulairePaiement } from "@/apps/saison/composants/formulaires"
import { FormulaireDebrief } from "@/apps/saison/composants/debrief"
import { FinEpreuve } from "@/apps/saison/composants/fin-epreuve"
import { STATUTS_PARTIS } from "@/apps/saison/regles-resultats"
import { coutDeLEpreuve } from "@/apps/budget/liaisons-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"
import { LIBELLE_STATUT_ENGAGEMENT } from "@/apps/saison/libelles"

// Fiche d'un engagement : voiture, équipage, puis l'inscription. Sous lecture (assistance),
// l'inscription est lue sans montants ni moyens de paiement, et aucun bouton n'est rendu.

export default async function PageEngagement({ params }: { params: Promise<{ id: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au calendrier", href: "/apps/saison" }} />
  }
  const { id } = await params
  const fiche = await lireEngagement(id)
  if (!fiche) notFound()

  const { niveau, saisonCloturee, engagement, inscription } = fiche
  // Saison clôturée : plus aucun bouton d'écriture, débrief compris.
  const peutEcrire = aAuMoins(niveau, "ecriture") && !saisonCloturee
  const choix = peutEcrire ? await listerChoixEngagement() : null
  // Fin d'épreuve : seulement pour un résultat validé. Débriefs : filtrés côté serveur selon le rôle.
  const fin = await lireFinDEpreuve(id)
  // Coût de l'épreuve : Budget le fournit si l'app est activée et que le membre y a accès ; sinon rien.
  const coutEpreuve = fin ? await coutDeLEpreuve(engagement.epreuve.id) : null
  const debriefs = await lireDebriefs(id)
  const apresEpreuve = (STATUTS_PARTIS as readonly string[]).includes(engagement.statut)
  const monDebrief = debriefs.find((debrief) => debrief.estMoi) ?? null
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
          {LIBELLE_STATUT_ENGAGEMENT[engagement.statut as keyof typeof LIBELLE_STATUT_ENGAGEMENT] ?? engagement.statut}
          {engagement.numeroCourse ? ` · n° ${engagement.numeroCourse}` : ""}
        </p>
      </header>

      {fin && (
        <FinEpreuve
          epreuve={fin.epreuve}
          statutFinal={fin.statutFinal}
          classementGeneral={fin.classementGeneral}
          classementClasse={fin.classementClasse}
          nbPartantsClasse={fin.nbPartantsClasse}
          kmChronometres={fin.kmChronometres}
          kmSaison={fin.kmSaison}
          aDebrief={fin.aDebrief}
          peutDebriefer={peutEcrire}
          sansPreuve={fin.sansPreuve}
          coutEpreuve={coutEpreuve}
        />
      )}

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
      {apresEpreuve && (peutEcrire || debriefs.length > 0) && (
        <section className="flex flex-col gap-4 border-t border-bordure pt-6">
          <h2 className="font-medium">Débrief</h2>
          {debriefs.length === 0 && <p className="text-sm text-texte-discret">Aucun débrief pour l'instant.</p>}
          {debriefs.map((debrief) => (
            <article key={debrief.id} className="flex flex-col gap-1 rounded-md border border-bordure p-3 text-sm">
              <p className="font-medium">
                {debrief.auteur}
                {debrief.estMoi ? " (toi)" : ""} · ressenti {debrief.ressenti}/5
              </p>
              {debrief.pointsPositifs && <p>Positif : {debrief.pointsPositifs}</p>}
              {debrief.pointsAAmeliorer && <p>À améliorer : {debrief.pointsAAmeliorer}</p>}
              {debrief.problemesVoiture && <p>Voiture : {debrief.problemesVoiture}</p>}
            </article>
          ))}
          {peutEcrire && (
            <FormulaireDebrief
              entryId={id}
              valeurs={
                monDebrief
                  ? {
                      ressenti: monDebrief.ressenti,
                      pointsPositifs: monDebrief.pointsPositifs,
                      pointsAAmeliorer: monDebrief.pointsAAmeliorer,
                      problemesVoiture: monDebrief.problemesVoiture,
                    }
                  : null
              }
            />
          )}
        </section>
      )}
    </section>
  )
}
