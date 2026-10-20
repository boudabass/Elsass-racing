"use client"

// Logo du partenaire (brief 3.7, point 0) : ouvert par « Changer le logo » dans un tiroir (brief 3.13b). Il s'enregistre dès que le fichier est envoyé, comme le logo de la team
// dans Réglages, sans bouton. « Retirer le logo » enregistre aussi, sans logo. Le message de résultat est sous le champ.

import { startTransition, useActionState, useState } from "react"

import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"
import { Message } from "@/components/formulaire/message"
import { Tiroir } from "@/components/formulaire/tiroir"
import { BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

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

// Le bouton de la fiche : il ouvre le tiroir qui contient le champ du logo. Le tiroir se ferme par « Fermer ».
export function TiroirLogo({ partnerId, logoFileId }: { partnerId: string; logoFileId: string | null }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOuvert(true)} className={BOUTON_SECONDAIRE}>
        {logoFileId ? "Changer le logo" : "Ajouter un logo"}
      </button>
      <Tiroir ouvert={ouvert} onOuvertChange={setOuvert} titre="Logo du partenaire" libelleAnnuler="Fermer">
        <FormulaireLogo partnerId={partnerId} logoFileId={logoFileId} />
      </Tiroir>
    </>
  )
}
