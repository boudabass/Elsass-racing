import Link from "next/link"

import type { SurveillanceVehicule } from "@/apps/garage/lectures-partagees"
import { libellePosition } from "@/apps/garage/emplacements"
import { libelleZone, pourcentage, zoneIndice } from "@/apps/garage/mise-en-forme"
import { LIBELLE_POINT_PREPARATION, LIBELLE_STATUT_ENGAGEMENT, LIBELLE_STATUT_POINT } from "@/apps/saison/libelles"
import type { ResumeChecklistEngagement } from "@/apps/checklist/lectures-partagees"
import { lieuDeReglage, type PointEtabli } from "@/apps/saison/preparation"
import type { CouleurIndice, IndicePreparation } from "@/apps/saison/regles"
import { LIEN } from "@/lib/classes-formulaire"

// Panneau « Prêt pour l'épreuve ? » : un bloc par engagement. Il ne bloque jamais rien.
// Les points « pas encore suivi » sont affichés tels quels : pas de fausse valeur.
// Les pièces en zone rouge (Garage) sont un point à surveiller, sous les points, hors de l'indice (954 v1.4, §5).

const COULEUR_INDICE: Record<CouleurIndice, string> = {
  vert: "text-etat-ok",
  orange: "text-etat-orange",
  rouge: "text-etat-rouge",
}

// Éléments à côté de l'indice (sans effet sur lui), en attente de leurs apps.
const A_COTE = ["Présents de l'assistance"]

export interface EngagementPreparation {
  id: string
  voiture: string
  vehicleId: string
  statut: string
  points: PointEtabli[]
  indice: IndicePreparation | null
  // Check-lists : information seulement, hors indice (5.7a). Null : aucune liste pour cet engagement.
  checklist: ResumeChecklistEngagement | null
  // Null si Garage est désactivé, non accessible, ou si l'atelier n'est pas préparé : aucun bloc.
  surveillance: SurveillanceVehicule | null
}

export function PanneauPreparation({ engagements, checklistActive }: { engagements: EngagementPreparation[]; checklistActive: boolean }) {
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
                  {point.etat === "ouvert" && lieuDeReglage(point)?.type === "fiche_engagement" && (
                    <Link href={`/apps/saison/engagements/${engagement.id}`} className={LIEN}>
                      Régler
                    </Link>
                  )}
                  {point.etat === "ouvert" &&
                    (() => {
                      const lieu = lieuDeReglage(point)
                      if (lieu?.type === "fiche_personne") {
                        // Licence ou équipement : on se règle dans la fiche de la personne, à l'onglet concerné (Équipe).
                        return (
                          <Link href={`/apps/equipe/personnes/${lieu.personneId}?onglet=${lieu.onglet}`} className={LIEN}>
                            Régler
                          </Link>
                        )
                      }
                      if (lieu?.type === "fiche_vehicule") {
                        // Papiers : l'onglet Papiers de la fiche du véhicule, dans Voiture.
                        return (
                          <Link href={`/apps/voiture/vehicules/${lieu.vehicleId}?onglet=${lieu.onglet}`} className={LIEN}>
                            Régler
                          </Link>
                        )
                      }
                      return null
                    })()}
                </span>
              </li>
            ))}
          </ul>

          {engagement.surveillance && <BlocSurveillance vehicleId={engagement.vehicleId} surveillance={engagement.surveillance} />}

          <div className="flex flex-col gap-1 border-t border-bordure pt-3 text-sm">
            <p className="font-medium text-texte-discret">À côté, sans effet sur l'indice</p>
            <ul className="flex flex-col gap-1">
              <li className="flex justify-between gap-2">
                <span>Fiabilité de la voiture</span>
                <span className="text-texte-discret">{libelleFiabilite(engagement.surveillance)}</span>
              </li>
              {checklistActive && (
                <li className="flex justify-between gap-2">
                  <span>Check-lists</span>
                  <span className="text-texte-discret">{libelleChecklist(engagement.checklist)}</span>
                </li>
              )}
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

// Check-lists : l'avancement et les critiques ouverts, en texte (jamais la couleur seule). Hors indice.
function libelleChecklist(resume: ResumeChecklistEngagement | null): string {
  if (resume === null) return "Aucune liste"
  const critiques = resume.critiquesOuverts === 0 ? "aucun point critique ouvert" : `${resume.critiquesOuverts} point${resume.critiquesOuverts > 1 ? "s" : ""} critique${resume.critiquesOuverts > 1 ? "s" : ""} ouvert${resume.critiquesOuverts > 1 ? "s" : ""}`
  return `${resume.avancement} % · ${critiques}`
}

// Fiabilité de la voiture : le mot de la zone, puis le pourcentage (jamais la couleur seule).
function libelleFiabilite(surveillance: SurveillanceVehicule | null): string {
  if (!surveillance || surveillance.fiabilite === null) return "Pas encore suivi"
  return `${libelleZone(zoneIndice(surveillance.fiabilite))} · ${pourcentage(surveillance.fiabilite)}`
}

// Point à surveiller : les organes en zone rouge de la voiture, avec leur état, et le lien vers son plan avant épreuve.
function BlocSurveillance({ vehicleId, surveillance }: { vehicleId: string; surveillance: SurveillanceVehicule }) {
  const { zonesRouges } = surveillance
  return (
    <div className="flex flex-col gap-2 border-t border-bordure pt-3 text-sm">
      <p className="font-medium text-texte-discret">À surveiller, sans effet sur l'indice</p>
      {zonesRouges.length === 0 ? (
        <p>Garage : aucun organe en zone rouge</p>
      ) : (
        <>
          <p>Garage : {zonesRouges.length} organe(s) en zone rouge</p>
          <ul className="flex flex-col gap-1">
            {zonesRouges.map((organe) => (
              <li key={organe.id} className="flex justify-between gap-2">
                <span>{libellePosition(organe.position) ? `${organe.nom} · ${libellePosition(organe.position)}` : organe.nom}</span>
                <span className="chiffre text-texte-discret">{pourcentage(organe.etat) ?? "À renseigner"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href={`/apps/garage/plan?vehicule=${vehicleId}`} className={LIEN}>
        Voir le plan avant épreuve
      </Link>
    </div>
  )
}
