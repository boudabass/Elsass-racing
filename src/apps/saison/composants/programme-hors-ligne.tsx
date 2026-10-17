"use client"

import { LIBELLE_TYPE_PROGRAMME, libelle } from "@/apps/saison/libelles"
import { useTable } from "@/core/synchro/client/react"

// Spéciales et programme de l'épreuve, lus dans la base locale : ils s'affichent en mode avion.
// Sans donnée locale encore (premier passage, avant la synchro), le rendu serveur reste affiché.

export interface SpecialeAffichee {
  id: string
  numero: number
  nom: string
  longueurKm: string | null
  nbPassages: number | null
}

export interface ItemProgrammeAffiche {
  id: string
  type: string
  heurePrevue: string | null
  lieu: string | null
}

const formatHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })

export function ProgrammeHorsLigne({
  eventId,
  specialesInitiales,
  programmeInitial,
}: {
  eventId: string
  specialesInitiales: SpecialeAffichee[]
  programmeInitial: ItemProgrammeAffiche[]
}) {
  const stagesLocaux = useTable("saison_stage")
  const programmeLocal = useTable("saison_schedule_item")

  const speciales: SpecialeAffichee[] = stagesLocaux.some((ligne) => ligne.eventId === eventId)
    ? stagesLocaux
        .filter((ligne) => ligne.eventId === eventId && ligne.deletedAt === null)
        .map((ligne) => ({
          id: ligne.id,
          numero: Number(ligne.numero),
          nom: String(ligne.nom),
          longueurKm: (ligne.longueurKm as string | null | undefined) ?? null,
          nbPassages: (ligne.nbPassages as number | null | undefined) ?? null,
        }))
        .sort((a, b) => a.numero - b.numero)
    : specialesInitiales

  const programme: ItemProgrammeAffiche[] = programmeLocal.some((ligne) => ligne.eventId === eventId)
    ? programmeLocal
        .filter((ligne) => ligne.eventId === eventId && ligne.deletedAt === null)
        .map((ligne) => ({
          id: ligne.id,
          type: String(ligne.type),
          heurePrevue: (ligne.heurePrevue as string | null | undefined) ?? null,
          lieu: (ligne.lieu as string | null | undefined) ?? null,
        }))
        .sort((a, b) => (a.heurePrevue ?? "").localeCompare(b.heurePrevue ?? ""))
    : programmeInitial

  // Même calcul que le serveur : longueur × passages, un passage par défaut.
  const kmTotal = speciales.reduce((total, stage) => total + Number(stage.longueurKm ?? 0) * (stage.nbPassages ?? 1), 0)

  return (
    <div className="flex flex-col gap-6" data-epreuve={eventId}>
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Spéciales</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {speciales.length === 0 && <li className="text-texte-discret">Aucune spéciale saisie.</li>}
          {speciales.map((stage) => (
            <li key={stage.id} className="tabular-nums">
              {stage.numero}. {stage.nom}
              {stage.longueurKm ? ` · ${stage.longueurKm} km` : ""}
              {stage.nbPassages ? ` · ${stage.nbPassages} passage(s)` : ""}
            </li>
          ))}
          <li className="font-medium tabular-nums">Total chronométré : {(Math.round(kmTotal * 10) / 10).toFixed(1)} km</li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Programme du week-end</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {programme.length === 0 && <li className="text-texte-discret">Programme vide.</li>}
          {programme.map((item) => (
            <li key={item.id} className="tabular-nums">
              {item.heurePrevue ? formatHeure.format(new Date(item.heurePrevue)) : "--:--"} · {libelle(LIBELLE_TYPE_PROGRAMME, item.type)}
              {item.lieu ? ` · ${item.lieu}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
