"use client"

import { useActionState, useState, useTransition } from "react"

import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"
import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON, CHAMP } from "@/lib/classes-formulaire"

import { modifierFicheAction, poserPhotoPrincipaleAction } from "../actions"

export interface ValeursIdentite {
  marque: string
  modele: string
  version: string
  annee: string
  cylindreeCm3: string
  puissanceCh: string
  poidsKg: string
  couleur: string
  groupe: string
  classe: string
  discipline: string
  immatriculation: string
  numeroSerie: string
  acheteLe: string
}

const CHAMPS_VEHICULE: Array<{ cle: keyof ValeursIdentite; libelle: string; type?: string; min?: number; max?: number }> = [
  { cle: "marque", libelle: "Marque" },
  { cle: "modele", libelle: "Modèle" },
  { cle: "version", libelle: "Version" },
  { cle: "annee", libelle: "Année", type: "number", min: 1900, max: 2100 },
  { cle: "cylindreeCm3", libelle: "Cylindrée (cm³)", type: "number", min: 0 },
  { cle: "puissanceCh", libelle: "Puissance (ch)", type: "number", min: 0 },
  { cle: "poidsKg", libelle: "Poids (kg)", type: "number", min: 0 },
  { cle: "couleur", libelle: "Couleur" },
  { cle: "groupe", libelle: "Groupe" },
  { cle: "classe", libelle: "Classe" },
  { cle: "discipline", libelle: "Discipline" },
]

const CHAMPS_PAPIERS: Array<{ cle: keyof ValeursIdentite; libelle: string; type?: string }> = [
  { cle: "immatriculation", libelle: "Immatriculation" },
  { cle: "numeroSerie", libelle: "Numéro de série" },
  { cle: "acheteLe", libelle: "Date d'achat", type: "date" },
]

// Identité en écriture : les champs de voiture_vehicle, en deux blocs. Enregistrer appelle modifierFicheAction.
export function FormulaireIdentite({ vehicleId, valeurs }: { vehicleId: string; valeurs: ValeursIdentite }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(modifierFicheAction, null)

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <fieldset className="flex flex-col gap-4">
        <legend className="font-titre text-lg uppercase">Le véhicule</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {CHAMPS_VEHICULE.map((champ) => (
            <label key={champ.cle} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{champ.libelle}</span>
              <input name={champ.cle} type={champ.type ?? "text"} defaultValue={valeurs[champ.cle]} min={champ.min} max={champ.max} inputMode={champ.type === "number" ? "numeric" : undefined} className={CHAMP} />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-titre text-lg uppercase">Papiers et homologation</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {CHAMPS_PAPIERS.map((champ) => (
            <label key={champ.cle} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{champ.libelle}</span>
              <input name={champ.cle} type={champ.type ?? "text"} defaultValue={valeurs[champ.cle]} className={CHAMP} />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <button type="submit" disabled={enCours} className={`${BOUTON} w-full sm:w-auto`}>
          Enregistrer
        </button>
        <Message resultat={resultat} />
      </div>
    </form>
  )
}

// Photo principale : la photo des cartes. Le fichier part dès le choix, puis la photo est posée.
export function PhotoPrincipale({ vehicleId, fileId, peutModifier }: { vehicleId: string; fileId: string | null; peutModifier: boolean }) {
  const [photo, setPhoto] = useState<string | null>(fileId)
  const [resultat, setResultat] = useState<Resultat | null>(null)
  const [enCours, demarrer] = useTransition()

  function changer(fichier: FichierEnvoye | null) {
    const donnees = new FormData()
    donnees.set("vehicleId", vehicleId)
    donnees.set("fileId", fichier?.id ?? "")
    demarrer(async () => {
      const retour = await poserPhotoPrincipaleAction(null, donnees)
      setResultat(retour)
      if (retour.ok) setPhoto(fichier?.id ?? null)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {peutModifier ? (
        <ChampFichier app="voiture" accept="image/jpeg,image/png,image/webp" libelle="Photo principale" valeur={photo} typeValeur="image/jpeg" onChange={changer} libelleRetirer="Retirer la photo" disabled={enCours} />
      ) : photo ? (
        <img src={`/api/fichiers/${photo}`} alt="Photo principale du véhicule" className="aspect-video w-full max-w-md rounded-lg object-cover" />
      ) : (
        <p className="text-sm text-texte-discret">Aucune photo principale.</p>
      )}
      <Message resultat={resultat} ok="Photo mise à jour." />
    </div>
  )
}
