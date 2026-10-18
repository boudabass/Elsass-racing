"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"
import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON, BOUTON_SECONDAIRE, CHAMP } from "@/lib/classes-formulaire"

import { creerPapierAction, modifierPapierAction, supprimerPapierAction } from "../actions"
import { LIBELLE_TYPE_PAPIER, type TypePapier } from "../libelles"

export interface ValeursPapier {
  id?: string
  type: TypePapier
  libelle: string
  numero: string
  delivreLe: string
  valableJusquAu: string
  documentFileId: string | null
  documentNom: string | null
}

const TYPES = Object.keys(LIBELLE_TYPE_PAPIER) as TypePapier[]

// Ajout (sans `papier`) ou modification d'un papier. Le libellé n'apparaît que pour « Autre ».
export function FormulairePapier({ vehicleId, papier }: { vehicleId: string; papier?: ValeursPapier }) {
  const router = useRouter()
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(papier ? modifierPapierAction : creerPapierAction, null)
  const [type, setType] = useState<TypePapier>(papier?.type ?? "assurance")
  const [document, setDocument] = useState<string | null>(papier?.documentFileId ?? null)

  // Après un enregistrement réussi, la liste des papiers est relue (statuts et tri à jour).
  useEffect(() => {
    if (resultat?.ok) router.refresh()
  }, [resultat, router])

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      {papier?.id && <input type="hidden" name="papierId" value={papier.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Type de papier</span>
          <select name="type" value={type} onChange={(evenement) => setType(evenement.target.value as TypePapier)} className={CHAMP}>
            {TYPES.map((choix) => (
              <option key={choix} value={choix}>
                {LIBELLE_TYPE_PAPIER[choix]}
              </option>
            ))}
          </select>
        </label>

        {type === "autre" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Libellé</span>
            <input name="libelle" required defaultValue={papier?.libelle} maxLength={120} className={CHAMP} />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Numéro</span>
          <input name="numero" defaultValue={papier?.numero} maxLength={60} className={CHAMP} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Délivré le</span>
          <input name="delivreLe" type="date" defaultValue={papier?.delivreLe} className={CHAMP} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Valable jusqu&apos;au</span>
          <input name="valableJusquAu" type="date" defaultValue={papier?.valableJusquAu} className={CHAMP} />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <ChampFichier
          app="voiture"
          libelle="Document"
          name="documentFileId"
          valeur={document}
          nomValeur={papier?.documentNom ?? null}
          onChange={(fichier: FichierEnvoye | null) => setDocument(fichier?.id ?? null)}
          libelleRetirer="Retirer le document"
        />
      </div>

      <div className="flex flex-col gap-3">
        <button type="submit" disabled={enCours} className={`${BOUTON} w-full sm:w-auto`}>
          {papier ? "Enregistrer le papier" : "Ajouter le papier"}
        </button>
        <Message resultat={resultat} ok={papier ? "Papier enregistré." : "Papier ajouté."} />
      </div>
    </form>
  )
}

// Suppression d'un papier : sans `confirm()` du navigateur, la confirmation se fait sur la page.
export function SupprimerPapier({ papierId }: { papierId: string }) {
  const router = useRouter()
  const [demande, setDemande] = useState(false)
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(supprimerPapierAction, null)

  useEffect(() => {
    if (resultat?.ok) router.refresh()
  }, [resultat, router])

  if (!demande) {
    return (
      <button type="button" onClick={() => setDemande(true)} className="cible-tactile self-start text-sm text-etat-rouge underline underline-offset-4">
        Supprimer
      </button>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-2 text-sm">
      <input type="hidden" name="papierId" value={papierId} />
      <p>Supprimer ce papier ? Il disparaît de la liste.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enCours} className={BOUTON_SECONDAIRE}>
          Confirmer la suppression
        </button>
        <button type="button" onClick={() => setDemande(false)} className={BOUTON_SECONDAIRE}>
          Annuler
        </button>
      </div>
      <Message resultat={resultat} ok="Papier supprimé." />
    </form>
  )
}
