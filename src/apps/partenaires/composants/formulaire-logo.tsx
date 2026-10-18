"use client"

// Logo du partenaire : un ChampFichier (JPEG, PNG, WebP ou SVG) et son enregistrement. L'identifiant du fichier
// est gardé ici, car ChampFichier attend sa valeur du parent.

import { useState } from "react"

import { ChampFichier } from "@/components/formulaire/champ-fichier"

import { poserLogoAction } from "../actions"
import { BoutonEnvoi, FormulaireAction } from "./formulaire"

const TYPES_LOGO = "image/jpeg,image/png,image/webp,image/svg+xml"

export function FormulaireLogo({ partnerId, logoFileId }: { partnerId: string; logoFileId: string | null }) {
  const [valeur, setValeur] = useState<string | null>(logoFileId)
  return (
    <FormulaireAction action={poserLogoAction} nom="Logo du partenaire" className="flex flex-col gap-3">
      <input type="hidden" name="partnerId" value={partnerId} />
      <ChampFichier
        app="partenaires"
        accept={TYPES_LOGO}
        libelle="Logo"
        valeur={valeur}
        typeValeur="image/*"
        name="fileId"
        onChange={(fichier) => setValeur(fichier?.id ?? null)}
      />
      <div>
        <BoutonEnvoi libelle="Enregistrer le logo" secondaire />
      </div>
    </FormulaireAction>
  )
}
