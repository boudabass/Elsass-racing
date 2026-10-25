"use client"

// Bloc « Notes et photos » d'une fiche (brief 5.0, §3). Les notes se lisent et s'écrivent sur la base locale : elles
// partent dans la file quand le réseau revient. Les photos et le retrait par la gestion passent par le réseau.

import { useMemo, useState, type FormEvent } from "react"

import { Tiroir, TiroirAction, type ActionTiroir } from "@/components/formulaire/tiroir"
import { newId } from "@/core/ids"
import { useEtatSynchro, useMoteurSynchro, useTable } from "@/core/synchro/client/react"
import { BOUTON, BOUTON_SECONDAIRE, CHAMP, LIEN } from "@/lib/classes-formulaire"

const dateCourte = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" })

export interface PhotoAffichee {
  id: string
  fileId: string
  nom: string
  auteur: string
  creeLe: string
  retirable: boolean
}

export interface FicheNotesPhotos {
  app: string
  ficheType: string
  ficheId: string
}

interface Props {
  fiche: FicheNotesPhotos
  userId: string
  // Noms des membres (userId vers « Prénom Nom ») : les notes locales ne portent que l'identifiant de l'auteur.
  noms: Record<string, string>
  photos: PhotoAffichee[]
  // Ajouter une note ou une photo (contribution affecté, écriture ou plus), et la raison si non.
  peutAjouter: boolean
  raisonRefus: string
  // La gestion peut retirer les notes des autres (réseau seulement).
  peutGerer: boolean
  actions: {
    ajouterPhoto: ActionTiroir
    retirerPhoto: ActionTiroir
    retirerNote: ActionTiroir
  }
}

