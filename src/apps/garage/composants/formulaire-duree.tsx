"use client"

import { useRouter } from "next/navigation"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { CHAMP } from "@/lib/classes-formulaire"

import { renseignerDureeVieAction } from "../actions"
import type { ModeUsure } from "../regles"

interface FormulaireDureeProps {
  organeId: string
  nom: string
  mode: ModeUsure
  dureeKm: number | null
  dureeEpreuves: number | null
}

// Durée de vie de référence d'un organe, dans un tiroir (brief 4.2, §1). Le mode d'usure choisit les champs montrés.
export function FormulaireDuree({ organeId, nom, mode, dureeKm, dureeEpreuves }: FormulaireDureeProps) {
  const router = useRouter()
  const avecKm = mode !== "epreuves"
  const avecEpreuves = mode !== "km"
  return (
    <TiroirAction
      libelle="Renseigner la durée de vie"
      titre={`Durée de vie : ${nom}`}
      action={renseignerDureeVieAction}
      libelleBouton="Enregistrer la durée"
      libelleEnCours="Enregistrement…"
      onSucces={() => router.refresh()}
    >
      <input type="hidden" name="organeId" value={organeId} />
      {avecKm && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Durée en kilomètres</span>
          <input name="dureeVieReferenceKm" type="number" inputMode="numeric" min={1} step={1} defaultValue={dureeKm ?? ""} className={CHAMP} />
        </label>
      )}
      {avecEpreuves && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Durée en épreuves</span>
          <input name="dureeVieReferenceEpreuves" type="number" inputMode="numeric" min={1} step={1} defaultValue={dureeEpreuves ?? ""} className={CHAMP} />
        </label>
      )}
    </TiroirAction>
  )
}
