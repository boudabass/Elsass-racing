"use client"

// Tiroirs de la fiche organe (tâche 4.2, §2) : remplacer la pièce, régler l'organe, retirer l'organe. Chacun passe par
// une Server Action gardée ; les messages de refus du service s'affichent tels quels, dans le tiroir.

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { BOUTON_SECONDAIRE, CHAMP, LIEN } from "@/lib/classes-formulaire"

import { remplacerPieceAction, reglerOrganeAction, retirerOrganeAction } from "../actions"
import { LIBELLE_MODE_USURE, LIBELLE_MOTIF_DEPOSE, type MotifDepose } from "../libelles"
import type { ModeUsure } from "../regles"
import type { PieceAtelier } from "../vues"

const MOTIFS = Object.keys(LIBELLE_MOTIF_DEPOSE) as MotifDepose[]
const MODES = Object.keys(LIBELLE_MODE_USURE) as ModeUsure[]

// --- Remplacer -------------------------------------------------------------------------------

interface FormulaireRemplacerProps {
  organeId: string
  nom: string
  // Une pièce est montée : elle part avec un motif de dépose.
  pieceEnPlace: boolean
  rechanges: PieceAtelier[]
}

// Choisit une rechange en stock et, s'il y a une pièce en place, son motif de dépose. Sans rechange, le bouton reste
// visible, désactivé, avec la raison et le lien vers le stock.
export function FormulaireRemplacer({ organeId, nom, pieceEnPlace, rechanges }: FormulaireRemplacerProps) {
  const router = useRouter()
  const libelle = pieceEnPlace ? "Remplacer" : "Poser une pièce"

  if (rechanges.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button type="button" disabled className={`${BOUTON_SECONDAIRE} opacity-60`}>
          {libelle}
        </button>
        <p className="text-sm text-texte-discret">
          Aucune pièce de rechange pour cet organe. <Link href="/apps/garage/stock" className={LIEN}>Ajoutez-en une au stock.</Link>
        </p>
      </div>
    )
  }

  return (
    <TiroirAction
      libelle={libelle}
      titre={`${libelle} : ${nom}`}
      action={remplacerPieceAction}
      libelleBouton={pieceEnPlace ? "Remplacer la pièce" : "Poser la pièce"}
      libelleEnCours="Enregistrement…"
      onSucces={() => router.refresh()}
    >
      <input type="hidden" name="organeId" value={organeId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Pièce de rechange</span>
        <select name="partId" required defaultValue={rechanges[0].id} className={CHAMP}>
          {rechanges.map((piece) => (
            <option key={piece.id} value={piece.id}>
              {piece.designation}
              {piece.marque ? ` · ${piece.marque}` : ""}
            </option>
          ))}
        </select>
      </label>
      {pieceEnPlace && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Motif de dépose de la pièce en place</span>
          <select name="motifDepose" required defaultValue="usure" className={CHAMP}>
            {MOTIFS.map((motif) => (
              <option key={motif} value={motif}>
                {LIBELLE_MOTIF_DEPOSE[motif]}
              </option>
            ))}
          </select>
        </label>
      )}
    </TiroirAction>
  )
}

// --- Régler l'organe -------------------------------------------------------------------------

export interface ValeursReglage {
  organeId: string
  nom: string
  mode: ModeUsure
  dureeKm: number | null
  dureeEpreuves: number | null
  seuilOrange: number
  seuilRouge: number
  position: string | null
}

// Mode d'usure, durées de référence, seuils et position. Le mode choisit les durées montrées.
export function FormulaireRegler({ valeurs }: { valeurs: ValeursReglage }) {
  const router = useRouter()
  const [mode, setMode] = useState<ModeUsure>(valeurs.mode)
  const avecKm = mode !== "epreuves"
  const avecEpreuves = mode !== "km"

  return (
    <TiroirAction
      libelle="Régler l'organe"
      titre={`Réglages : ${valeurs.nom}`}
      action={reglerOrganeAction}
      libelleBouton="Enregistrer les réglages"
      libelleEnCours="Enregistrement…"
      onSucces={() => router.refresh()}
    >
      <input type="hidden" name="organeId" value={valeurs.organeId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Mode d&apos;usure</span>
        <select name="modeUsure" value={mode} onChange={(e) => setMode(e.target.value as ModeUsure)} className={CHAMP}>
          {MODES.map((choix) => (
            <option key={choix} value={choix}>
              {LIBELLE_MODE_USURE[choix]}
            </option>
          ))}
        </select>
      </label>
      {avecKm && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Durée de référence en kilomètres</span>
          <input name="dureeVieReferenceKm" type="number" inputMode="numeric" min={1} step={1} defaultValue={valeurs.dureeKm ?? ""} className={CHAMP} />
        </label>
      )}
      {avecEpreuves && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Durée de référence en épreuves</span>
          <input name="dureeVieReferenceEpreuves" type="number" inputMode="numeric" min={1} step={1} defaultValue={valeurs.dureeEpreuves ?? ""} className={CHAMP} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Seuil orange (%)</span>
        <input name="seuilOrangePct" type="number" inputMode="numeric" min={0} max={100} step={1} defaultValue={valeurs.seuilOrange} className={CHAMP} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Seuil rouge (%)</span>
        <input name="seuilRougePct" type="number" inputMode="numeric" min={0} max={100} step={1} defaultValue={valeurs.seuilRouge} className={CHAMP} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Position sur la voiture</span>
        <input name="position" maxLength={60} defaultValue={valeurs.position ?? ""} className={CHAMP} />
      </label>
    </TiroirAction>
  )
}

// --- Retirer ---------------------------------------------------------------------------------

// Retirer l'organe. Sans droit d'écriture, ou avec une pièce montée, le bouton reste visible et désactivé, avec la raison.
export function FormulaireRetirer({ organeId, vehicleId, piece, peutEcrire }: { organeId: string; vehicleId: string; piece: boolean; peutEcrire: boolean }) {
  const router = useRouter()
  if (!peutEcrire || piece) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button type="button" disabled className={`${BOUTON_SECONDAIRE} opacity-60`}>
          Retirer l&apos;organe
        </button>
        <p className="text-sm text-texte-discret">
          {!peutEcrire ? "Seul l'équipage peut retirer un organe." : "Déposez la pièce montée avant de retirer l'organe."}
        </p>
      </div>
    )
  }
  return (
    <TiroirAction
      libelle="Retirer l'organe"
      titre="Retirer l'organe"
      question="L'organe disparaît de l'atelier. Ses pièces et leur historique restent conservés."
      danger
      action={retirerOrganeAction}
      libelleBouton="Retirer l'organe"
      libelleEnCours="Retrait…"
      onSucces={() => router.push(`/apps/garage?vehicule=${vehicleId}`)}
    >
      <input type="hidden" name="organeId" value={organeId} />
    </TiroirAction>
  )
}