export function NotesEtPhotos({ fiche, userId, noms, photos, peutAjouter, raisonRefus, peutGerer, actions }: Props) {
  const moteur = useMoteurSynchro()
  const etat = useEtatSynchro()
  const lignes = useTable("core_note")
  const [nouvelleOuverte, setNouvelleOuverte] = useState(false)
  const [nouvelle, setNouvelle] = useState("")
  const [edition, setEdition] = useState<{ id: string; texte: string; original: string } | null>(null)
  const [aRetirer, setARetirer] = useState<string | null>(null)

  // Les notes de cette fiche, de la base locale : elles s'affichent hors ligne, avec « En attente » si pas encore envoyées.
  const notes = useMemo(
    () =>
      lignes
        .filter((ligne) => ligne.app === fiche.app && ligne.ficheType === fiche.ficheType && ligne.ficheId === fiche.ficheId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [lignes, fiche.app, fiche.ficheType, fiche.ficheId],
  )

  const nomDe = (auteur: string | null) => (auteur === userId ? "Toi" : (auteur && noms[auteur]) || "Membre de l'équipe")

  async function creer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    const texte = nouvelle.trim()
    if (!texte) return
    await moteur.ecrireLocal("core_note", {
      type: "creer",
      id: newId(),
      champs: { app: fiche.app, ficheType: fiche.ficheType, ficheId: fiche.ficheId, texte },
    })
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

  async function retirerMaNote(id: string) {
    await moteur.ecrireLocal("core_note", { type: "supprimer", id })
    setARetirer(null)
  }

  return (
    <section aria-labelledby="notes-titre" className="flex flex-col gap-6">
      <h2 id="notes-titre" className="titre-rallye text-2xl">
        Notes et photos
      </h2>

      {/* Notes */}
      <div className="flex flex-col gap-3">
        {peutAjouter ? (
          <button type="button" onClick={() => setNouvelleOuverte(true)} className={`${BOUTON} w-fit`}>
            Ajouter une note
          </button>
        ) : (
          <p className="text-sm text-texte-discret">{raisonRefus}</p>
        )}

        {peutAjouter && (
          <Tiroir
            ouvert={nouvelleOuverte}
            onOuvertChange={(ouvert) => {
              setNouvelleOuverte(ouvert)
              if (!ouvert) setNouvelle("")
            }}
            titre="Nouvelle note"
            modifie={nouvelle.trim() !== ""}
            principal={
              <button type="submit" form="note-fiche-formulaire" disabled={nouvelle.trim() === ""} className={BOUTON}>
                Enregistrer la note
              </button>
            }
          >
            <form id="note-fiche-formulaire" onSubmit={creer} className="flex flex-col gap-3">
              <label htmlFor="note-fiche-texte" className="font-medium">
                Ce qu'il faut retenir
              </label>
              <textarea
                id="note-fiche-texte"
                autoFocus
                value={nouvelle}
                onChange={(e) => setNouvelle(e.target.value)}
                rows={5}
                maxLength={4000}
                className={CHAMP}
              />
            </form>
          </Tiroir>
        )}

        {notes.length === 0 && <p className="text-texte-discret">Aucune note sur cette fiche.</p>}

        <ul className="flex flex-col gap-3">
          {notes.map((note) => {
            const auteurId = typeof note.createdBy === "string" ? note.createdBy : null
            const estMienne = auteurId === userId
            return (
              <li key={note.id} className="rounded-lg border border-bordure bg-surface p-4">
                <p className="whitespace-pre-wrap text-base">{String(note.texte)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-texte-discret">
                  <span>{nomDe(auteurId)}</span>
                  <span>· {dateCourte.format(new Date(note.createdAt))}</span>
                  {note.enAttente && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-texte">En attente d'envoi</span>}
                  {estMienne && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEdition({ id: note.id, texte: String(note.texte), original: String(note.texte) })}
                        className={LIEN}
                      >
                        Modifier
                      </button>
                      <button type="button" onClick={() => setARetirer(note.id)} className={LIEN}>
                        Retirer
                      </button>
                    </>
                  )}
                  {!estMienne && peutGerer && etat.enLigne && (
                    <TiroirAction
                      libelle="Retirer"
                      danger
                      titre="Retirer cette note ?"
                      question="La note disparaît de la fiche. Elle reste dans le journal."
                      libelleBouton="Retirer la note"
                      action={actions.retirerNote}
                    >
                      <input type="hidden" name="ordreId" value={fiche.ficheId} />
                      <input type="hidden" name="noteId" value={note.id} />
                    </TiroirAction>
                  )}
                  {!estMienne && peutGerer && !etat.enLigne && <span>Retirer la note d'un autre : il faut du réseau.</span>}
                </div>
              </li>
            )
          })}
        </ul>

        <Tiroir
          ouvert={edition !== null}
          onOuvertChange={(ouvert) => {
            if (!ouvert) setEdition(null)
          }}
          titre="Modifier la note"
          modifie={edition !== null && edition.texte !== edition.original}
          principal={
            <button type="submit" form="note-fiche-edition" disabled={edition === null || edition.texte.trim() === ""} className={BOUTON}>
              Enregistrer
            </button>
          }
        >
          <form id="note-fiche-edition" onSubmit={enregistrerEdition} className="flex flex-col gap-3">
            <textarea
              aria-label="Modifier la note"
              value={edition?.texte ?? ""}
              onChange={(e) => setEdition((actuelle) => (actuelle ? { ...actuelle, texte: e.target.value } : actuelle))}
              rows={5}
              maxLength={4000}
              className={CHAMP}
            />
          </form>
        </Tiroir>

        <Tiroir
          ouvert={aRetirer !== null}
          onOuvertChange={(ouvert) => {
            if (!ouvert) setARetirer(null)
          }}
          titre="Retirer cette note ?"
          principal={
            <button type="button" onClick={() => aRetirer && retirerMaNote(aRetirer)} className={BOUTON}>
              Retirer la note
            </button>
          }
        >
          <p className="text-sm">La note disparaît de la fiche. Elle reste dans le journal.</p>
        </Tiroir>
      </div>

      {/* Photos : réseau seulement */}
      <div className="flex flex-col gap-3">
        <h3 className="font-medium">Photos</h3>
        {!etat.enLigne && <p className="text-sm text-texte-discret">Photo : il faut du réseau.</p>}
        {peutAjouter &&
          (etat.enLigne ? (
            <TiroirAction libelle="Ajouter une photo" titre="Ajouter une photo" libelleBouton="Envoyer la photo" libelleEnCours="Envoi…" action={actions.ajouterPhoto}>
              <input type="hidden" name="ordreId" value={fiche.ficheId} />
              <input type="file" name="fichier" accept="image/*" capture="environment" required className={CHAMP} />
            </TiroirAction>
          ) : (
            <button type="button" disabled className={BOUTON_SECONDAIRE}>
              Ajouter une photo
            </button>
          ))}

        {photos.length === 0 && <p className="text-texte-discret">Aucune photo sur cette fiche.</p>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id} className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-2">
              {/* Vignette servie par /api/fichiers : les droits de lecture sont contrôlés au serveur. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/fichiers/${photo.fileId}`} alt={photo.nom} loading="lazy" className="aspect-square w-full rounded-md object-cover" />
              <p className="text-sm text-texte-discret">
                {photo.auteur} · {dateCourte.format(new Date(photo.creeLe))}
              </p>
              {photo.retirable && etat.enLigne && (
                <TiroirAction
                  libelle="Retirer"
                  danger
                  titre="Retirer cette photo ?"
                  question="La photo disparaît de la fiche. Le fichier reste en archive."
                  libelleBouton="Retirer la photo"
                  action={actions.retirerPhoto}
                >
                  <input type="hidden" name="ordreId" value={fiche.ficheId} />
                  <input type="hidden" name="photoId" value={photo.id} />
                </TiroirAction>
              )}
              {photo.retirable && !etat.enLigne && <p className="text-sm text-texte-discret">Retrait : il faut du réseau.</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
