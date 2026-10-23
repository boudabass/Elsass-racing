"use client"

// Tiroirs de la fiche organe (tâche 4.2, §2) : remplacer la pièce, régler l'organe, retirer l'organe. Chacun passe par
// une Server Action gardée ; les messages de refus du service s'affichent tels quels, dans le tiroir.

import { useRouter } from "next/navigation"
import { useState } from "react"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { useEtatSynchro } from "@/core/synchro/client/react"
import { BOUTON_SECONDAIRE, CHAMP } from "@/lib/classes-formulaire"

import { remplacerPieceAction, reglerOrganeAction, reparerOrganeAction, retirerOrganeAction } from "../actions"
import { LIBELLE_DESTINATION_ANCIENNE, LIBELLE_MODE_USURE, LIBELLE_MOTIF_DEPOSE, LIBELLE_QUALITE, type MotifDepose } from "../libelles"
import { DESTINATIONS_ANCIENNE, type ModeUsure } from "../regles"
import type { PieceAtelier } from "../vues"

const MOTIFS = Object.keys(LIBELLE_MOTIF_DEPOSE) as MotifDepose[]

// --- Réparer ---------------------------------------------------------------------------------

interface FormulaireReparerProps {
  organeId: string
  nom: string
  vehicleId: string
}

// Un ordre de travail de type réparation, à faire : sa clôture demande l'état de la pièce (954 v1.3, §4). Coût facultatif,
// visible dans le tiroir. Hors ligne, le bouton reste visible, désactivé, avec la raison : la réparation se saisit en ligne.
export function FormulaireReparer({ organeId, nom, vehicleId }: FormulaireReparerProps) {
  const router = useRouter()
  const etat = useEtatSynchro()

  if (!etat.enLigne) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button type="button" disabled className={`${BOUTON_SECONDAIRE} opacity-60`}>
          Réparer
        </button>
        <p className="text-sm text-texte-discret">La réparation se saisit en ligne.</p>
      </div>
    )
  }

  return (
    <TiroirAction
      libelle="Réparer"
      titre={`Réparer : ${nom}`}
      action={reparerOrganeAction}
      libelleBouton="Ajouter la réparation"
      libelleEnCours="Enregistrement…"
      onSucces={() => router.push(`/apps/garage/travaux?vehicule=${vehicleId}`)}
    >
      <input type="hidden" name="organeId" value={organeId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Ce qui est réparé</span>
        <input name="titre" required maxLength={200} placeholder={`Réparation : ${nom.toLowerCase()}`} className={CHAMP} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Main-d&apos;œuvre, en euros (facultatif)</span>
        <input name="coutMainOeuvre" inputMode="decimal" placeholder="0,00" className={CHAMP} />
      </label>
      <p className="text-sm text-texte-discret">
        L&apos;ordre passe dans les travaux. Sa fin demandera l&apos;état de la pièce après réparation.
      </p>
    </TiroirAction>
  )
}
const MODES = Object.keys(LIBELLE_MODE_USURE) as ModeUsure[]

// --- Remplacer -------------------------------------------------------------------------------

interface FormulaireRemplacerProps {
  organeId: string
  nom: string
  // Une pièce est montée : elle part avec un motif de dépose et une destination.
  pieceEnPlace: boolean
  rechanges: PieceAtelier[]
  fournisseurs: Array<{ id: string; nom: string }>
}

type SourcePiece = "rechange" | "nouvelle"

// Remplacer (954 v1.2, §2) : une rechange du stock, ou une nouvelle pièce. Avec un prix, la nouvelle pièce est achetée et
// reçue tout de suite (Budget la reçoit). Si une pièce est en place, son motif et ce qu'elle devient sont demandés, sans
// valeur par défaut. Sans rechange, la voie « nouvelle pièce » reste ouverte : le bouton n'est jamais bloqué.
export function FormulaireRemplacer({ organeId, nom, pieceEnPlace, rechanges, fournisseurs }: FormulaireRemplacerProps) {
  const router = useRouter()
  const libelle = pieceEnPlace ? "Remplacer" : "Poser une pièce"
  const [source, setSource] = useState<SourcePiece>(rechanges.length > 0 ? "rechange" : "nouvelle")
  const [prix, setPrix] = useState("")
  const fournisseurRequis = prix.trim() !== ""

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
      {rechanges.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Pièce posée</span>
          <select name="source" value={source} onChange={(evenement) => setSource(evenement.target.value as SourcePiece)} className={CHAMP}>
            <option value="rechange">Une rechange du stock</option>
            <option value="nouvelle">Une nouvelle pièce</option>
          </select>
        </label>
      )}

      {source === "rechange" ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Pièce de rechange</span>
          <select name="partId" required defaultValue={rechanges[0]?.id} className={CHAMP}>
            {rechanges.map((piece) => (
              <option key={piece.id} value={piece.id}>
                {piece.designation}
                {piece.marque ? ` · ${piece.marque}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          {rechanges.length === 0 && <input type="hidden" name="source" value="nouvelle" />}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Désignation</span>
            <input name="designation" required maxLength={200} className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Marque (facultatif)</span>
            <input name="marque" maxLength={120} className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Qualité</span>
            <select name="qualite" defaultValue="origine" className={CHAMP}>
              {Object.entries(LIBELLE_QUALITE).map(([cle, texte]) => (
                <option key={cle} value={cle}>
                  {texte}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Prix, en euros (facultatif)</span>
            <input
              name="prixCents"
              inputMode="decimal"
              placeholder="0,00"
              value={prix}
              onChange={(evenement) => setPrix(evenement.target.value)}
              className={CHAMP}
            />
            <span className="text-texte-discret">Un prix passe par une commande reçue tout de suite, et ouvre une dépense côté Budget.</span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Fournisseur{fournisseurRequis ? "" : " (facultatif)"}</span>
            <select name="fournisseurContactId" required={fournisseurRequis} defaultValue="" className={CHAMP}>
              <option value="">Aucun</option>
              {fournisseurs.map((fournisseur) => (
                <option key={fournisseur.id} value={fournisseur.id}>
                  {fournisseur.nom}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Durée en kilomètres (facultatif)</span>
              <input name="dureeVieKm" inputMode="numeric" className={CHAMP} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Durée en épreuves (facultatif)</span>
              <input name="dureeVieEpreuves" inputMode="numeric" className={CHAMP} />
            </label>
          </div>
        </>
      )}

      {pieceEnPlace && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Motif de dépose de la pièce en place</span>
            <select name="motifDepose" required defaultValue="" className={CHAMP}>
              <option value="" disabled>
                Choisir le motif
              </option>
              {MOTIFS.map((motif) => (
                <option key={motif} value={motif}>
                  {LIBELLE_MOTIF_DEPOSE[motif]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Ce que devient l&apos;ancienne pièce</span>
            <select name="destinationAncienne" required defaultValue="" className={CHAMP}>
              <option value="" disabled>
                Choisir la destination
              </option>
              {DESTINATIONS_ANCIENNE.map((destination) => (
                <option key={destination} value={destination}>
                  {LIBELLE_DESTINATION_ANCIENNE[destination]}
                </option>
              ))}
            </select>
          </label>
        </>
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
