// Fiche d'un document (brief 5.3, §5) : aperçu du fichier courant, échéance avec jauge, champs, historique des versions,
// partage interne. Chaque geste refusé affiche sa raison ; la jauge se lit aussi par son texte, jamais par la couleur seule.

import Link from "next/link"

import { LIEN } from "@/lib/classes-formulaire"

import type { AccesLigne, FicheDocument } from "../lectures-serveur"
import { COULEUR_ZONE, LIBELLE_NIVEAU_ACCES, LIBELLE_TYPE_DOCUMENT, LIBELLE_VISIBILITE } from "../libelles"
import { typeRedondant, type Decision, type TypeDocument } from "../regles"

import { AjouterVersion, ArchiverOuRemettre, DeplacerDocument, ModifierDocument, PartagerDocument, RetirerPartage } from "./formulaires-documents"
import { ListePartages, PartagerParLien } from "./partages"
import { TiroirListe } from "./tiroir-liste"
import type { PartagesDonnees } from "../lectures-partages"

// Au-delà de cette durée, la jauge est pleine. C'est le seuil orange des échéances (60 jours).
const JAUGE_JOURS = 60

const IMAGE = /\.(png|jpe?g|webp|gif)$/i

// Date civile AAAA-MM-JJ lue telle quelle : pas de décalage de fuseau.
function dateFr(iso: string): string {
  const [annee, mois, jour] = iso.split("-")
  return `${jour}/${mois}/${annee}`
}

// Raisons des gestes refusés, sans doublon : un même refus peut couvrir plusieurs boutons.
function raisonsRefusees(decisions: Decision[]): string[] {
  const raisons = decisions.flatMap((decision) => (decision.permis ? [] : [decision.raison]))
  return Array.from(new Set(raisons))
}

