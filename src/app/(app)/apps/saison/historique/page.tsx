import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/saison/ecran"
import { lireHistorique } from "@/apps/saison/lectures-serveur"
import { BoutonClotureSaison, FormulaireNouvelleSaison } from "@/apps/saison/composants/saisons"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"

// Historique : chaque saison avec son bilan (résultats validés seuls), les statistiques de carrière
// par personne et par voiture, et la gestion des saisons (nouvelle, clôture).
export default async function PageHistorique() {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au calendrier", href: "/apps/saison" }} />
  }
  const historique = await lireHistorique()
  const gestion = aAuMoins(historique.niveau, "gestion")

  return (
    <section className="flex max-w-5xl flex-col gap-8">
      <h1 className="font-titre text-2xl uppercase">Historique</h1>

      <div className="flex flex-col gap-4">
        <h2 className="font-medium">Saisons</h2>
        {historique.saisons.length === 0 && <p className="text-texte-discret">Aucune saison pour l'instant.</p>}
        {historique.saisons.map((saison) => (
          <article key={saison.id} className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-titre text-xl uppercase">
                {saison.annee} · {saison.nom}
              </h3>
              <span className="text-sm text-texte-discret">
                {saison.clotureeAt ? "Clôturée" : saison.enCours ? "En cours" : "Ouverte"}
                {saison.clotureProposee ? " · clôture proposée" : ""}
              </span>
            </header>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <dt className="text-texte-discret">Épreuves</dt>
              <dd className="tabular-nums">{saison.epreuves}</dd>
              <dt className="text-texte-discret">Engagements partis</dt>
              <dd className="tabular-nums">{saison.bilan.partis}</dd>
              <dt className="text-texte-discret">Arrivées</dt>
              <dd className="tabular-nums">{saison.bilan.arrivees}</dd>
              <dt className="text-texte-discret">Abandons</dt>
              <dd className="tabular-nums">{saison.bilan.abandons}</dd>
              <dt className="text-texte-discret">Km chronométrés</dt>
              <dd className="tabular-nums">{saison.bilan.km.toFixed(1)}</dd>
            </dl>
            {gestion && !saison.clotureeAt && saison.enCours && <BoutonClotureSaison seasonId={saison.id} />}
          </article>
        ))}
      </div>

      {gestion && (
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">Nouvelle saison</h2>
          <FormulaireNouvelleSaison prochaineAnnee={historique.prochaineAnnee} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-medium">Pilotes</h2>
        <StatistiquesCarriere lignes={historique.personnes} />
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="font-medium">Voitures</h2>
        <StatistiquesCarriere lignes={historique.voitures} />
      </div>
    </section>
  )
}

interface LigneCarriere {
  cle: string
  nom: string
  epreuves: number
  arrivees: number
  tauxArrivee: number | null
  km: number
  meilleurClassementClasse: number | null
}

function StatistiquesCarriere({ lignes }: { lignes: LigneCarriere[] }) {
  if (lignes.length === 0) return <p className="text-sm text-texte-discret">Aucun résultat validé pour l'instant.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-bordure">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-texte-discret">
          <tr>
            <th className="px-3 py-2 font-medium">Nom</th>
            <th className="px-3 py-2 font-medium">Épreuves</th>
            <th className="px-3 py-2 font-medium">Arrivées</th>
            <th className="px-3 py-2 font-medium">Taux d'arrivée</th>
            <th className="px-3 py-2 font-medium">Km chronométrés</th>
            <th className="px-3 py-2 font-medium">Meilleur classement de classe</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={ligne.cle} className="border-t border-bordure">
              <td className="px-3 py-2">{ligne.nom}</td>
              <td className="px-3 py-2 tabular-nums">{ligne.epreuves}</td>
              <td className="px-3 py-2 tabular-nums">{ligne.arrivees}</td>
              <td className="px-3 py-2 tabular-nums">{ligne.tauxArrivee === null ? "—" : `${ligne.tauxArrivee} %`}</td>
              <td className="px-3 py-2 tabular-nums">{ligne.km.toFixed(1)}</td>
              <td className="px-3 py-2 tabular-nums">{ligne.meilleurClassementClasse ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
