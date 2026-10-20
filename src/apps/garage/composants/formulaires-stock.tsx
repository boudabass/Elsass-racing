"use client"

// Tiroirs du stock et de la fiche pièce (tâche 4.2, §3) : ajouter une pièce, changer son statut à la main. Le prix et le
// fournisseur n'apparaissent qu'au niveau écriture (fournisseurs fourni) : l'assistance ne les voit nulle part.

import { useRouter } from "next/navigation"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { CHAMP } from "@/lib/classes-formulaire"

import { changerStatutPieceAction, creerPieceAction } from "../actions"
import { LIBELLE_QUALITE, LIBELLE_STATUT_PIECE } from "../libelles"

// Statuts qu'on choisit à la main (le statut « montée » vient de la pose, jamais d'un choix).
const STATUTS_MANUELS = ["en_stock", "en_revision", "usee", "cassee", "vendue"] as const

interface FormulairePieceProps {
  vehicleId: string
  organes: Array<{ componentTypeId: string; nom: string }>
  // Présents seulement au niveau écriture : sans eux, pas de champ prix ni fournisseur.
  fournisseurs?: Array<{ id: string; nom: string }>
  // Organe préchoisi (par exemple depuis la fiche d'un organe).
  organeDefaut?: string
}

// Les champs d'un ajout de pièce : partagés par le tiroir du stock et la page « Pièce » du bouton +. Sans durée de vie,
// la pièce prend celle de l'organe.
export function ChampsPiece({ vehicleId, organes, fournisseurs, organeDefaut }: FormulairePieceProps) {
  const avecFinances = fournisseurs !== undefined
  return (
    <>
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Organe</span>
        <select name="componentTypeId" required defaultValue={organeDefaut ?? organes[0]?.componentTypeId} className={CHAMP}>
          {organes.map((organe) => (
            <option key={organe.componentTypeId} value={organe.componentTypeId}>
              {organe.nom}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Désignation</span>
        <input name="designation" required maxLength={200} className={CHAMP} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Marque</span>
          <input name="marque" maxLength={120} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Référence</span>
          <input name="reference" maxLength={120} className={CHAMP} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Qualité</span>
        <select name="qualite" defaultValue="origine" className={CHAMP}>
          {Object.entries(LIBELLE_QUALITE).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Durée de vie de la pièce (facultative)</legend>
        <p className="text-sm text-texte-discret">Sans durée de vie, on prend celle de l&apos;organe.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">En kilomètres</span>
            <input name="dureeVieKm" type="number" inputMode="numeric" min={1} step={1} className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">En épreuves</span>
            <input name="dureeVieEpreuves" type="number" inputMode="numeric" min={1} step={1} className={CHAMP} />
          </label>
        </div>
      </fieldset>
      {avecFinances && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Prix (€)</span>
            <input name="prixCents" inputMode="decimal" placeholder="12,50" className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Fournisseur</span>
            <select name="fournisseurContactId" defaultValue="" className={CHAMP}>
              <option value="">Aucun</option>
              {fournisseurs.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.nom}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Emplacement</span>
        <input name="emplacement" maxLength={120} placeholder="Atelier, remorque…" className={CHAMP} />
      </label>
    </>
  )
}

// Ajouter une pièce au stock, dans un tiroir.
export function FormulairePiece(props: FormulairePieceProps) {
  const router = useRouter()
  return (
    <TiroirAction
      libelle="Ajouter une pièce"
      titre="Ajouter une pièce"
      action={creerPieceAction}
      libelleBouton="Ajouter la pièce"
      libelleEnCours="Enregistrement…"
      onSucces={() => router.refresh()}
    >
      <ChampsPiece {...props} />
    </TiroirAction>
  )
}

// Changer le statut à la main. Une pièce montée n'a pas ce choix : c'est la fiche de l'organe qui la déplace.
export function FormulaireStatut({ partId, statut }: { partId: string; statut: string }) {
  const router = useRouter()
  return (
    <TiroirAction
      libelle="Changer le statut"
      titre="Changer le statut"
      action={changerStatutPieceAction}
      libelleBouton="Enregistrer le statut"
      libelleEnCours="Enregistrement…"
      onSucces={() => router.refresh()}
    >
      <input type="hidden" name="partId" value={partId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Statut</span>
        <select name="statut" defaultValue={statut} className={CHAMP}>
          {STATUTS_MANUELS.map((choix) => (
            <option key={choix} value={choix}>
              {LIBELLE_STATUT_PIECE[choix]}
            </option>
          ))}
        </select>
      </label>
    </TiroirAction>
  )
}