export function FicheEcran({
  fiche,
  rangement,
  personnes,
  partages,
  contacts,
  ouvrirRenouvellement,
}: {
  fiche: FicheDocument
  rangement: Array<{ param: string; nom: string }>
  personnes: Array<{ id: string; nom: string }>
  // Liens de partage de ce document seulement ; null pour qui ne voit pas les liens (assistance).
  partages: PartagesDonnees | null
  contacts: Array<{ id: string; libelle: string }>
  // Entrée depuis Échéances (« Renouveler ») : le tiroir « Remplacer le fichier » s'ouvre à l'affichage.
  ouvrirRenouvellement: boolean
}) {
  const versionCourante = fiche.versions[0] ?? null
  const archive = fiche.statut === "archive"
  const raisons = raisonsRefusees([fiche.gestes.modifier, fiche.gestes.remplacer, fiche.gestes.deplacer, fiche.gestes.archiver, fiche.gestes.partager, ...(fiche.liensVisibles ? [fiche.gestes.partageLien] : [])])
  // Le type ne se répète pas quand il dit la même chose que le titre.
  const typeLibelle = LIBELLE_TYPE_DOCUMENT[fiche.typeDocument as TypeDocument]
  const sousTitre = [typeRedondant(fiche.titre, typeLibelle) ? null : typeLibelle, archive ? "archivé" : null].filter(Boolean).join(" · ")

  return (
    <section className="flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href={`/apps/documents/dossier/${fiche.dossierParam}`} className={LIEN}>
          {fiche.dossierNom}
        </Link>
        <h1 className="titre-rallye text-3xl">{fiche.titre}</h1>
        {sousTitre && <p className="text-texte-discret">{sousTitre}</p>}
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
          <h2 className="font-semibold">Fichier</h2>
          {versionCourante ? (
            <>
              {IMAGE.test(versionCourante.nomFichier) && (
                <a href={`/api/fichiers/${versionCourante.fichierId}`} target="_blank" rel="noopener noreferrer">
                  {/* Aperçu seulement : le nom du fichier suit en texte, le lien ouvre l'original. */}
                  <img
                    src={`/api/fichiers/${versionCourante.fichierId}`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="aspect-video w-full rounded-md border border-bordure object-contain"
                  />
                </a>
              )}
              <a href={`/api/fichiers/${versionCourante.fichierId}`} target="_blank" rel="noopener noreferrer" className={`${LIEN} self-start break-all`}>
                {versionCourante.nomFichier}
              </a>
              <p className="text-sm text-texte-discret">
                Version {versionCourante.numero} · {dateFr(versionCourante.date)} · {versionCourante.auteur}
              </p>
            </>
          ) : (
            <p className="text-texte-discret">Aucun fichier</p>
          )}
          <AjouterVersion fiche={fiche} libelle={versionCourante ? "Remplacer le fichier" : "Ajouter un fichier"} ouvertDepart={ouvrirRenouvellement} />
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
          <h2 className="font-semibold">Informations</h2>
          {fiche.dateValidite ? (
            <>
              <p className={`text-lg font-semibold ${fiche.zone ? COULEUR_ZONE[fiche.zone] : ""}`}>{fiche.texteEcheance}</p>
              <p className="text-sm text-texte-discret">Valable jusqu&apos;au {dateFr(fiche.dateValidite)}</p>
              {fiche.zone && fiche.joursRestants !== null && (
                <div
                  className={`h-3 w-full overflow-hidden rounded-full bg-surface-2 ${COULEUR_ZONE[fiche.zone]}`}
                  role="meter"
                  aria-label="Temps restant avant l'échéance"
                  aria-valuemin={0}
                  aria-valuemax={JAUGE_JOURS}
                  aria-valuenow={Math.min(Math.max(fiche.joursRestants, 0), JAUGE_JOURS)}
                  aria-valuetext={fiche.texteEcheance}
                >
                  <div className="h-full rounded-full bg-current" style={{ width: `${Math.min(Math.max(fiche.joursRestants, 0), JAUGE_JOURS) * (100 / JAUGE_JOURS)}%` }} />
                </div>
              )}
            </>
          ) : (
            <p className="text-texte-discret">Sans échéance</p>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-texte-discret">Référence</dt>
            <dd>{fiche.reference ?? "—"}</dd>
            <dt className="text-texte-discret">Émis le</dt>
            <dd>{fiche.dateEmission ? dateFr(fiche.dateEmission) : "—"}</dd>
            <dt className="text-texte-discret">Qui peut voir</dt>
            <dd>{LIBELLE_VISIBILITE[fiche.visibilite]}</dd>
            <dt className="text-texte-discret">Notes</dt>
            <dd className="whitespace-pre-line">{fiche.notes ?? "—"}</dd>
          </dl>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <ModifierDocument fiche={fiche} />
        <DeplacerDocument fiche={fiche} rangement={rangement} />
        <ArchiverOuRemettre fiche={fiche} />
        {fiche.gestes.partager.permis && <PartagerDocument fiche={fiche} personnes={personnes} />}
        {fiche.liensVisibles && <PartagerParLien documentId={fiche.id} contacts={contacts} desactive={!fiche.gestes.partageLien.permis} />}
      </div>
      {raisons.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-texte-discret">
          {raisons.map((raison) => (
            <li key={raison}>{raison}</li>
          ))}
        </ul>
      )}

      {fiche.gestes.partager.permis && <AccesPartage acces={fiche.acces} />}

      {fiche.liensVisibles && partages && (
        <div className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
          <h2 className="font-semibold">Liens de partage</h2>
          <ListePartages actifs={partages.actifs} inactifs={partages.inactifs} />
        </div>
      )}

      <div>
        <TiroirListe
          libelle={`Historique des versions (${fiche.versions.length})`}
          titre="Historique des versions"
          sousTitre="Chaque nouveau fichier devient la version en cours. Les anciennes restent consultables ici."
        >
          {fiche.versions.length === 0 ? (
            <p className="text-sm text-texte-discret">Aucune version pour l&apos;instant.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {fiche.versions.map((version) => (
                <li key={version.id} className="flex flex-col gap-1 text-sm">
                  <span>
                    <span className="font-semibold">Version {version.numero}</span> · {dateFr(version.date)} · {version.auteur}
                  </span>
                  <a href={`/api/fichiers/${version.fichierId}`} target="_blank" rel="noopener noreferrer" className={`${LIEN} self-start break-all`}>
                    {version.nomFichier}
                  </a>
                  {version.commentaire && <span className="text-texte-discret">{version.commentaire}</span>}
                </li>
              ))}
            </ol>
          )}
        </TiroirListe>
      </div>
    </section>
  )
}

// Accès internes accordés sur ce document. Visible seulement pour qui peut partager (niveau écriture).
function AccesPartage({ acces }: { acces: AccesLigne[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
      <h2 className="font-semibold">Partagé avec</h2>
      {acces.length === 0 ? (
        <p className="text-sm text-texte-discret">Aucun partage en plus de ceux qui voient déjà ce dossier.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {acces.map((ligne) => (
            <li key={ligne.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {ligne.nom} · {LIBELLE_NIVEAU_ACCES[ligne.niveau]}
              </span>
              <RetirerPartage acces={ligne} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
