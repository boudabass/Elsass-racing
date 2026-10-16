"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"

import { newId } from "@/core/ids"
import { useMoteurSynchro, useTable } from "@/core/synchro/client/react"

const dateCourte = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" })

// Notes de la team, sur la base locale : elles s'affichent hors ligne. Une note pas encore envoyée
// porte le badge « En attente ». Chacun peut modifier ses notes ; l'assistance peut en créer.
export function NotesEcran({ userId, peutEcrire }: { userId: string; peutEcrire: boolean }) {
  const moteur = useMoteurSynchro()
  const lignes = useTable("core_note")
  const [nouvelle, setNouvelle] = useState("")
  const [edition, setEdition] = useState<{ id: string; texte: string } | null>(null)
  const zone = useRef<HTMLTextAreaElement>(null)

  // Depuis le menu « + » : le champ est prêt à recevoir du texte.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("nouvelle")) zone.current?.focus()
  }, [])

  const notes = useMemo(() => [...lignes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [lignes])

  async function creer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    const texte = nouvelle.trim()
    if (!texte) return
    await moteur.ecrireLocal("core_note", { type: "creer", id: newId(), champs: { texte } })
    setNouvelle("")
  }

  async function enregistrerEdition() {
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
        <form onSubmit={creer} className="flex flex-col gap-3">
          <label htmlFor="note-texte" className="font-medium">
            Nouvelle note
          </label>
          <textarea
            id="note-texte"
            ref={zone}
            value={nouvelle}
            onChange={(e) => setNouvelle(e.target.value)}
            rows={3}
            maxLength={4000}
            className="rounded-md border border-bordure bg-surface p-3 text-base"
            placeholder="Ce qu'il faut retenir, ce qu'il faut faire…"
          />
          <button type="submit" disabled={nouvelle.trim() === ""} className="cible-tactile w-fit rounded-md bg-marque px-5 py-2 font-medium text-white hover:opacity-90 disabled:opacity-40">
            Enregistrer la note
          </button>
        </form>
      )}

      {notes.length === 0 && <p className="text-texte-discret">Aucune note pour l'instant.</p>}

      <ul className="flex flex-col gap-3">
        {notes.map((note) => (
          <li key={note.id} className="rounded-lg border border-bordure bg-surface p-4">
            {edition?.id === note.id ? (
              <div className="flex flex-col gap-3">
                <textarea
                  aria-label="Modifier la note"
                  value={edition.texte}
                  onChange={(e) => setEdition({ id: note.id, texte: e.target.value })}
                  rows={3}
                  maxLength={4000}
                  className="rounded-md border border-bordure bg-fond p-3"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={enregistrerEdition} className="cible-tactile rounded-md bg-marque px-4 py-2 font-medium text-white">
                    Enregistrer
                  </button>
                  <button type="button" onClick={() => setEdition(null)} className="cible-tactile rounded-md border border-bordure px-4 py-2">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-base">{String(note.texte)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-texte-discret">
                  <span>{note.createdBy === userId ? "Toi" : "Un membre"}</span>
                  <span>· {dateCourte.format(new Date(note.createdAt))}</span>
                  {note.enAttente && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-texte">En attente</span>}
                  {peutEcrire && note.createdBy === userId && (
                    <button
                      type="button"
                      onClick={() => setEdition({ id: note.id, texte: String(note.texte) })}
                      className="cible-tactile underline-offset-4 hover:underline"
                    >
                      Modifier
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
