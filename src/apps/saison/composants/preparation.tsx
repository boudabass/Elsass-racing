import Link from "next/link"

import { LIBELLE_POINT_PREPARATION, LIBELLE_STATUT_ENGAGEMENT, LIBELLE_STATUT_POINT } from "@/apps/saison/libelles"
import { lieuDeReglage, type PointEtabli } from "@/apps/saison/preparation"
import type { CouleurIndice, IndicePreparation } from "@/apps/saison/regles"

// Panneau « Prêt pour l'épreuve ? » : un bloc par engagement. Il ne bloque jamais rien.
// Les points « pas encore suivi » sont affichés tels quels : pas de fausse valeur.

const COULEUR_INDICE: Record<CouleurIndice, string> = {
  vert: "text-etat-ok",
  orange: "text-etat-orange",
  rouge: "text-etat-rouge",
}

// Éléments à côté de l'indice (sans effet sur lui), en attente de leurs apps.
const A_COTE = ["Fiabilité de la voiture", "Avancement des check-lists", "Présents de l'assistance"]

export interface EngagementPreparation {
  id: string
  voiture: string
  statut: string
  points: PointEtabli[]
  indice: IndicePreparation | null
}

export function PanneauPreparation({ engagements }: { engagements: EngagementPreparation[] }) {
  if (engagements.length === 0) {
    return <p className="text-texte-discret">Aucun engagement à préparer pour l'instant.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {engagements.map((engagement) => (
        <article key={engagement.id} className="flex flex-col gap-4 rounded-lg border border-bordure bg-surface p-4">
          <header className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-medium">{engagement.voiture}</h2>
              <p className="text-sm text-texte-discret">{LIBELLE_STATUT_ENGAGEMENT[engagement.statut as keyof typeof LIBELLE_STATUT_ENGAGEMENT] ?? engagement.statut}</p>
            </div>
            {engagement.indice ? (
              <p
                className={`chiffre text-4xl font-semibold tabular-nums ${COULEUR_INDICE[engagement.indice.couleur]}`}
                aria-label={`Préparation : ${engagement.indice.pourcentage} pour cent`}
              >
                {engagement.indice.pourcentage} %
              </p>
            ) : (
              <p className="text-sm text-texte-discret">Pas encore d'indice</p>
            )}
          </header>

          <ul className="flex flex-col divide-y divide-bordure text-sm">
            {engagement.points.map((point) => (
              <li key={point.point} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{LIBELLE_POINT_PREPARATION[point.point]}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className={point.etat === "regle" ? "text-etat-ok" : point.etat === "ouvert" ? "text-etat-orange" : "text-texte-discret"}>
                    {point.etat === "non_suivi" ? "Pas encore suivi" : LIBELLE_STATUT_POINT[point.etat]}
                  </span>
                  {point.detail && <span className="text-texte-discret">{point.detail}</span>}
                  {point.etat === "ouvert" && lieuDeReglage(point.point) === "fiche_engagement" && (
                    <Link href={`/apps/saison/engagements/${engagement.id}`} className="cible-tactile inline-flex items-center underline">
                      Régler
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-1 border-t border-bordure pt-3 text-sm">
            <p className="font-medium text-texte-discret">À côté, sans effet sur l'indice</p>
            <ul className="flex flex-col gap-1">
              {A_COTE.map((libelle) => (
                <li key={libelle} className="flex justify-between gap-2">
                  <span>{libelle}</span>
                  <span className="text-texte-discret">Pas encore suivi</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </div>
  )
}
