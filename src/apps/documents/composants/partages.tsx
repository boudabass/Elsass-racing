"use client"

// Partage par lien (tâche 5.4, brief §1). Le lien n'est montré qu'une fois, à la création, avec un bouton « Copier » ; la
// liste ensuite ne montre jamais le jeton. Révoquer passe par un tiroir de confirmation, pas par un confirm() du navigateur.

import { useState, useTransition, type ReactNode } from "react"

import { Tiroir } from "@/components/formulaire/tiroir"
import { BOUTON, BOUTON_DANGER, BOUTON_SECONDAIRE, CHAMP } from "@/lib/classes-formulaire"

import { creerLienPartageAction, revoquerLienPartageAction, type ResultatLien } from "../actions"
import { DUREES_LIEN_JOURS, DUREE_LIEN_PAR_DEFAUT } from "../regles"
import type { LignePartage } from "../lectures-partages"

function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{libelle}</span>
      {children}
    </label>
  )
}

const dateLisible = (date: Date) =>
  date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })

// Création d'un lien : destinataire en texte (obligatoire), contact facultatif, durée 1, 7 ou 30 jours.
export function PartagerParLien({ documentId, contacts }: { documentId: string; contacts: Array<{ id: string; libelle: string }> }) {
  const [ouvert, setOuvert] = useState(false)
  const [resultat, setResultat] = useState<ResultatLien | null>(null)
  const [enCours, demarrer] = useTransition()
  const [copie, setCopie] = useState(false)

  const lien = resultat?.ok ? `${window.location.origin}/d/${resultat.jeton}` : null

  function envoyer(donnees: FormData) {
    donnees.set("id", documentId)
    demarrer(async () => {
      setResultat(await creerLienPartageAction(null, donnees))
    })
  }

  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => { setResultat(null); setCopie(false); setOuvert(true) }} className={BOUTON_SECONDAIRE}>
        Partager par lien
      </button>
      <Tiroir
        ouvert={ouvert}
        onOuvertChange={setOuvert}
        titre="Partager par lien"
        sousTitre="Un lien temporaire, révocable à tout moment. Chaque ouverture est comptée."
        libelleAnnuler="Fermer"
      >
        {lien && resultat?.ok ? (
          <div className="flex flex-col gap-3">
            <p className="font-semibold">Copie le lien maintenant : il ne sera plus affiché.</p>
            <p className="break-all rounded-md border border-bordure bg-surface-2 p-3 font-mono text-sm">{lien}</p>
            <p className="text-sm text-texte-discret">Valable jusqu&apos;au {dateLisible(new Date(resultat.finLe))}.</p>
            <button
              type="button"
              className={BOUTON}
              onClick={() => {
                void navigator.clipboard?.writeText(lien)
                setCopie(true)
              }}
            >
              {copie ? "Lien copié" : "Copier le lien"}
            </button>
          </div>
        ) : (
          <form action={envoyer} className="flex flex-col gap-4">
            <Champ libelle="Destinataire">
              <input name="destinataire" required maxLength={120} placeholder="Préfecture, ASA Alsace…" className={CHAMP} />
            </Champ>
            <Champ libelle="Contact (facultatif)">
              <select name="contactId" defaultValue="" className={CHAMP}>
                <option value="">Aucun contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.libelle}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Durée">
              <select name="jours" defaultValue={String(DUREE_LIEN_PAR_DEFAUT)} className={CHAMP}>
                {DUREES_LIEN_JOURS.map((jours) => (
                  <option key={jours} value={jours}>
                    {jours === 1 ? "1 jour" : `${jours} jours`}
                  </option>
                ))}
              </select>
            </Champ>
            {resultat && !resultat.ok && (
              <p role="alert" className="text-sm text-etat-rouge">
                {resultat.message}
              </p>
            )}
            <button type="submit" className={BOUTON} disabled={enCours}>
              {enCours ? "Création…" : "Créer le lien"}
            </button>
          </form>
        )}
      </Tiroir>
    </>
  )
}

// Liste des liens : actifs d'abord ; expirés et révoqués en dessous, grisés et marqués en texte.
export function ListePartages({ actifs, inactifs }: { actifs: LignePartage[]; inactifs: LignePartage[] }) {
  if (actifs.length === 0 && inactifs.length === 0) return <p className="text-texte-discret">Aucun lien de partage pour l&apos;instant.</p>
  return (
    <div className="flex flex-col gap-6">
      {actifs.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Liens actifs">
          {actifs.map((lien) => (
            <LigneLien key={lien.id} lien={lien} />
          ))}
        </ul>
      )}
      {inactifs.length > 0 && (
        <ul className="flex flex-col gap-3 opacity-70" aria-label="Liens expirés et révoqués">
          {inactifs.map((lien) => (
            <LigneLien key={lien.id} lien={lien} />
          ))}
        </ul>
      )}
    </div>
  )
}

function LigneLien({ lien }: { lien: LignePartage }) {
  const [ouvert, setOuvert] = useState(false)
  const [enCours, demarrer] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)
  const actif = lien.etat === "actif" || lien.etat === "indisponible"

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-semibold">{lien.documentTitre}</span>
        <span className="text-sm text-texte-discret">Pour {lien.destinataire}</span>
        <span className="text-sm">
          <span className="font-medium">{lien.libelleEtat}</span> · fin le {dateLisible(lien.finLe)} · {lien.ouvertures} ouverture
          {lien.ouvertures > 1 ? "s" : ""}
          {lien.derniereOuverture ? ` · dernière le ${dateLisible(lien.derniereOuverture)}` : ""}
        </span>
        {erreur && (
          <span role="alert" className="text-sm text-etat-rouge">
            {erreur}
          </span>
        )}
      </div>
      {lien.peutRevoquer && actif ? (
        <>
          <button type="button" aria-haspopup="dialog" onClick={() => setOuvert(true)} className={`${BOUTON_DANGER} shrink-0`}>
            Révoquer
          </button>
          <Tiroir
            ouvert={ouvert}
            onOuvertChange={setOuvert}
            titre="Révoquer ce lien ?"
            sousTitre="La page du lien ne s'ouvrira plus, pour personne. Tu ne peux pas le rétablir : il faudra en créer un autre."
            libelleAnnuler="Garder le lien"
          >
            <form
              action={(donnees: FormData) => {
                donnees.set("id", lien.id)
                demarrer(async () => {
                  const resultat = await revoquerLienPartageAction(null, donnees)
                  if (!resultat.ok) setErreur(resultat.message)
                  else setOuvert(false)
                })
              }}
              className="flex flex-col gap-3"
            >
              <button type="submit" className={BOUTON_DANGER} disabled={enCours}>
                {enCours ? "Révocation…" : "Révoquer le lien"}
              </button>
            </form>
          </Tiroir>
        </>
      ) : (
        <span className="text-sm text-texte-discret">{lien.libelleEtat}</span>
      )}
    </li>
  )
}
