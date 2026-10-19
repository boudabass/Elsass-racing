"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"
import { TiroirAction } from "@/components/formulaire/tiroir"
import { CHAMP } from "@/lib/classes-formulaire"

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

// Ajout (sans `papier`) ou modification d'un papier, dans un tiroir (brief 3.13b). La liste est relue après réussite.
export function FormulairePapier({ vehicleId, papier }: { vehicleId: string; papier?: ValeursPapier }) {
  const router = useRouter()
  return (
    <TiroirAction
      libelle={papier ? "Modifier" : "Ajouter un papier"}
      titre={papier ? "Modifier le papier" : "Ajouter un papier"}
      action={papier ? modifierPapierAction : creerPapierAction}
      libelleBouton={papier ? "Enregistrer le papier" : "Ajouter le papier"}
      libelleEnCours="Enregistrement…"
      secondaire={!!papier}
      onSucces={() => router.refresh()}
    >
      <input type="hidden" name="vehicleId" value={vehicleId} />
      {papier?.id && <input type="hidden" name="papierId" value={papier.id} />}
      <CorpsPapier papier={papier} />
    </TiroirAction>
  )
}

// Champs du papier. Montés à chaque ouverture du tiroir : le type et le document repartent des valeurs du papier.
function CorpsPapier({ papier }: { papier?: ValeursPapier }) {
  const [type, setType] = useState<TypePapier>(papier?.type ?? "assurance")
  const [document, setDocument] = useState<string | null>(papier?.documentFileId ?? null)

  return (
    <>
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

      <ChampFichier
        app="voiture"
        libelle="Document"
        name="documentFileId"
        valeur={document}
        nomValeur={papier?.documentNom ?? null}
        onChange={(fichier: FichierEnvoye | null) => setDocument(fichier?.id ?? null)}
        libelleRetirer="Retirer le document"
      />
    </>
  )
}

// Suppression d'un papier : un tiroir de confirmation, sans `confirm()` du navigateur.
export function SupprimerPapier({ papierId }: { papierId: string }) {
  const router = useRouter()
  return (
    <TiroirAction
      libelle="Supprimer"
      titre="Supprimer ce papier"
      action={supprimerPapierAction}
      libelleBouton="Confirmer la suppression"
      libelleEnCours="Suppression…"
      danger
      question="Supprimer ce papier ? Il disparaît de la liste."
      onSucces={() => router.refresh()}
    >
      <input type="hidden" name="papierId" value={papierId} />
    </TiroirAction>
  )
}
