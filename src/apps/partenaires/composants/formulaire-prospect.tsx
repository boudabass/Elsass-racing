"use client"

// Nouveau prospect en deux champs (brief 3.6, §3). L'indice de doublon apparaît avant l'envoi ; après l'ajout, on
// ouvre la fiche du nouveau partenaire.

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { CHAMP, LIEN } from "@/lib/classes-formulaire"

import { creerProspectAction, verifierEntrepriseAction } from "../actions"

import { FormulairePage } from "@/components/formulaire/formulaire-page"

import { Champ, FormulaireAction } from "./formulaire"

interface Indice {
  contactExiste: boolean
  partenaireId: string | null
}

export function FormulaireProspect() {
  const router = useRouter()
  const [entreprise, setEntreprise] = useState("")
  const [indice, setIndice] = useState<Indice | null>(null)

  // La vérification attend une courte pause de saisie : une requête par pause, pas par lettre.
  useEffect(() => {
    const saisie = entreprise.trim()
    if (saisie === "") {
      setIndice(null)
      return
    }
    const minuterie = setTimeout(() => {
      verifierEntrepriseAction(saisie).then(setIndice).catch(() => setIndice(null))
    }, 300)
    return () => clearTimeout(minuterie)
  }, [entreprise])

  return (
    <FormulairePage formulaireId="prospect-formulaire" annulerHref="/apps/partenaires" libelleBouton="Ajouter le prospect">
      <FormulaireAction
        id="prospect-formulaire"
        nom="Nouveau prospect"
        action={creerProspectAction}
        auSucces={(resultat) => {
          if (resultat.id) router.push(`/apps/partenaires/${resultat.id}`)
        }}
      >
        <Champ id="entreprise" libelle="Entreprise">
          <input
            id="entreprise"
            name="entreprise"
            required
            autoComplete="off"
            maxLength={120}
            value={entreprise}
            onChange={(evenement) => setEntreprise(evenement.target.value)}
            className={CHAMP}
            aria-describedby="entreprise-indice"
          />
        </Champ>
        <div id="entreprise-indice" role="status" className="-mt-2 text-sm">
          {indice?.partenaireId && (
            <p>
              Cette entreprise est déjà dans Partenaires.{" "}
              <Link href={`/apps/partenaires/${indice.partenaireId}`} className={LIEN}>
                Ouvrir sa fiche
              </Link>
            </p>
          )}
          {indice?.contactExiste && !indice.partenaireId && <p className="text-texte-discret">Ce contact existe déjà, il sera réutilisé.</p>}
        </div>
        <fieldset className="flex flex-col gap-4 rounded-lg border border-bordure p-4">
          <legend className="px-1 font-medium">Interlocuteur (facultatif)</legend>
          <p className="text-sm text-texte-discret">Prénom et nom ensemble, si tu les connais. Laisse les deux vides sinon.</p>
          <Champ id="contact-prenom" libelle="Prénom">
            <input id="contact-prenom" name="prenom" autoComplete="off" maxLength={60} className={CHAMP} />
          </Champ>
          <Champ id="contact-nom" libelle="Nom">
            <input id="contact-nom" name="nom" autoComplete="off" maxLength={60} className={CHAMP} />
          </Champ>
        </fieldset>
      </FormulaireAction>
    </FormulairePage>
  )
}
