"use client"

import { useState, type FormEvent } from "react"

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

// Débrief : ressenti de 1 à 5 par cinq boutons (le bouton cliqué envoie la valeur), puis les textes.
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
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function enregistrer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    const formulaire = evenement.currentTarget
    const declencheur = (evenement.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const ressenti = Number(declencheur?.value)
    if (!Number.isInteger(ressenti) || ressenti < 1 || ressenti > 5) {
      setMessage({ ok: false, texte: "Choisis un ressenti de 1 à 5." })
      return
    }
    const saisie = new FormData(formulaire)
    const champs = {
      entryId,
      ressenti,
      pointsPositifs: texteOuNull(saisie.get("pointsPositifs")),
      pointsAAmeliorer: texteOuNull(saisie.get("pointsAAmeliorer")),
      problemesVoiture: texteOuNull(saisie.get("problemesVoiture")),
    }
    setEnCours(true)
    try {
      if (local) {
        await moteur.ecrireLocal("saison_debrief", { type: "modifier", id: local.id, champs })
      } else {
        await moteur.ecrireLocal("saison_debrief", { type: "creer", id: newId(), champs })
      }
      setMessage({ ok: true, texte: "Enregistré. Le débrief part dès que l'appareil est connecté." })
    } catch {
      setMessage({ ok: false, texte: "Le débrief n'a pas pu être enregistré sur cet appareil." })
    } finally {
      setEnCours(false)
    }
  }

  // Le formulaire repart à neuf quand la ligne locale change : ses valeurs sont alors celles qui viennent d'être enregistrées.
  const cle = local ? `${local.id}-${String(local.updatedAt)}` : "serveur"

  return (
    <form key={cle} onSubmit={enregistrer} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-texte-discret">Ton ressenti (clique sur une valeur)</legend>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((note) => (
            <Button
              key={note}
              type="submit"
              name="ressenti"
              value={String(note)}
              disabled={enCours}
              variant={actuel?.ressenti === note ? "default" : "outline"}
              aria-label={`Ressenti ${note} sur 5`}
              aria-pressed={actuel?.ressenti === note}
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
      {message &&
        (message.ok ? (
          <p role="status" className="text-sm text-etat-ok">
            {message.texte}
          </p>
        ) : (
          <p role="alert" className="text-sm text-etat-rouge">
            {message.texte}
          </p>
        ))}
    </form>
  )
}

function texteOuNull(valeur: FormDataEntryValue | null): string | null {
  const texte = String(valeur ?? "").trim()
  return texte === "" ? null : texte
}
