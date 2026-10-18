"use client"

// Nouveau prospect en deux champs (brief 3.6, §3). L'indice de doublon apparaît avant l'envoi ; après l'ajout, on
// ouvre la fiche du nouveau partenaire.

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { CHAMP, LIEN } from "@/lib/classes-formulaire"

import { creerProspectAction, verifierEntrepriseAction } from "../actions"

import { BoutonEnvoi, Champ, FormulaireAction } from "./formulaire"

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
    <FormulaireAction
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
      <Champ id="contact" libelle="Contact" aide="Le nom de l'interlocuteur, si tu le connais. Facultatif.">
        <input id="contact" name="contact" autoComplete="off" maxLength={120} placeholder="Prénom Nom" className={CHAMP} aria-describedby="contact-aide" />
      </Champ>
      <div>
        <BoutonEnvoi libelle="Ajouter" />
      </div>
    </FormulaireAction>
  )
}
