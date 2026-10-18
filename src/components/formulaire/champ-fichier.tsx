"use client"

import { useId, useRef, useState, type ChangeEvent } from "react"
import { FileText } from "lucide-react"

import { useEtatSynchro } from "@/core/synchro/client/react"
import { LIEN } from "@/lib/classes-formulaire"

import { Message } from "./message"
import { preparerFichier } from "./preparer-fichier"

// Champ d'envoi de fichier (brief 3.1, section 2). L'envoi part dès le choix ; le parent reçoit le fichier
// (id, nom, type) et garde l'id. Sans `name`, rien n'est soumis avec un formulaire : c'est le parent qui décide.
export interface FichierEnvoye {
  id: string
  nom: string
  mimeType: string
  taille: number
}

export const ACCEPT_PAR_DEFAUT = "image/jpeg,image/png,image/webp,application/pdf"

export interface ChampFichierProps {
  app: string
  accept?: string
  libelle: string
  valeur: string | null
  // Type et nom du fichier courant, pour choisir la vignette ou l'icône de document.
  typeValeur?: string | null
  nomValeur?: string | null
  onChange: (fichier: FichierEnvoye | null) => void
  // Nom du champ caché qui porte l'id, pour un formulaire classique (ex. le logo de Réglages).
  name?: string
  // Libellé du bouton qui vide le champ.
  libelleRetirer?: string
  disabled?: boolean
}

export function ChampFichier({
  app,
  accept = ACCEPT_PAR_DEFAUT,
  libelle,
  valeur,
  typeValeur,
  nomValeur,
  onChange,
  name,
  libelleRetirer = "Retirer",
  disabled = false,
}: ChampFichierProps) {
  const identifiant = useId()
  const etat = useEtatSynchro()
  const entree = useRef<HTMLInputElement>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Hors ligne : /api/ n'est pas en cache, l'envoi est impossible. Le champ attend le retour du réseau.
  const horsLigne = !etat.enLigne
  const bloque = disabled || envoi || horsLigne
  const estImage = (typeValeur ?? "image/*").startsWith("image/")

  async function envoyer(fichier: File) {
    setErreur(null)
    setEnvoi(true)
    try {
      const prepare = await preparerFichier(fichier)
      const corps = new FormData()
      corps.append("fichier", prepare)
      corps.append("app", app)
      const reponse = await fetch("/api/fichiers", { method: "POST", body: corps })
      const donnees = await reponse.json().catch(() => null)
      if (!reponse.ok) {
        setErreur(typeof donnees?.message === "string" ? donnees.message : "L'envoi a échoué. Réessaie.")
        return
      }
      onChange(donnees as FichierEnvoye)
    } catch {
      setErreur("L'envoi a échoué. Réessaie.")
    } finally {
      setEnvoi(false)
    }
  }

  function quandChoisi(evenement: ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0]
    // Sans capture : le téléphone propose l'appareil photo ou la galerie.
    if (fichier) void envoyer(fichier)
    evenement.target.value = ""
  }

  function retirer() {
    setErreur(null)
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={identifiant} className="font-medium">
        {libelle}
      </label>

      {valeur && (
        <div className="flex items-center gap-3">
          {estImage ? (
            <img src={`/api/fichiers/${valeur}`} alt="" className="h-16 w-16 rounded border border-bordure object-contain" />
          ) : (
            <span className="flex items-center gap-2 text-sm">
              <FileText className="h-5 w-5 shrink-0" aria-hidden />
              {nomValeur ?? "Fichier joint"}
            </span>
          )}
          <button type="button" onClick={retirer} disabled={envoi || disabled} className={LIEN}>
            {libelleRetirer}
          </button>
        </div>
      )}

      <input
        ref={entree}
        id={identifiant}
        type="file"
        accept={accept}
        onChange={quandChoisi}
        disabled={bloque}
        className="cible-tactile text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2"
      />

      {envoi && (
        <p role="status" className="text-sm text-texte-discret">
          Envoi…
        </p>
      )}
      {horsLigne && !disabled && <p className="text-sm text-etat-orange">La photo s&apos;ajoute quand le réseau revient.</p>}
      <Message resultat={erreur ? { ok: false, message: erreur } : null} />

      {name && <input type="hidden" name={name} value={valeur ?? ""} />}
    </div>
  )
}
