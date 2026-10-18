"use client"

// Logo du partenaire (brief 3.7, point 0) : il s'enregistre dès que le fichier est envoyé, comme le logo de la team
// dans Réglages, sans bouton. « Retirer le logo » enregistre aussi, sans logo. Le message de résultat est sous le champ.

import { startTransition, useActionState, useState } from "react"

import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"
import { Message } from "@/components/formulaire/message"

import { poserLogoAction } from "../actions"

const TYPES_LOGO = "image/jpeg,image/png,image/webp,image/svg+xml"

export function FormulaireLogo({ partnerId, logoFileId }: { partnerId: string; logoFileId: string | null }) {
  const [valeur, setValeur] = useState<string | null>(logoFileId)
  const [resultat, envoyer] = useActionState(poserLogoAction, null)

  function quandChange(fichier: FichierEnvoye | null) {
    setValeur(fichier?.id ?? null)
    const donnees = new FormData()
    donnees.set("partnerId", partnerId)
    donnees.set("fileId", fichier?.id ?? "")
    startTransition(() => envoyer(donnees))
  }

  return (
    <div className="flex flex-col gap-3">
      <ChampFichier
        app="partenaires"
        accept={TYPES_LOGO}
        libelle="Image (JPEG, PNG, WebP ou SVG)"
        valeur={valeur}
        typeValeur="image/*"
        onChange={quandChange}
        libelleRetirer="Retirer le logo"
      />
      <Message resultat={resultat} />
    </div>
  )
}
