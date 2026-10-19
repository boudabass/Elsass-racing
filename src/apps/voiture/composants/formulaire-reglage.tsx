"use client"

import { useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

import { FormulairePage } from "@/components/formulaire/formulaire-page"
import { TiroirAction } from "@/components/formulaire/tiroir"
import { newId } from "@/core/ids"
import { useMoteurSynchro } from "@/core/synchro/client/react"
import { BOUTON, BOUTON_SECONDAIRE, CHAMP } from "@/lib/classes-formulaire"

import { modifierReglageAction } from "../actions"
import { CHAMPS_REGLAGE, type ChampReglage } from "../regles"
import { LIBELLE_CONDITIONS, LIBELLE_REVETEMENT } from "../libelles"
import { lireSaisieReglage } from "../saisie-reglage"

export interface OptionEpreuveReglage {
  valeur: string
  libelle: string
}

// Valeurs affichées : texte, avec la virgule comme séparateur décimal.
export interface ValeursFormulaireReglage {
  date: string
  epreuve: string
  conditions: string
  revetement: string
  remarques: string
  note: string
  valeurs: Record<string, string>
}

interface Props {
  vehicleId: string
  initiales: ValeursFormulaireReglage
  masques: string[]
  epreuves: OptionEpreuveReglage[]
  // Référence utilisée pour partir de (sa clé de modèle), ou null.
  modeleId: string | null
  // Création seulement : les références de la team et le choix « Partir de » en cours.
  references?: Array<{ id: string; nom: string }>
  referenceChoisie?: string | null
}

const ESSENTIELS = CHAMPS_REGLAGE.filter((c) => c.groupe === "essentiel")
const AVANCES = CHAMPS_REGLAGE.filter((c) => c.groupe === "avance")
const PNEUS = ["avg", "avd", "arg", "ard"] as const

// Champs de la fiche, sans formulaire ni bouton : partagés par la création (sur la page) et la modification (tiroir).
// Les champs masqués par la team ne s'affichent pas ; en modification, leur valeur part dans un champ caché (voir ModifierFicheReglage).
function CorpsReglage({ initiales, masques, epreuves }: { initiales: ValeursFormulaireReglage; masques: string[]; epreuves: OptionEpreuveReglage[] }) {
  const champ = (c: ChampReglage) => (
    <label key={c.cle} className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{c.libelle}</span>
      <span className="flex items-center gap-2">
        <input name={`v_${c.cle}`} defaultValue={initiales.valeurs[c.cle] ?? ""} inputMode="decimal" autoComplete="off" className={`${CHAMP} tabular-nums`} />
        {c.unite && <span className="shrink-0 text-texte-discret">{c.unite}</span>}
      </span>
    </label>
  )

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Date</span>
          <input name="date" type="date" required defaultValue={initiales.date} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Épreuve</span>
          <select name="epreuve" defaultValue={initiales.epreuve} className={CHAMP}>
            <option value="">Aucune</option>
            {epreuves.map((epreuve) => (
              <option key={epreuve.valeur} value={epreuve.valeur}>
                {epreuve.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Conditions</span>
          <select name="conditions" defaultValue={initiales.conditions} className={CHAMP}>
            <option value="">Non précisées</option>
            {Object.entries(LIBELLE_CONDITIONS).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Revêtement</span>
          <select name="revetement" defaultValue={initiales.revetement} className={CHAMP}>
            <option value="">Non précisé</option>
            {Object.entries(LIBELLE_REVETEMENT).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-titre text-lg uppercase">Pressions</legend>
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          {(["pression_froid", "pression_chaud"] as const).map((prefixe) => (
            <div key={prefixe} className="col-span-2 grid grid-cols-2 gap-4">
              <p className="col-span-2 text-sm font-medium">{prefixe === "pression_froid" ? "À froid" : "À chaud"}</p>
              {PNEUS.map((cote) => {
                const c = ESSENTIELS.find((e) => e.cle === `${prefixe}_${cote}`)
                return c ? champ({ ...c, libelle: cote.toUpperCase() }) : null
              })}
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-titre text-lg uppercase">Hauteur de caisse</legend>
        <div className="grid gap-4 sm:grid-cols-2">{ESSENTIELS.filter((c) => c.cle.startsWith("hauteur_")).map(champ)}</div>
      </fieldset>

      {AVANCES.some((c) => !masques.includes(c.cle)) && (
        <section className="flex flex-col gap-3">
          <h2 className="font-titre text-lg uppercase">Plus de réglages</h2>
          <div className="grid gap-4 sm:grid-cols-2">{AVANCES.filter((c) => !masques.includes(c.cle)).map(champ)}</div>
        </section>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Remarques du pilote</span>
        <textarea name="remarques" rows={3} maxLength={2000} defaultValue={initiales.remarques} className={CHAMP} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Comportement de la voiture (1 à 5)</legend>
        <div className="flex flex-wrap gap-2">
          {["", "1", "2", "3", "4", "5"].map((valeur) => (
            <label key={valeur || "aucune"} className="cible-tactile flex items-center gap-2 rounded-md border border-bordure px-3 text-sm has-[:checked]:border-marque has-[:checked]:font-medium">
              <input type="radio" name="note" value={valeur} defaultChecked={initiales.note === valeur} className="h-4 w-4" />
              {valeur === "" ? "Pas de note" : valeur}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  )
}

// Modification d'une fiche, dans un tiroir (brief 3.13b). Le serveur reçoit les valeurs masquées, pour ne pas les perdre.
export function ModifierFicheReglage({
  vehicleId,
  reglageId,
  initiales,
  masques,
  epreuves,
  modeleId,
}: {
  vehicleId: string
  reglageId: string
  initiales: ValeursFormulaireReglage
  masques: string[]
  epreuves: OptionEpreuveReglage[]
  modeleId: string | null
}) {
  const router = useRouter()
  return (
    <TiroirAction
      libelle="Modifier la fiche"
      titre="Modifier la fiche de réglage"
      action={modifierReglageAction}
      libelleBouton="Enregistrer la fiche"
      libelleEnCours="Enregistrement…"
      onSucces={() => router.refresh()}
    >
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="reglageId" value={reglageId} />
      {modeleId && <input type="hidden" name="modeleId" value={modeleId} />}
      {masques.map((cle) => (
        <input key={cle} type="hidden" name={`v_${cle}`} value={initiales.valeurs[cle] ?? ""} />
      ))}
      <CorpsReglage initiales={initiales} masques={masques} epreuves={epreuves} />
    </TiroirAction>
  )
}

// Nouvelle fiche, sur sa page (brief 3.13b, décision 1) : la barre du bas enregistre, « Annuler » quitte.
// « Partir de » pré-remplit tout de suite. La fiche s'écrit dans la base locale et part au retour du réseau (synchro, voiture_setup).
export function FormulaireReglage({ vehicleId, initiales, masques, epreuves, modeleId, references = [], referenceChoisie = null }: Props) {
  const router = useRouter()
  const moteur = useMoteurSynchro()
  const [local, setLocal] = useState<{ ok: boolean; texte: string } | null>(null)
  const [enregistrementLocal, setEnregistrementLocal] = useState(false)

  // « Partir de » : le choix pré-remplit tout de suite. Si des valeurs ont été saisies à la main, on demande d'abord.
  const formulaire = useRef<HTMLFormElement>(null)
  const [choisie, setChoisie] = useState(referenceChoisie ?? "derniere")
  const [demande, setDemande] = useState<string | null>(null)

  // Vrai si un champ diffère de sa valeur de départ (saisie à la main).
  function saisieModifiee(): boolean {
    const element = formulaire.current
    if (!element) return false
    return Array.from(element.elements).some((champ) => {
      if (champ instanceof HTMLInputElement) {
        if (champ.type === "hidden") return false
        if (champ.type === "checkbox" || champ.type === "radio") return champ.checked !== champ.defaultChecked
        return champ.value !== champ.defaultValue
      }
      if (champ instanceof HTMLTextAreaElement) return champ.value !== champ.defaultValue
      if (champ instanceof HTMLSelectElement) return Array.from(champ.options).some((option) => option.selected !== option.defaultSelected)
      return false
    })
  }

  function allerVers(valeur: string) {
    setDemande(null)
    setChoisie(valeur)
    router.push(`/apps/voiture/vehicules/${vehicleId}/reglages/nouveau?partir=${valeur}`)
  }

  function choisirReference(valeur: string) {
    if (valeur === choisie) return
    if (saisieModifiee()) {
      setDemande(valeur)
      return
    }
    allerVers(valeur)
  }

  async function enregistrerLocal(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    const formulaire = evenement.currentTarget
    const lecture = lireSaisieReglage(new FormData(formulaire))
    if (!lecture.ok) {
      setLocal({ ok: false, texte: lecture.message })
      return
    }
    setEnregistrementLocal(true)
    try {
      await moteur.ecrireLocal("voiture_setup", { type: "creer", id: newId(), champs: { ...lecture.entree, vehicleId } })
      formulaire.reset()
      setLocal({ ok: true, texte: "Fiche enregistrée. Elle part dès que l'appareil est connecté." })
    } catch {
      setLocal({ ok: false, texte: "La fiche n'a pas pu être enregistrée sur cet appareil." })
    } finally {
      setEnregistrementLocal(false)
    }
  }

  return (
    <FormulairePage
      formulaireId="reglage-formulaire"
      annulerHref={`/apps/voiture/vehicules/${vehicleId}?onglet=reglages`}
      libelleBouton="Enregistrer la fiche"
      libelleEnCours="Enregistrement…"
      enCours={enregistrementLocal}
    >
      <div className="flex flex-col gap-3">
        <label className="flex max-w-xs flex-col gap-1 text-sm">
          <span className="font-medium">Partir de</span>
          <select value={choisie} onChange={(evenement) => choisirReference(evenement.target.value)} className={CHAMP}>
            <option value="derniere">La dernière fiche du véhicule</option>
            {references.map((reference) => (
              <option key={reference.id} value={reference.id}>
                Référence : {reference.nom}
              </option>
            ))}
          </select>
        </label>
        {demande !== null && (
          <div role="group" aria-label="Remplacer les valeurs saisies" className="flex flex-col gap-3 rounded-lg border border-bordure p-4">
            <p className="font-medium">Remplacer les valeurs saisies ?</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => allerVers(demande)} className={BOUTON}>
                Remplacer
              </button>
              <button type="button" onClick={() => setDemande(null)} className={BOUTON_SECONDAIRE}>
                Garder
              </button>
            </div>
          </div>
        )}
      </div>

      <form id="reglage-formulaire" ref={formulaire} onSubmit={enregistrerLocal} className="flex flex-col gap-6">
        <input type="hidden" name="vehicleId" value={vehicleId} />
        {modeleId && <input type="hidden" name="modeleId" value={modeleId} />}
        <CorpsReglage initiales={initiales} masques={masques} epreuves={epreuves} />
        {local && (
          <p role="status" className={`text-sm ${local.ok ? "text-etat-ok" : "text-etat-rouge"}`}>
            {local.texte}
          </p>
        )}
      </form>
    </FormulairePage>
  )
}
