// Préparation de l'épreuve (tâche 5.6, §1.1) : l'épreuve, la jauge globale, la barre haute, une carte par liste.
import Link from "next/link"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { BOUTON_SECONDAIRE, CHAMP, LIEN } from "@/lib/classes-formulaire"

import { creerListeViergeAction } from "../actions"
import type { pagePreparation } from "../lectures-ecran"
import { COULEUR_ZONE, LIBELLES_PHASE, LIBELLES_ZONE, PHASES_ORDONNEES } from "../libelles"
import type { Phase } from "../services-serveur"

type Donnees = Awaited<ReturnType<typeof pagePreparation>>

// Date de calendrier (minuit UTC, comme @db.Date) : formatée en UTC pour ne pas glisser d'un jour.
const dateLongue = (date: Date) => date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

export function PagePreparation({ donnees }: { donnees: Donnees }) {
  const { epreuve, epreuves, niveau } = donnees
  if (!epreuve) {
    return <p className="py-12 text-center text-lg text-texte-discret">Aucune épreuve à venir. Les épreuves s'ajoutent dans Saison.</p>
  }
  const peutEcrire = niveau === "ecriture" || niveau === "gestion"
  const communes = donnees.listes.filter((liste) => liste.engagementId === null)
  const engagements = donnees.listes.filter((liste) => liste.engagementId !== null)
  const rangPhaseEnCours = PHASES_ORDONNEES.indexOf(donnees.phaseEnCours)
  const zoneGlobale = donnees.avancement >= 90 && donnees.critiquesOuverts === 0 ? "vert" : "orange"

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Épreuves" className="flex flex-wrap gap-3">
        {epreuves.map((e) => (
          <Link
            key={e.id}
            href={`/apps/checklist?epreuve=${e.id}`}
            aria-current={e.id === epreuve.id ? "page" : undefined}
            className={`${BOUTON_SECONDAIRE} ${e.id === epreuve.id ? "border-marque font-medium" : ""}`}
          >
            {e.nom}
          </Link>
        ))}
      </nav>

      {/* Barre haute de l'épreuve : phase en cours et critiques ouverts (956 §1, « barre haute permanente »). */}
      <section aria-label="Avancement" className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-5">
        <p className="text-sm text-texte-discret">
          {epreuve.nom} · {dateLongue(epreuve.dateDebut)}
        </p>
        <p className="chiffre text-5xl font-semibold" aria-label={`Avancement global : ${donnees.avancement} %`}>
          {donnees.avancement} %
        </p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div className="h-full bg-marque" style={{ width: `${donnees.avancement}%` }} />
        </div>
        <p className={COULEUR_ZONE[zoneGlobale]}>{LIBELLES_ZONE[zoneGlobale]}</p>
        <p className="text-sm">
          Phase en cours : <span className="font-medium">{LIBELLES_PHASE[donnees.phaseEnCours]}</span>
          {" · "}
          {donnees.critiquesOuverts === 0
            ? "Aucun point critique ouvert"
            : `${donnees.critiquesOuverts} point${donnees.critiquesOuverts > 1 ? "s" : ""} critique${donnees.critiquesOuverts > 1 ? "s" : ""} ouvert${donnees.critiquesOuverts > 1 ? "s" : ""}`}
        </p>
      </section>

      <Groupe titre="Communes à l'épreuve" listes={communes} rangPhaseEnCours={rangPhaseEnCours} vide="Aucune liste commune pour l'instant." />
      <Groupe titre="Par engagement" listes={engagements} rangPhaseEnCours={rangPhaseEnCours} vide="Aucune liste d'engagement pour l'instant." />

      {peutEcrire && (
        <TiroirAction
          libelle="+ Nouvelle liste vierge"
          titre="Nouvelle liste vierge pour l'épreuve"
          sousTitre={epreuve.nom}
          action={creerListeViergeAction}
          libelleBouton="Créer la liste"
        >
          <input type="hidden" name="epreuveId" value={epreuve.id} />
          <label className="flex flex-col gap-1">
            <span className="text-sm">Titre</span>
            <input name="titre" required maxLength={120} className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Phase</span>
            <select name="phase" defaultValue="avant_depart" className={CHAMP}>
              {PHASES_ORDONNEES.map((phase: Phase) => (
                <option key={phase} value={phase}>
                  {LIBELLES_PHASE[phase]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="ouverteAssistance" className="size-5" /> Ouverte à l'assistance
          </label>
        </TiroirAction>
      )}
    </div>
  )
}

function Groupe({
  titre,
  listes,
  rangPhaseEnCours,
  vide,
}: {
  titre: string
  listes: Donnees["listes"]
  rangPhaseEnCours: number
  vide: string
}) {
  return (
    <section aria-label={titre} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{titre}</h2>
      {listes.length === 0 ? (
        <p className="text-texte-discret">{vide}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {listes.map((liste) => {
            // Une liste d'une phase postérieure à la phase en cours ouvre l'avertissement avant phase (5.6 §1.5).
            const avertir = PHASES_ORDONNEES.indexOf(liste.phase as Phase) > rangPhaseEnCours
            return (
              <li key={liste.id}>
                <Link
                  href={`/apps/checklist/liste/${liste.id}${avertir ? "?avertir=1" : ""}`}
                  className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-4 hover:bg-surface-2"
                >
                  <span className="font-medium">{liste.titre}</span>
                  <span className="text-sm text-texte-discret">{LIBELLES_PHASE[liste.phase as Phase]}</span>
                  <span className="chiffre text-2xl">{liste.avancement} %</span>
                  <span className={COULEUR_ZONE[liste.zone as "vert" | "orange"]}>{LIBELLES_ZONE[liste.zone as "vert" | "orange"]}</span>
                  <span className="text-sm">
                    {liste.critiquesOuverts === 0
                      ? "Aucun point critique ouvert"
                      : `${liste.critiquesOuverts} point${liste.critiquesOuverts > 1 ? "s" : ""} critique${liste.critiquesOuverts > 1 ? "s" : ""} ouvert${liste.critiquesOuverts > 1 ? "s" : ""}`}
                  </span>
                  <span className={LIEN}>Ouvrir la liste</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
