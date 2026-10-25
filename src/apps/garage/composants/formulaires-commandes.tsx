"use client"

// Nouvelle commande (tâche 4.3, brief §5). Une page entière, qui finit comme un tiroir : la barre du bas envoie, « Annuler »
// quitte. Cinq lignes au plus ; une ligne vide est ignorée par le serveur, une ligne remplie doit avoir son organe.

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { FormulairePage } from "@/components/formulaire/formulaire-page"
import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { CHAMP } from "@/lib/classes-formulaire"

import { creerCommandeAction } from "../actions"
import { LIBELLE_QUALITE } from "../libelles"

const LIGNES = [1, 2, 3, 4, 5]

export interface FormulaireCommandeProps {
  vehicleId: string
  fournisseurs: Array<{ id: string; nom: string }>
  types: Array<{ id: string; nom: string }>
  // Date de Paris, « AAAA-MM-JJ », proposée pour la date de commande.
  aujourdhui: string
}

export function FormulaireCommande({ vehicleId, fournisseurs, types, aujourdhui }: FormulaireCommandeProps) {
  const router = useRouter()
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(creerCommandeAction, null)
  const retour = `/apps/garage/commandes?vehicule=${vehicleId}`

  useEffect(() => {
    if (resultat?.ok) router.push(retour)
  }, [resultat, retour, router])

  return (
    <FormulairePage formulaireId="commande-formulaire" annulerHref={retour} libelleBouton="Enregistrer la commande" libelleEnCours="Enregistrement…" enCours={enCours}>
      <form id="commande-formulaire" action={action} className="flex flex-col gap-5">
        <input type="hidden" name="vehicleId" value={vehicleId} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Fournisseur</span>
          <select name="supplierContactId" required defaultValue="" className={CHAMP}>
            <option value="" disabled>
              Choisir le fournisseur
            </option>
            {fournisseurs.map((fournisseur) => (
              <option key={fournisseur.id} value={fournisseur.id}>
                {fournisseur.nom}
              </option>
            ))}
          </select>
          {fournisseurs.length === 0 && <span className="text-texte-discret">Ajoute d&apos;abord un fournisseur dans l&apos;app Partenaires.</span>}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Commandée le</span>
            <input type="date" name="commandeeLe" required defaultValue={aujourdhui} className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Livraison prévue le (facultative)</span>
            <input type="date" name="livraisonPrevueLe" className={CHAMP} />
          </label>
        </div>

        <fieldset className="flex flex-col gap-4">
          <legend className="font-medium">Pièces (cinq lignes au plus, une ligne vide est ignorée)</legend>
          {LIGNES.map((n) => (
            <div key={n} className="flex flex-col gap-3 rounded-xl border border-bordure p-3">
              <p className="text-sm font-medium">Ligne {n}</p>
              <label className="flex flex-col gap-1 text-sm">
                <span>Désignation</span>
                <input name={`ligne${n}Designation`} maxLength={200} placeholder="Plaquettes avant" className={CHAMP} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Organe</span>
                <select name={`ligne${n}ComponentTypeId`} defaultValue="" className={CHAMP}>
                  <option value="">Choisir l&apos;organe</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.nom}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span>Référence</span>
                  <input name={`ligne${n}Reference`} maxLength={100} className={CHAMP} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Qualité</span>
                  <select name={`ligne${n}Qualite`} defaultValue="origine" className={CHAMP}>
                    {Object.entries(LIBELLE_QUALITE).map(([cle, libelle]) => (
                      <option key={cle} value={cle}>
                        {libelle}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Quantité</span>
                  <input type="number" inputMode="numeric" min={1} max={50} name={`ligne${n}Quantite`} placeholder="1" className={CHAMP} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Prix unitaire, en euros</span>
                  <input inputMode="decimal" name={`ligne${n}Prix`} placeholder="12,50" className={CHAMP} />
                </label>
              </div>
            </div>
          ))}
        </fieldset>
      </form>
      <Message resultat={resultat} />
    </FormulairePage>
  )
}
