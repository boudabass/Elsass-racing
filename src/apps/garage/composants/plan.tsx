import Link from "next/link"

import { ChoixVehicule } from "@/apps/garage/composants/atelier"
import type { DecompteZones, EstimationApres } from "@/apps/garage/plan"
import type { LignePlan, OrdrePlan, PlanAvantEpreuve } from "@/apps/garage/lectures-partagees"
import type { VehiculeChoisi } from "@/apps/garage/lectures-serveur"
import { libellePosition } from "@/apps/garage/emplacements"
import { libelleZone, pourcentage } from "@/apps/garage/mise-en-forme"
import { LIBELLE_STATUT_ORDRE } from "@/apps/garage/travaux"
import { CHAMP, LIEN } from "@/lib/classes-formulaire"
import { formatEuros } from "@/lib/euros"

// Plan avant épreuve (tâche 4.5, 954 v1.4 §2). Constat seul : aucun bouton ne crée un ordre ni une pièce. Chaque
// organe ouvre sa fiche, où sont Réparer et Remplacer. Vocabulaire : « Zone rouge », « À surveiller », jamais
// « à changer » ni « à faire » pour un organe sans ordre.

function duree(minutes: number): string {
  if (minutes === 0) return "0 min"
  const heures = Math.floor(minutes / 60)
  const reste = minutes % 60
  if (heures === 0) return `${reste} min`
  return reste === 0 ? `${heures} h` : `${heures} h ${reste} min`
}

function kmAffiches(km: number): string {
  return `${(Math.round(km * 10) / 10).toLocaleString("fr-FR")} km`
}

// État actuel : le mot de la zone et le pourcentage (jamais la couleur seule).
function etatActuel(ligne: LignePlan): string {
  if (ligne.zone === "a_renseigner") return "À renseigner"
  return `${libelleZone(ligne.zone)} · ${pourcentage(ligne.etat)}`
}

function libelleApres(apres: EstimationApres): string {
  switch (apres.statut) {
    case "estimee":
      return `${libelleZone(apres.zone)} · ${pourcentage(apres.etat)}`
    case "sans_km":
      return "Estimation impossible : longueurs des spéciales non saisies"
    case "a_renseigner":
      return "Durée de vie à renseigner"
    case "sans_piece":
      return "Aucune pièce montée"
    case "pneus":
      return "Usure saisie à la main, pas d'estimation"
  }
}

function resumeZones(decompte: DecompteZones): string {
  const morceaux = [`${decompte.rouge} en zone rouge`, `${decompte.surveiller} à surveiller`]
  if (decompte.aRenseigner > 0) morceaux.push(`${decompte.aRenseigner} à renseigner`)
  return morceaux.join(" · ")
}

export function PlanEcran({
  vehicules,
  choisi,
  plan,
  peutVoirPrix,
}: {
  vehicules: VehiculeChoisi[]
  choisi: VehiculeChoisi
  plan: PlanAvantEpreuve
  peutVoirPrix: boolean
}) {
  const epreuve = plan.epreuve

  return (
    <section className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">Plan avant épreuve</h1>
        {vehicules.length > 1 && <ChoixVehicule vehicules={vehicules} choisi={choisi.id} chemin="/apps/garage/plan" />}
      </header>

      {!epreuve ? (
        <div className="flex flex-col gap-3">
          <p className="text-texte-discret">Aucune épreuve engagée pour cette voiture.</p>
          <Link href="/apps/saison" className={LIEN}>
            Ouvrir le calendrier de Saison
          </Link>
        </div>
      ) : (
        <>
          {plan.engagements.length > 1 && (
            <form method="get" action="/apps/garage/plan" className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="vehicule" value={choisi.id} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Épreuve</span>
                <select name="epreuve" defaultValue={epreuve.eventId} className={CHAMP}>
                  {plan.engagements.map((engagement) => (
                    <option key={engagement.eventId} value={engagement.eventId}>
                      {engagement.epreuveNom}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="cible-tactile rounded-md border border-bordure px-4">
                Afficher
              </button>
            </form>
          )}

          <div className="flex flex-col gap-2">
            <h2 className="font-medium">{epreuve.epreuveNom}</h2>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <dt className="text-texte-discret">Maintenant</dt>
              <dd>{resumeZones(plan.maintenant)}</dd>
              <dt className="text-texte-discret">Après l'épreuve</dt>
              <dd>
                {resumeZones(plan.apres)}
                {plan.apres.sansEstimation > 0 && ` · ${plan.apres.sansEstimation} sans estimation`}
              </dd>
              <dt className="text-texte-discret">Travaux prévus pour l'épreuve</dt>
              <dd>
                {plan.dureeMinutes > 0 ? duree(plan.dureeMinutes) : "Aucun"}
                {peutVoirPrix && plan.coutCents !== null && ` · ${formatEuros(plan.coutCents)} de main-d'œuvre`}
              </dd>
            </dl>
            <p className="text-sm text-texte-discret">
              {epreuve.kmPrevus !== null
                ? `Après l'épreuve : estimation sur ${kmAffiches(epreuve.kmPrevus)} de spéciale.`
                : "Après l'épreuve : longueurs des spéciales non saisies, seuls les organes qui comptent en épreuves sont estimés."}
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {plan.lignes.map((ligne) => (
              <li key={ligne.id} className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/apps/garage/organes/${ligne.id}`} className={`${LIEN} font-medium`}>
                    {libellePosition(ligne.position) ? `${ligne.nom} · ${libellePosition(ligne.position)}` : ligne.nom}
                  </Link>
                  <span className="text-sm">{etatActuel(ligne)}</span>
                </div>
                <p className="text-sm">
                  <span className="text-texte-discret">Après l'épreuve : </span>
                  {libelleApres(ligne.apres)}
                </p>
                {ligne.ordres.length > 0 && <ListeOrdres ordres={ligne.ordres} peutVoirPrix={peutVoirPrix} />}
              </li>
            ))}
          </ul>

          {plan.ordresSansOrgane.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="font-medium">Travaux sans organe</h2>
              <ListeOrdres ordres={plan.ordresSansOrgane} peutVoirPrix={peutVoirPrix} />
            </div>
          )}
        </>
      )}
    </section>
  )
}

function ListeOrdres({ ordres, peutVoirPrix }: { ordres: OrdrePlan[]; peutVoirPrix: boolean }) {
  return (
    <ul className="flex flex-col divide-y divide-bordure text-sm">
      {ordres.map((ordre) => (
        <li key={ordre.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>{ordre.titre}</span>
          <span className="flex flex-wrap gap-2 text-texte-discret">
            <span>{LIBELLE_STATUT_ORDRE[ordre.statut]}</span>
            <span>{ordre.avancementPct} %</span>
            {ordre.dureeEstimeeMinutes !== null && <span>{duree(ordre.dureeEstimeeMinutes)}</span>}
            {peutVoirPrix && ordre.coutMainOeuvreCents !== null && <span>{formatEuros(ordre.coutMainOeuvreCents)}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

