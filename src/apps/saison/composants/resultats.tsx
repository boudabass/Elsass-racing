"use client"

import { useActionState, useState } from "react"

import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"
import { Message } from "@/components/formulaire/message"
import { TiroirAction } from "@/components/formulaire/tiroir"
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

// Onglet Résultats : la saisie s'ouvre dans un tiroir (brief 3.13b). Dans le tiroir, « Plus de détails » déplie le reste.
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
  const [details, setDetails] = useState(false)
  const v = valeurs
  return (
    <TiroirAction
      libelle={v ? "Modifier le résultat" : "Saisir le résultat"}
      titre="Résultat de l'épreuve"
      action={saisirResultatAction}
      libelleBouton="Enregistrer le résultat"
      libelleEnCours="Enregistrement…"
    >
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
        className={`${LIEN} justify-self-start text-sm`}
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

      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="public" defaultChecked={v?.public ?? true} className="h-5 w-5" />
        Afficher le classement dans les documents publics
      </label>
    </TiroirAction>
  )
}

// Preuve facultative : un lien, ou un fichier (brief 3.3). L'un des deux suffit ; joindrePreuve le vérifie.
export function FormulairePreuve({ entryId, lienActuel }: { entryId: string; lienActuel: string | null }) {
  const [fichier, setFichier] = useState<FichierEnvoye | null>(null)
  return (
    <TiroirAction
      libelle={lienActuel ? "Modifier la preuve" : "Joindre une preuve"}
      titre="Joindre une preuve"
      sousTitre="Un lien ou un fichier : l'un des deux suffit"
      action={joindrePreuveAction}
      libelleBouton="Joindre la preuve"
      libelleEnCours="Envoi…"
    >
      <input type="hidden" name="entryId" value={entryId} />
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
    </TiroirAction>
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

// Contester un résultat validé : le commentaire est obligatoire. La saisie se fait dans un tiroir.
export function FormulaireContester({ entryId }: { entryId: string }) {
  return (
    <TiroirAction
      libelle="Contester"
      titre="Contester ce résultat"
      action={contesterResultatAction}
      libelleBouton="Envoyer la contestation"
      libelleEnCours="Envoi…"
      secondaire={false}
    >
      <input type="hidden" name="entryId" value={entryId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`contestation-${entryId}`}>Pourquoi contester ce résultat</Label>
        <Input id={`contestation-${entryId}`} name="commentaire" required maxLength={1000} className={CHAMP} />
      </div>
    </TiroirAction>
  )
}
