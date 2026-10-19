"use client"

// Documents d'une convention : la signature (date, signataires, document signé) et un avenant (date, motif,
// changements, document facultatif). Les fichiers passent par ChampFichier, comme les autres envois de la team.

import { useState } from "react"

import { ChampFichier } from "@/components/formulaire/champ-fichier"
import { CHAMP } from "@/lib/classes-formulaire"

import { Champ } from "./formulaire"

export function ChampsSignature({ agreementId, aujourdhui }: { agreementId: string; aujourdhui: string }) {
  const [fichier, setFichier] = useState<string | null>(null)
  return (
    <>
      <input type="hidden" name="agreementId" value={agreementId} />
      <Champ id={`signee-${agreementId}`} libelle="Date de signature">
        <input id={`signee-${agreementId}`} name="signeeLe" type="date" required defaultValue={aujourdhui} className={CHAMP} />
      </Champ>
      <Champ id={`signataires-${agreementId}`} libelle="Signataires" aide="Les noms et qualités de ceux qui ont signé.">
        <input id={`signataires-${agreementId}`} name="signataires" required maxLength={300} className={CHAMP} aria-describedby={`signataires-${agreementId}-aide`} />
      </Champ>
      <ChampFichier app="partenaires" libelle="Document signé" valeur={fichier} name="documentSigneFileId" onChange={(f) => setFichier(f?.id ?? null)} />
    </>
  )
}

export function ChampsAvenant({ agreementId, aujourdhui }: { agreementId: string; aujourdhui: string }) {
  const [fichier, setFichier] = useState<string | null>(null)
  return (
    <>
      <input type="hidden" name="agreementId" value={agreementId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ id={`avenant-date-${agreementId}`} libelle="Date">
          <input id={`avenant-date-${agreementId}`} name="date" type="date" required defaultValue={aujourdhui} className={CHAMP} />
        </Champ>
        <Champ id={`avenant-signe-${agreementId}`} libelle="Signé le">
          <input id={`avenant-signe-${agreementId}`} name="signeLe" type="date" className={CHAMP} />
        </Champ>
      </div>
      <Champ id={`avenant-motif-${agreementId}`} libelle="Motif">
        <input id={`avenant-motif-${agreementId}`} name="motif" required maxLength={300} className={CHAMP} />
      </Champ>
      <Champ id={`avenant-changements-${agreementId}`} libelle="Changements">
        <textarea id={`avenant-changements-${agreementId}`} name="changements" required rows={3} maxLength={4000} className={CHAMP} />
      </Champ>
      <ChampFichier app="partenaires" libelle="Document de l'avenant" valeur={fichier} name="documentFileId" onChange={(f) => setFichier(f?.id ?? null)} />
    </>
  )
}
