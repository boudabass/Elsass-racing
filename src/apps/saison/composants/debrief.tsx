"use client"

import { useState } from "react"

import type { Resultat } from "@/apps/saison/actions"
import { TiroirAction } from "@/components/formulaire/tiroir"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { CHAMP } from "@/lib/classes-formulaire"
import { newId } from "@/core/ids"
import { useMoteurSynchro, useTable } from "@/core/synchro/client/react"


export interface ValeursDebrief {
  ressenti: number
  pointsPositifs: string | null
  pointsAAmeliorer: string | null
  problemesVoiture: string | null
}

// Débrief : le texte s'ouvre dans un tiroir (brief 3.13b). Le ressenti se choisit par cinq boutons, puis les textes.
// Le débrief s'écrit dans la base locale : il fonctionne hors ligne, et part à la prochaine connexion.
// Il est affiché tel qu'il est sur cet appareil ; à défaut, tel que le serveur le connaît.
export function FormulaireDebrief({ entryId, valeurs }: { entryId: string; valeurs: ValeursDebrief | null }) {
  const moteur = useMoteurSynchro()
  const locales = useTable("saison_debrief")
  const lignes = locales.filter((ligne) => ligne.entryId === entryId && ligne.deletedAt === null)
  const local = lignes[lignes.length - 1] ?? null
  const actuel: ValeursDebrief | null = local
    ? {
        ressenti: local.ressenti as number,
        pointsPositifs: (local.pointsPositifs as string | null) ?? null,
        pointsAAmeliorer: (local.pointsAAmeliorer as string | null) ?? null,
        problemesVoiture: (local.problemesVoiture as string | null) ?? null,
      }
    : valeurs
  const [confirme, setConfirme] = useState(false)

  async function enregistrer(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
    const ressenti = Number(donnees.get("ressenti"))
    if (!Number.isInteger(ressenti) || ressenti < 1 || ressenti > 5) return { ok: false, message: "Choisis un ressenti de 1 à 5." }
    const champs = {
      entryId,
      ressenti,
      pointsPositifs: texteOuNull(donnees.get("pointsPositifs")),
      pointsAAmeliorer: texteOuNull(donnees.get("pointsAAmeliorer")),
      problemesVoiture: texteOuNull(donnees.get("problemesVoiture")),
    }
    try {
      if (local) {
        await moteur.ecrireLocal("saison_debrief", { type: "modifier", id: local.id, champs })
      } else {
        await moteur.ecrireLocal("saison_debrief", { type: "creer", id: newId(), champs })
      }
      return { ok: true }
    } catch {
      return { ok: false, message: "Le débrief n'a pas pu être enregistré sur cet appareil." }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <TiroirAction
        libelle={actuel ? "Modifier mon débrief" : "Ajouter mon débrief"}
        titre="Mon débrief"
        action={enregistrer}
        libelleBouton="Enregistrer le débrief"
        libelleEnCours="Enregistrement…"
        onSucces={() => setConfirme(true)}
      >
        <CorpsDebrief entryId={entryId} actuel={actuel} />
      </TiroirAction>
      {confirme && (
        <p role="status" className="text-sm text-etat-ok">
          Enregistré. Le débrief part dès que l'appareil est connecté.
        </p>
      )}
    </div>
  )
}

// Contenu du tiroir. Le ressenti est envoyé par le champ caché ; le tiroir repart à neuf à chaque ouverture.
function CorpsDebrief({ entryId, actuel }: { entryId: string; actuel: ValeursDebrief | null }) {
  const [ressenti, setRessenti] = useState<number | null>(actuel?.ressenti ?? null)
  return (
    <>
      <input type="hidden" name="ressenti" value={ressenti ?? ""} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-texte-discret">Ton ressenti (clique sur une valeur)</legend>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((note) => (
            <Button
              key={note}
              type="button"
              onClick={() => setRessenti(note)}
              variant={ressenti === note ? "default" : "outline"}
              aria-label={`Ressenti ${note} sur 5`}
              aria-pressed={ressenti === note}
              className="min-h-11"
            >
              {note}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`positifs-${entryId}`}>Points positifs</Label>
        <textarea id={`positifs-${entryId}`} name="pointsPositifs" rows={2} defaultValue={actuel?.pointsPositifs ?? ""} className={CHAMP} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`ameliorer-${entryId}`}>Points à améliorer</Label>
        <textarea id={`ameliorer-${entryId}`} name="pointsAAmeliorer" rows={2} defaultValue={actuel?.pointsAAmeliorer ?? ""} className={CHAMP} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`voiture-${entryId}`}>Problèmes de voiture constatés</Label>
        <textarea id={`voiture-${entryId}`} name="problemesVoiture" rows={2} defaultValue={actuel?.problemesVoiture ?? ""} className={CHAMP} />
      </div>
    </>
  )
}

function texteOuNull(valeur: FormDataEntryValue | null): string | null {
  const texte = String(valeur ?? "").trim()
  return texte === "" ? null : texte
}
