// Coffre-fort, accueil de Documents (brief 5.3, §5) : trois compteurs, une carte par dossier, « + ». Un bouton refusé
// affiche sa raison ; l'assistance ne voit pas « Dossier ».

import Link from "next/link"

import { BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

import type { CoffreDonnees } from "../lectures-serveur"
import { COULEUR_ZONE } from "../libelles"

import { NouveauDocument } from "./formulaires-documents"
import { NouveauDossier } from "./formulaires-dossier"

const COMPTEURS = (donnees: CoffreDonnees) => [
  { libelle: "Expirés ou à 7 jours", nombre: donnees.compteurs.rouge, classe: COULEUR_ZONE.rouge },
  { libelle: "À 60 jours", nombre: donnees.compteurs.orange, classe: COULEUR_ZONE.orange },
  { libelle: "À jour", nombre: donnees.compteurs.vert, classe: COULEUR_ZONE.vert },
]

export function CoffreEcran({ donnees, rangement }: { donnees: CoffreDonnees; rangement: Array<{ param: string; nom: string }> }) {
  return (
    <section className="flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="titre-rallye text-3xl">Coffre-fort</h1>
            <p className="text-texte-discret">
              {donnees.assistance ? "Tes documents, et ceux qui te sont ouverts." : "Les documents de la team, rangés par dossier."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {donnees.peutCreerDossier.permis && <NouveauDossier />}
            {donnees.peutAjouter.permis ? (
              <NouveauDocument rangement={rangement} />
            ) : (
              <p className="text-sm text-texte-discret">{donnees.peutAjouter.raison}</p>
            )}
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Échéances">
          {COMPTEURS(donnees).map((compteur) => (
            <li key={compteur.libelle} className="flex items-center justify-between gap-3 rounded-lg border border-bordure bg-surface p-4">
              <span className="text-sm text-texte-discret">{compteur.libelle}</span>
              <span className={`chiffre text-2xl font-semibold ${compteur.classe}`}>{compteur.nombre}</span>
            </li>
          ))}
        </ul>
      </header>

      {donnees.cartes.length === 0 ? (
        <p className="text-texte-discret">Aucun document pour l&apos;instant.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {donnees.cartes.map((carte) => (
            <li key={carte.param}>
              <Link
                href={`/apps/documents/dossier/${carte.param}`}
                className="flex min-h-11 flex-col gap-3 rounded-lg border border-bordure bg-surface p-4 hover:bg-surface-2"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate font-semibold">{carte.nom}</span>
                  {carte.zone && <span className={`text-sm font-medium ${COULEUR_ZONE[carte.zone]}`}>{carte.texteZone}</span>}
                </span>
                <span className="text-sm text-texte-discret">
                  {carte.nombre === 0 ? "Aucun document" : carte.nombre === 1 ? "1 document" : `${carte.nombre} documents`}
                  {carte.jauge ? ` · ${carte.jauge.presents} sur ${carte.jauge.attendus}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-texte-discret">
        <Link href="/qg" className={BOUTON_SECONDAIRE}>
          Retour au QG
        </Link>
      </p>
    </section>
  )
}
