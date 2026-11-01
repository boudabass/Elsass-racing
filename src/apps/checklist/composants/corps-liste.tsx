"use client"

// Corps de la liste (tâche 5.6b, brief §1) : en-tête, sections et coches. En ligne, une coche passe par l'action serveur
// (comme avant). Hors ligne, elle s'écrit dans la base locale et part à la synchro (règle « coche la plus récente »,
// décidée par le serveur). Les statuts affichés viennent de la base locale quand elle a la ligne, sinon du rendu serveur.
// Les parties qui demandent le réseau (mode terrain, ajout de point, avertissement) arrivent en emplacements serveur.
import Link from "next/link"
import type { ReactNode } from "react"

import { FormulaireChecklist } from "./formulaire-checklist"
import { changerStatutPointAction } from "../actions"
import { COULEUR_ZONE, LIBELLES_PHASE, LIBELLES_STATUT_POINT, LIBELLES_ZONE } from "../libelles"
import { avancementPourcent, pointsCritiquesOuverts, zoneDeListe, type PointRegle, type StatutPoint } from "../regles"
import type { Phase } from "../services-serveur"
import { useEtatSynchro, useMoteurSynchro, useTable } from "@/core/synchro/client/react"
import { LIEN } from "@/lib/classes-formulaire"

export interface PointAffiche {
  id: string
  libelle: string
  critique: boolean
  statut: StatutPoint
}

export interface SectionAffichee {
  id: string
  titre: string
  items: PointAffiche[]
}

export function CorpsListe({
  listeId,
  titre,
  phase,
  terrain,
  peutCocher,
  sections,
  avertissement,
  modeTerrain,
  ajout,
}: {
  listeId: string
  titre: string
  phase: string
  terrain: boolean
  peutCocher: boolean
  sections: SectionAffichee[]
  avertissement: ReactNode
  modeTerrain: ReactNode
  ajout: ReactNode
}) {
  const moteur = useMoteurSynchro()
  const { enLigne } = useEtatSynchro()
  const locaux = useTable("checklist_item")
  const parId = new Map(locaux.filter((ligne) => ligne.deletedAt === null).map((ligne) => [ligne.id, ligne]))

  // Statut et attente : la base locale l'emporte sur le rendu serveur quand elle a la ligne.
  const sectionsAffichees = sections.map((section) => ({
    ...section,
    items: section.items.map((point) => {
      const local = parId.get(point.id)
      return local ? { ...point, statut: String(local.statut) as StatutPoint, enAttente: local.enAttente === true, local: true } : { ...point, enAttente: false, local: false }
    }),
  }))
  const points: Array<PointRegle & { id: string }> = sectionsAffichees.flatMap((section) => section.items)
  const avancement = avancementPourcent(points)
  const zone = zoneDeListe(points)
  const critiques = pointsCritiquesOuverts(points).length
  const tailleCoche = terrain ? "min-h-16 min-w-16 text-xl" : "min-h-11 min-w-11"

  return (
    <div className={`flex flex-col gap-6 ${terrain ? "text-xl leading-relaxed" : ""}`}>
      <header className="flex flex-col gap-2">
        <Link href="/apps/checklist" className={LIEN}>
          ← Préparation
        </Link>
        <h2 className={`font-semibold ${terrain ? "text-3xl" : "text-2xl"}`}>{titre}</h2>
        <p className="text-texte-discret">{LIBELLES_PHASE[phase as Phase]}</p>
        <p className="chiffre text-3xl font-semibold">{avancement} %</p>
        <p className={COULEUR_ZONE[zone]}>{LIBELLES_ZONE[zone]}</p>
        <p className="text-sm">
          {critiques === 0 ? "Aucun point critique ouvert" : `${critiques} point${critiques > 1 ? "s" : ""} critique${critiques > 1 ? "s" : ""} ouvert${critiques > 1 ? "s" : ""}`}
        </p>
        {!enLigne && <p className="rounded-md border border-bordure p-3 text-sm">Hors ligne : tes coches restent sur cet appareil et partent au retour du réseau.</p>}
      </header>

      {avertissement}

      <div>
        {enLigne ? (
          modeTerrain
        ) : (
          <p className="text-sm text-texte-discret">
            {terrain ? "Mode terrain actif. Le désactiver demande le réseau." : "Mode terrain : demande le réseau. Active-le avant de partir."}
          </p>
        )}
      </div>

      {sectionsAffichees.length === 0 && <p className="text-texte-discret">Cette liste n'a pas encore de section.</p>}

      {sectionsAffichees.map((section) => (
        <section key={section.id} aria-label={section.titre} className="flex flex-col gap-3">
          <h3 className={`font-semibold ${terrain ? "text-2xl" : "text-lg"}`}>{section.titre}</h3>
          <ul className="flex flex-col gap-2">
            {section.items.map((point) => {
              const coche = point.statut === "fait"
              const cible = coche ? "a_faire" : "fait"
              return (
                <li key={point.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-bordure bg-surface p-3">
                  {!peutCocher ? (
                    <span className="text-sm">{LIBELLES_STATUT_POINT[point.statut]}</span>
                  ) : enLigne ? (
                    <FormulaireChecklist
                      action={changerStatutPointAction}
                      champsCaches={{ pointId: point.id, statut: cible }}
                      libelle={coche ? "✓ Fait" : "Faire"}
                      classe={`${tailleCoche} rounded-md px-3 font-medium ${coche ? "border border-marque text-marque" : "bg-marque text-marque-texte"}`}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={!point.local}
                      onClick={() => void moteur.ecrireLocal("checklist_item", { type: "modifier", id: point.id, champs: { statut: cible, cocheLe: new Date().toISOString() } })}
                      className={`${tailleCoche} rounded-md px-3 font-medium disabled:opacity-60 ${coche ? "border border-marque text-marque" : "bg-marque text-marque-texte"}`}
                    >
                      {coche ? "✓ Fait" : "Faire"}
                    </button>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">
                      {point.libelle}
                      {point.critique && <span className="block text-sm font-semibold">Critique</span>}
                    </span>
                    <span className="text-sm text-texte-discret">
                      {LIBELLES_STATUT_POINT[point.statut]}
                      {point.enAttente && " · en attente d'envoi"}
                      {!enLigne && !point.local && " · pas sur cet appareil : ouvre la liste en ligne avant de partir"}
                    </span>
                  </div>
                  <Link href={`/apps/checklist/liste/${listeId}?point=${point.id}`} className={`${LIEN} shrink-0`}>
                    Détail
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {enLigne ? ajout : peutCocher && sectionsAffichees.length > 0 && <p className="text-sm text-texte-discret">Ajouter un point demande le réseau.</p>}
    </div>
  )
}
