import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { FormulaireRemboursement } from "@/apps/budget/composants/formulaires"
import { BOUTON, MONTANT } from "@/apps/budget/composants/classes"
import { lireARembourser, lireChoix, lireMembres } from "@/apps/budget/lectures-serveur"
import { formatEuros, phraseSoldeMembre } from "@/apps/budget/libelles"
import { jourDeParis } from "@/core/dates"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"

// Par membre : ce qu'il a avancé, ce qui lui a été remboursé, son solde. Le remboursement se fait depuis
// l'écran de la personne (gestion). La contribution ne voit que sa propre ligne.

export default async function PageParMembre({ searchParams }: { searchParams: Promise<{ rembourser?: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const parametres = await searchParams
  const [membres, choix] = await Promise.all([lireMembres(), lireChoix()])
  const peutRembourser = aAuMoins(acces.niveau, "gestion")
  const personne = peutRembourser && parametres.rembourser ? membres.find((membre) => membre.personneId === parametres.rembourser) ?? null : null
  const aRembourser = personne ? await lireARembourser(personne.personneId) : []
  const payeursHorsMembre = choix.payeurs.filter((payeur) => payeur.type !== "membre").map(({ id, nom }) => ({ id, nom }))

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <h1 className="titre-rallye text-3xl">Par membre</h1>

      {membres.length === 0 && <p className="text-texte-discret">Aucun membre à afficher.</p>}
      <ul className="flex flex-col divide-y divide-bordure rounded-lg border border-bordure bg-surface">
        {membres.map((membre) => (
          <li key={membre.personneId} className="flex flex-col gap-2 px-4 py-3 text-sm sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-4">
            <span className="font-medium">{membre.nom}</span>
            <span className="text-texte-discret">Avancé {formatEuros(membre.avance)}</span>
            <span className="text-texte-discret">Remboursé {formatEuros(membre.rembourse)}</span>
            <span>
              {phraseSoldeMembre(membre.du - membre.trop, membre.nom)}
            </span>
            {peutRembourser && membre.du > 0 && (
              <Link href={`/apps/budget/membres?rembourser=${membre.personneId}`} className="cible-tactile inline-flex items-center underline underline-offset-4 decoration-marque decoration-2">
                Rembourser
              </Link>
            )}
          </li>
        ))}
      </ul>

      {personne && (
        <section className="flex flex-col gap-4 rounded-lg border border-bordure bg-surface p-4">
          <h2 className="font-medium">Rembourser {personne.nom}</h2>
          <FormulaireRemboursement
            personne={{ id: personne.personneId, nom: personne.nom }}
            depenses={aRembourser}
            payeurs={payeursHorsMembre}
            dateDuJour={jourDeParis(new Date())}
          />
          <Link href="/apps/budget/membres" className={`${BOUTON} w-fit bg-transparent text-texte-discret`}>
            Fermer
          </Link>
        </section>
      )}
    </section>
  )
}
