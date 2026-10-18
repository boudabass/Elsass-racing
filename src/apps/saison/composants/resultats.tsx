"use client"

import { useActionState, useState } from "react"

import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  contesterResultatAction,
  joindrePreuveAction,
  saisirResultatAction,
  validerResultatAction,
  type Resultat,
} from "../actions"
import { formaterDuree } from "../regles-resultats"
import { CHAMP, LIEN } from "@/lib/classes-formulaire"
import { Message } from "./formulaires"

// Onglet Résultats : la saisie tient en peu de champs ; « Plus de détails » déplie le reste.
// Les décisions (valider, contester) passent par les mêmes règles que la boîte d'actions.

import { LIBELLE_STATUT_RESULTAT } from "@/apps/saison/libelles"


const STATUTS_FINAUX = Object.entries(LIBELLE_STATUT_RESULTAT).map(([valeur, libelle]) => ({ valeur, libelle }))

interface ValeursResultat {
  statutFinal: string
  classementGeneral: number | null
  classementClasse: number | null
  nbClasses: number | null
  classementGroupe: number | null
  nbPartantsClasse: number | null
  tempsTotalMs: number | null
  penalitesMs: number | null
  kmChronometres: string | null
  causeAbandon: string | null
  stageAbandonId: string | null
  public: boolean
}

const duree = (ms: number | null) => (ms === null ? "" : formaterDuree(ms))

// Saisie ou correction du résultat. Un résultat validé ne se modifie pas : il faut le contester.
export function FormulaireResultat({
  entryId,
  speciales,
  valeurs,
}: {
  entryId: string
  speciales: Array<{ id: string; numero: number; nom: string }>
  valeurs: ValeursResultat | null
}) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(saisirResultatAction, null)
  const [details, setDetails] = useState(false)
  const v = valeurs
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="entryId" value={entryId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`statut-${entryId}`}>Statut final</Label>
        <select id={`statut-${entryId}`} name="statutFinal" required defaultValue={v?.statutFinal ?? "arrivee"} className={CHAMP}>
          {STATUTS_FINAUX.map((statut) => (
            <option key={statut.valeur} value={statut.valeur}>
              {statut.libelle}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`classement-${entryId}`}>Classement général</Label>
        <Input id={`classement-${entryId}`} name="classementGeneral" inputMode="numeric" defaultValue={v?.classementGeneral ?? ""} className={CHAMP} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`classe-${entryId}`}>Classement de classe</Label>
        <Input id={`classe-${entryId}`} name="classementClasse" inputMode="numeric" defaultValue={v?.classementClasse ?? ""} className={CHAMP} />
      </div>

      <button
        type="button"
        onClick={() => setDetails((ouvert) => !ouvert)}
        aria-expanded={details}
        className={`${LIEN} justify-self-start text-sm sm:col-span-3`}
      >
        {details ? "Moins de détails" : "Plus de détails"}
      </button>

      {details && (
        <>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`nb-classes-${entryId}`}>Nombre de classés</Label>
            <Input id={`nb-classes-${entryId}`} name="nbClasses" inputMode="numeric" defaultValue={v?.nbClasses ?? ""} className={CHAMP} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`classement-groupe-${entryId}`}>Classement de groupe</Label>
            <Input id={`classement-groupe-${entryId}`} name="classementGroupe" inputMode="numeric" defaultValue={v?.classementGroupe ?? ""} className={CHAMP} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`partants-${entryId}`}>Partants de la classe</Label>
            <Input id={`partants-${entryId}`} name="nbPartantsClasse" inputMode="numeric" defaultValue={v?.nbPartantsClasse ?? ""} className={CHAMP} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`temps-${entryId}`}>Temps total (mm:ss,d)</Label>
            <Input id={`temps-${entryId}`} name="tempsTotal" placeholder="1:23,4" defaultValue={duree(v?.tempsTotalMs ?? null)} className={CHAMP} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`penalites-${entryId}`}>Pénalités (mm:ss,d)</Label>
            <Input id={`penalites-${entryId}`} name="penalites" placeholder="0:10,0" defaultValue={duree(v?.penalitesMs ?? null)} className={CHAMP} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`km-${entryId}`}>Km chronométrés</Label>
            <Input id={`km-${entryId}`} name="kmChronometres" inputMode="decimal" defaultValue={v?.kmChronometres ?? ""} className={CHAMP} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`cause-${entryId}`}>Cause de l'abandon</Label>
            <Input id={`cause-${entryId}`} name="causeAbandon" defaultValue={v?.causeAbandon ?? ""} className={CHAMP} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`spéciale-${entryId}`}>Spéciale d'abandon</Label>
            <select id={`spéciale-${entryId}`} name="stageAbandonId" defaultValue={v?.stageAbandonId ?? ""} className={CHAMP}>
              <option value="">Aucune</option>
              {speciales.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.numero}. {stage.nom}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <label className="flex min-h-11 items-center gap-2 sm:col-span-3">
        <input type="checkbox" name="public" defaultChecked={v?.public ?? true} className="h-5 w-5" />
        Afficher le classement dans les documents publics
      </label>
      <div className="sm:col-span-3">
        <Message resultat={resultat} />
      </div>
      <Button type="submit" disabled={enCours} className="min-h-11 sm:col-span-3 sm:justify-self-start">
        Enregistrer le résultat
      </Button>
    </form>
  )
}

// Preuve facultative : un lien, ou un fichier (brief 3.3). L'un des deux suffit ; joindrePreuve le vérifie.
export function FormulairePreuve({ entryId, lienActuel }: { entryId: string; lienActuel: string | null }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(joindrePreuveAction, null)
  const [fichier, setFichier] = useState<FichierEnvoye | null>(null)
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="entryId" value={entryId} />
      <p className="font-medium">Preuve : un lien ou un fichier</p>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`preuve-${entryId}`}>Lien de la preuve</Label>
        <Input id={`preuve-${entryId}`} name="preuveLien" type="url" defaultValue={lienActuel ?? ""} className={CHAMP} />
      </div>
      <ChampFichier
        app="saison"
        libelle="ou un fichier"
        valeur={fichier?.id ?? null}
        typeValeur={fichier?.mimeType ?? null}
        nomValeur={fichier?.nom ?? null}
        onChange={setFichier}
        name="preuveFileId"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={enCours} className="min-h-11">
          Joindre la preuve
        </Button>
        <Message resultat={resultat} />
      </div>
    </form>
  )
}

export function BoutonValider({ entryId }: { entryId: string }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(validerResultatAction, null)
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="entryId" value={entryId} />
      <Button type="submit" disabled={enCours} className="min-h-11 self-start">
        Valider
      </Button>
      <Message resultat={resultat} />
    </form>
  )
}

// Contester un résultat validé : le commentaire est obligatoire.
export function FormulaireContester({ entryId }: { entryId: string }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(contesterResultatAction, null)
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="entryId" value={entryId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`contestation-${entryId}`}>Pourquoi contester ce résultat</Label>
        <Input id={`contestation-${entryId}`} name="commentaire" required maxLength={1000} className={CHAMP} />
      </div>
      <Button type="submit" disabled={enCours} variant="outline" className="min-h-11 self-start">
        Contester
      </Button>
      <Message resultat={resultat} />
    </form>
  )
}
