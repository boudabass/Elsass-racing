// Liste d'un dossier (brief 5.3, §5) : titre, type, validité, propriétaire, zone en texte et en couleur. Filtres type et
// propriétaire dans l'URL. Les archivés sont dans un tiroir, jamais dans la liste courante.

import Link from "next/link"

import { BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

import type { DossierDonnees, LigneDocument } from "../lectures-serveur"
import { COULEUR_ZONE, LIBELLE_TYPE_DOCUMENT, LIBELLE_VISIBILITE } from "../libelles"
import { TYPES_DOCUMENT, typeRedondant, type TypeDocument } from "../regles"

import { NouveauDocument } from "./formulaires-documents"
import { ModifierDossier, SupprimerDossier } from "./formulaires-dossier"
import { TiroirListe } from "./tiroir-liste"

export function DossierEcran({
  donnees,
  rangement,
  type,
  proprietaire,
}: {
  donnees: DossierDonnees
  rangement: Array<{ param: string; nom: string }>
  type: string | null
  proprietaire: string | null
}) {
  const sousTitre = donnees.partiel
    ? "Tu ne vois ici que les documents qui te sont ouverts."
    : donnees.systeme
      ? "Dossier type"
      : `Qui peut voir : ${LIBELLE_VISIBILITE[donnees.visibilite]}`

  return (
    <section className="flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="titre-rallye text-3xl">{donnees.nom}</h1>
            <p className="text-texte-discret">{sousTitre}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {donnees.peutGerer.permis && <ModifierDossier id={donnees.param} nom={donnees.nom} visibilite={donnees.visibilite} systeme={donnees.systeme} />}
            {donnees.peutGerer.permis && !donnees.systeme && <SupprimerDossier id={donnees.param} nom={donnees.nom} />}
            {donnees.peutAjouter.permis ? (
              <NouveauDocument rangement={rangement} dossierDefaut={donnees.param} />
            ) : (
              <p className="text-sm text-texte-discret">{donnees.peutAjouter.raison}</p>
            )}
          </div>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Type</span>
            <select name="type" aria-label="Type" defaultValue={type ?? ""} className="min-h-11 rounded-md border border-bordure-champ bg-surface px-3 py-2">
              <option value="">Tous les types</option>
              {TYPES_DOCUMENT.map((valeur: TypeDocument) => (
                <option key={valeur} value={valeur}>
                  {LIBELLE_TYPE_DOCUMENT[valeur]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Propriétaire</span>
            <select name="proprietaire" aria-label="Propriétaire" defaultValue={proprietaire ?? "tous"} className="min-h-11 rounded-md border border-bordure-champ bg-surface px-3 py-2">
              <option value="tous">Tous</option>
              <option value="moi">Mes documents</option>
              {donnees.proprietaires.map((personne) => (
                <option key={personne.id} value={personne.id}>
                  {personne.nom}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={BOUTON_SECONDAIRE}>
            Filtrer
          </button>
        </form>
      </header>

      {donnees.lignes.length === 0 ? (
        <p className="text-texte-discret">Aucun document dans ce dossier pour ces filtres.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {donnees.lignes.map((ligne) => (
            <LigneDossier key={ligne.id} ligne={ligne} />
          ))}
        </ul>
      )}

      <div>
        <TiroirListe libelle={`Archivés (${donnees.archives.length})`} titre="Documents archivés" sousTitre="Ils ne comptent plus dans les échéances. Tu peux les remettre en service depuis leur fiche.">
          {donnees.archives.length === 0 ? (
            <p className="text-sm text-texte-discret">Aucun document archivé.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {donnees.archives.map((ligne) => (
                <LigneDossier key={ligne.id} ligne={ligne} />
              ))}
            </ul>
          )}
        </TiroirListe>
      </div>
    </section>
  )
}

function LigneDossier({ ligne }: { ligne: LigneDocument }) {
  // Le type ne se répète pas quand il dit la même chose que le titre.
  const type = typeRedondant(ligne.titre, ligne.typeLibelle) ? null : ligne.typeLibelle
  return (
    <li>
      <Link href={`/apps/documents/document/${ligne.id}`} className="flex min-h-11 flex-col gap-1 rounded-lg border border-bordure bg-surface p-3 hover:bg-surface-2">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">{ligne.titre}</span>
          {ligne.zone && <span className={`text-sm font-medium ${COULEUR_ZONE[ligne.zone]}`}>{ligne.validite}</span>}
          {!ligne.zone && <span className="text-sm text-texte-discret">{ligne.validite}</span>}
        </span>
        <span className="text-sm text-texte-discret">
          {[type, ligne.proprietaire, ligne.statut === "archive" ? "archivé" : null].filter(Boolean).join(" · ")}
        </span>
      </Link>
    </li>
  )
}
