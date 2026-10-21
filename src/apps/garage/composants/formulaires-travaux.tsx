"use client"

// Tiroir de création d'un ordre de travail (tâche 4.3, §3). Affiché au niveau écriture seulement : l'assistance ne crée
// pas d'ordre. Les personnes se cochent ; l'épreuve « à faire avant » et l'organe sont facultatifs.

import { useRouter } from "next/navigation"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { CHAMP } from "@/lib/classes-formulaire"

import { creerOrdreAction } from "../actions"
import { LIBELLE_PRIORITE, LIBELLE_TYPE_ORDRE, PRIORITES_TRAVAIL, TYPES_ORDRE } from "../travaux"

export interface FormulaireOrdreProps {
  vehicleId: string
  organes: Array<{ id: string; nom: string }>
  epreuves: Array<{ id: string; nom: string; date: string }>
  personnes: Array<{ id: string; nom: string }>
}

export function FormulaireOrdre({ vehicleId, organes, epreuves, personnes }: FormulaireOrdreProps) {
  const router = useRouter()
  return (
    <TiroirAction
      libelle="Nouvel ordre"
      titre="Nouvel ordre de travail"
      action={creerOrdreAction}
      libelleBouton="Créer l'ordre"
      libelleEnCours="Enregistrement…"
      onSucces={() => router.refresh()}
    >
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Titre</span>
        <input name="titre" required maxLength={200} className={CHAMP} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Type</span>
        <select name="type" required defaultValue="reparation" className={CHAMP}>
          {TYPES_ORDRE.map((type) => (
            <option key={type} value={type}>
              {LIBELLE_TYPE_ORDRE[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Organe</span>
        <select name="vehicleComponentId" defaultValue="" className={CHAMP}>
          <option value="">Aucun organe précis</option>
          {organes.map((organe) => (
            <option key={organe.id} value={organe.id}>
              {organe.nom}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Priorité</span>
        <select name="priorite" defaultValue="normale" className={CHAMP}>
          {PRIORITES_TRAVAIL.map((priorite) => (
            <option key={priorite} value={priorite}>
              {LIBELLE_PRIORITE[priorite]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">À faire avant l&apos;épreuve</span>
        <select name="aFaireAvantEventId" defaultValue="" className={CHAMP}>
          <option value="">Pas d&apos;échéance</option>
          {epreuves.map((epreuve) => (
            <option key={epreuve.id} value={epreuve.id}>
              {epreuve.nom} ({epreuve.date})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Durée estimée, en minutes (facultative)</span>
        <input name="dureeEstimeeMinutes" type="number" inputMode="numeric" min={1} step={1} className={CHAMP} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Personnes affectées</legend>
        {personnes.length === 0 ? (
          <p className="text-sm text-texte-discret">Aucune personne dans la team pour l&apos;instant.</p>
        ) : (
          personnes.map((personne) => (
            <label key={personne.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="personIds" value={personne.id} className="h-5 w-5" />
              <span>{personne.nom}</span>
            </label>
          ))
        )}
      </fieldset>
    </TiroirAction>
  )
}
