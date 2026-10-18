"use client"

import { useState } from "react"

import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"

// Logo de la team (brief 3.1, section 3.1) : une image, jamais un PDF. L'id part avec le formulaire
// d'identité (champ caché « logoFileId ») ; « Retirer le logo » le vide, l'enregistrement le retire de la team.
const TYPES_LOGO = "image/jpeg,image/png,image/webp,image/svg+xml"

export function ChampLogo({ valeur, disabled }: { valeur: string | null; disabled: boolean }) {
  const [courant, setCourant] = useState<string | null>(valeur)

  return (
    <ChampFichier
      app="settings"
      accept={TYPES_LOGO}
      libelle="Logo de la team"
      valeur={courant}
      typeValeur="image/*"
      onChange={(fichier: FichierEnvoye | null) => setCourant(fichier?.id ?? null)}
      name="logoFileId"
      libelleRetirer="Retirer le logo"
      disabled={disabled}
    />
  )
}
