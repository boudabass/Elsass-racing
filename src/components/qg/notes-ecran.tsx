"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"

import { Tiroir } from "@/components/formulaire/tiroir"
import { newId } from "@/core/ids"
import { useMoteurSynchro, useTable } from "@/core/synchro/client/react"
import { BOUTON, LIEN } from "@/lib/classes-formulaire"

const dateCourte = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" })

interface EditionNote {
  id: string
  texte: string
  original: string
}

// Notes de la team, sur la base locale : elles s'affichent hors ligne. Une note pas encore envoyée
// porte le badge « En attente ». Chacun peut modifier ses notes ; l'assistance peut en créer.
// Créer et modifier se font dans un tiroir (brief 3.13b).
export function NotesEcran({ userId, peutEcrire }: { userId: string; peutEcrire: boolean }) {
  const moteur = useMoteurSynchro()
  const lignes = useTable("core_note")
  const [nouvelleOuverte, setNouvelleOuverte] = useState(false)
  const [nouvelle, setNouvelle] = useState("")
  const [edition, setEdition] = useState<EditionNote | null>(null)

  // Depuis le menu « + » : le tiroir de nouvelle note s'ouvre tout de suite.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("nouvelle")) setNouvelleOuverte(true)
  }, [])

  // Notes de la team seulement : une note de fiche (ordre de travail, brief 5.0) a son propre écran, sur la fiche.
  const notes = useMemo(
    () => [...lignes].filter((ligne) => ligne.ficheType === undefined || ligne.ficheType === "team").sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [lignes],
  )

  async function creer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    const texte = nouvelle.trim()
    if (!texte) return
    await moteur.ecrireLocal("core_note", { type: "creer", id: newId(), champs: { texte } })
    setNouvelle("")
    setNouvelleOuverte(false)
  }

  async function enregistrerEdition(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    if (!edition) return
    const texte = edition.texte.trim()
    if (!texte) return
    await moteur.ecrireLocal("core_note", { type: "modifier", id: edition.id, champs: { texte } })
    setEdition(null)
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <h1 className="titre-rallye text-3xl">Notes de la team</h1>

      {peutEcrire && (
        <>
          <button type="button" onClick={() => setNouvelleOuverte(true)} className={`${BOUTON} w-fit`}>
            Nouvelle note
          </button>
          <Tiroir
            ouvert={nouvelleOuverte}
            onOuvertChange={(ouvert) => {
              setNouvelleOuverte(ouvert)
              if (!ouvert) setNouvelle("")
            }}
            titre="Nouvelle note"
            modifie={nouvelle.trim() !== ""}
            principal={
              <button type="submit" form="note-formulaire" disabled={nouvelle.trim() === ""} className={BOUTON}>
                Enregistrer la note
              </button>
            }
          >
            <form id="note-formulaire" onSubmit={creer} className="flex flex-col gap-3">
              <label htmlFor="note-texte" className="font-medium">
                Ce qu'il faut retenir, ce qu'il faut faire
              </label>
              <textarea
                id="note-texte"
                autoFocus
                value={nouvelle}
                onChange={(e) => setNouvelle(e.target.value)}
                rows={6}
                maxLength={4000}
                className="rounded-md border border-bordure bg-surface p-3 text-base"
              />
            </form>
          </Tiroir>
        </>
      )}

      {notes.length === 0 && <p className="text-texte-discret">Aucune note pour l'instant.</p>}

      <ul className="flex flex-col gap-3">
        {notes.map((note) => (
          <li key={note.id} className="rounded-lg border border-bordure bg-surface p-4">
            <p className="whitespace-pre-wrap text-base">{String(note.texte)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-texte-discret">
              <span>{note.createdBy === userId ? "Toi" : "Un membre"}</span>
              <span>· {dateCourte.format(new Date(note.createdAt))}</span>
              {note.enAttente && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-texte">En attente</span>}
              {peutEcrire && note.createdBy === userId && (
                <button
                  type="button"
                  onClick={() => setEdition({ id: note.id, texte: String(note.texte), original: String(note.texte) })}
                  className={LIEN}
                >
                  Modifier
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {peutEcrire && (
        <Tiroir
          ouvert={edition !== null}
          onOuvertChange={(ouvert) => {
            if (!ouvert) setEdition(null)
          }}
          titre="Modifier la note"
          modifie={edition !== null && edition.texte !== edition.original}
          principal={
            <button type="submit" form="note-edition" disabled={edition === null || edition.texte.trim() === ""} className={BOUTON}>
              Enregistrer
            </button>
          }
        >
          <form id="note-edition" onSubmit={enregistrerEdition} className="flex flex-col gap-3">
            <textarea
              aria-label="Modifier la note"
              value={edition?.texte ?? ""}
              onChange={(e) => setEdition((actuelle) => (actuelle ? { ...actuelle, texte: e.target.value } : actuelle))}
              rows={6}
              maxLength={4000}
              className="rounded-md border border-bordure bg-surface p-3 text-base"
            />
          </form>
        </Tiroir>
      )}
    </div>
  )
}
