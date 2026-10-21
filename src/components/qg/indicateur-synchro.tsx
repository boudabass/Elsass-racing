"use client"

import { useState } from "react"
import { Check, CloudOff, Clock, TriangleAlert, type LucideIcon } from "lucide-react"

import { Tiroir } from "@/components/formulaire/tiroir"
import { libelleEnvoisRefuses, type RefusLocal } from "@/core/synchro/client/refus"
import { useEtatSynchro, useRefusSynchro } from "@/core/synchro/client/react"
import { BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

// Indicateur discret de la barre haute : « 1 envoi refusé », « Hors ligne », « 3 modifications en attente », ou
// « Synchronisé il y a 2 min ». Sur téléphone, une icône par état ; un refus affiche aussi son texte, car il attend
// une action. L'état ne se dit jamais par la couleur seule. Au toucher, un tiroir « État de la synchro » : les envois
// refusés y sont listés avec leur raison, et « Compris » les efface (brief 4.3b). Un conflit n'apparaît pas ici :
// il est dans le journal de la fiche.
export function IndicateurSynchro() {
  const etat = useEtatSynchro()
  const { refus, effacer } = useRefusSynchro()
  const [ouvert, setOuvert] = useState(false)

  let libelle = "En ligne"
  let explication = "Tout ce que tu saisis part tout de suite."
  let couleur = "text-etat-ok"
  let Icone: LucideIcon = Check
  // Un refus non lu passe avant tout : l'envoi n'a pas été gardé par le serveur, la personne doit le voir.
  if (etat.refus > 0) {
    libelle = libelleEnvoisRefuses(etat.refus)
    explication = "Le serveur n'a pas gardé ces envois. Ouvre la liste pour voir la raison, puis efface-les une fois lus."
    couleur = "text-etat-rouge"
    Icone = TriangleAlert
  } else if (etat.enAttente > 0) {
    // Les modifications en attente passent avant l'état du réseau : c'est ce que la personne doit savoir.
    libelle = `${etat.enAttente} ${etat.enAttente > 1 ? "modifications" : "modification"} en attente`
    explication = "Elles sont gardées sur cet appareil et partent dès que la connexion le permet."
    couleur = etat.enLigne ? "text-texte-discret" : "text-etat-orange"
    Icone = Clock
  } else if (!etat.enLigne) {
    libelle = "Hors ligne"
    explication = "Ce que tu saisis est gardé sur cet appareil et part dès que la connexion revient."
    couleur = "text-etat-orange"
    Icone = CloudOff
  } else if (etat.derniereSync) {
    libelle = `Synchronisé ${depuis(etat.derniereSync)}`
    explication = "Tout ce que tu saisis part tout de suite."
    couleur = "text-texte-discret"
  }

  // Ce que lit un lecteur d'écran : l'état seul, sans la durée qui change à chaque minute.
  let etatAnnonce = libelle
  if (etat.refus === 0 && etat.enAttente === 0 && etat.enLigne && etat.derniereSync) etatAnnonce = "En ligne"

  const refusEnAttente = etat.refus > 0

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={libelle}
        onClick={() => setOuvert(true)}
        className={`cible-tactile flex items-center justify-center gap-1.5 px-1 text-xs ${couleur}`}
      >
        <Icone aria-hidden className={refusEnAttente ? "h-5 w-5" : "h-5 w-5 sm:hidden"} />
        <span aria-hidden className={`${refusEnAttente ? "hidden" : "hidden sm:block"} h-2 w-2 shrink-0 rounded-full bg-current`} />
        <span aria-hidden className={`${refusEnAttente ? "block" : "hidden sm:block"} max-w-[10rem] truncate`}>
          {libelle}
        </span>
      </button>
      <span role="status" className="sr-only">
        {etatAnnonce}
      </span>

      <Tiroir ouvert={ouvert} onOuvertChange={setOuvert} titre="État de la synchro" libelleAnnuler="Fermer">
        <div className="flex flex-col gap-5">
          {refus.length > 0 && (
            <section aria-labelledby="envois-refuses" className="flex flex-col gap-3">
              <h2 id="envois-refuses" className="text-base font-medium text-etat-rouge">
                Envois refusés
              </h2>
              <ul className="flex flex-col gap-3">
                {refus.map((envoi) => (
                  <li key={envoi.idOperation} className="flex flex-col gap-2 rounded-md border border-bordure p-3">
                    <DescriptionEnvoi envoi={envoi} />
                    <button
                      type="button"
                      aria-label={`Compris : ${envoi.libelle}${envoi.resume ? ` ${envoi.resume}` : ""}`}
                      onClick={() => void effacer(envoi.idOperation)}
                      className={`${BOUTON_SECONDAIRE} self-start`}
                    >
                      Compris
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="flex flex-col gap-2">
            <p className={`text-lg font-medium ${couleur}`}>{libelle}</p>
            <p className="text-texte-discret">{explication}</p>
          </div>
        </div>
      </Tiroir>
    </>
  )
}

function DescriptionEnvoi({ envoi }: { envoi: RefusLocal }) {
  return (
    <>
      <p className="font-medium">
        {envoi.libelle}
        {envoi.resume && <span className="font-normal"> : {envoi.resume}</span>}
      </p>
      <p className="text-sm text-texte-discret">Saisi le {dateSaisie(envoi.creeLe)}</p>
      <p className="text-sm">{envoi.raison}</p>
    </>
  )
}

function dateSaisie(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
}

function depuis(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return "à l'instant"
  return `il y a ${minutes} min`
}
