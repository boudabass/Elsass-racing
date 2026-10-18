"use client"

// Page partenaire (brief 3.6, §4) : état du lien, création, renouvellement, révocation et sections visibles.
// Le jeton n'est gardé que dans cet état : il s'affiche une seule fois, après création ou renouvellement.

import { useActionState, useState } from "react"

import { BOUTON, LIEN } from "@/lib/classes-formulaire"

import { creerLienAction, renouvelerLienAction, revoquerLienAction, modifierSectionsAction, type ResultatLien } from "../actions"
import { BoutonEnvoi, FormulaireAction } from "./formulaire"

export interface LienPourAffichage {
  id: string
  nbConsultations: number
  derniereConsultation: string | null
  sections: string[]
}

export function LienPartenaire({
  partnerId,
  lien,
  sectionsDisponibles,
  libellesSections,
}: {
  partnerId: string
  lien: LienPourAffichage | null
  sectionsDisponibles: readonly string[]
  libellesSections: Record<string, string>
}) {
  const [creation, creer] = useActionState(creerLienAction, null)
  const [renouvellement, renouveler] = useActionState(renouvelerLienAction, null)
  const [copie, setCopie] = useState(false)

  // Le jeton le plus récent n'existe que dans cet état. Un rechargement de la page le fait disparaître.
  const reponse = renouvellement?.ok ? renouvellement : creation?.ok ? creation : null
  const erreur = (renouvellement && !renouvellement.ok ? renouvellement : creation && !creation.ok ? creation : null)
  const url = reponse ? `${window.location.origin}/p/${reponse.jeton}` : null

  async function copier() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopie(true)
    } catch {
      setCopie(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {lien ? (
        <div className="flex flex-col gap-1 text-sm">
          <p>
            <span className="font-medium">Lien actif.</span> Consultations : {lien.nbConsultations}.
          </p>
          <p className="text-texte-discret">{lien.derniereConsultation ? `Dernière consultation : ${lien.derniereConsultation}` : "Pas encore consulté."}</p>
        </div>
      ) : (
        <p className="text-texte-discret">Aucun lien actif pour ce partenaire.</p>
      )}

      {url && reponse && (
        <div role="status" className="flex flex-col gap-3 rounded-md border border-marque bg-surface p-4">
          <p className="font-medium">Lien de la page partenaire</p>
          <p className="break-all font-mono text-sm">{url}</p>
          <p className="text-sm text-texte-discret">Copie-le maintenant : il ne sera plus affiché. Pour le renvoyer, renouvelle-le.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={copier} className={BOUTON}>
              Copier
            </button>
            {copie && <span className="text-sm text-etat-ok">Copié.</span>}
          </div>
        </div>
      )}

      {erreur && !erreur.ok && (
        <p role="alert" className="text-sm text-etat-rouge">
          {erreur.message}
        </p>
      )}

      {lien ? (
        <div className="flex flex-col gap-4">
          <form action={renouveler} className="flex flex-col gap-2">
            <input type="hidden" name="partnerId" value={partnerId} />
            <BoutonEnvoi libelle="Renouveler le lien" secondaire />
            <p className="text-sm text-texte-discret">Renouveler rend l&apos;ancien lien inutilisable et en crée un nouveau.</p>
          </form>

          <FormulaireAction action={modifierSectionsAction} nom="Sections visibles" className="flex flex-col gap-3">
            <input type="hidden" name="lienId" value={lien.id} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-medium">Sections visibles par le partenaire</legend>
              {sectionsDisponibles.map((section) => (
                <label key={section} className="cible-tactile flex items-center gap-3">
                  <input type="checkbox" name="sections" value={section} defaultChecked={lien.sections.includes(section)} className="h-5 w-5 accent-marque" />
                  {libellesSections[section] ?? section}
                </label>
              ))}
            </fieldset>
            <div>
              <BoutonEnvoi libelle="Enregistrer les sections" secondaire />
            </div>
          </FormulaireAction>

          <details>
            <summary className={`${LIEN} cursor-pointer list-none text-sm`}>Révoquer le lien</summary>
            <div className="mt-2 flex flex-col gap-2 rounded-md border border-bordure p-3">
              <p className="text-sm">Le partenaire ne pourra plus ouvrir sa page avec ce lien.</p>
              <FormulaireAction action={revoquerLienAction} nom="Révoquer le lien" className="flex flex-col gap-2">
                <input type="hidden" name="lienId" value={lien.id} />
                <BoutonEnvoi libelle="Révoquer le lien" secondaire />
              </FormulaireAction>
            </div>
          </details>
        </div>
      ) : (
        <form action={creer} className="flex flex-col gap-2">
          <input type="hidden" name="partnerId" value={partnerId} />
          <div>
            <BoutonEnvoi libelle="Créer le lien" />
          </div>
        </form>
      )}
    </div>
  )
}
