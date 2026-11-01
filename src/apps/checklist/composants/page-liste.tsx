// Liste (tâche 5.6, §1.2 et §1.4) : sections, coche d'un appui, avertissement avant phase, mode terrain, ajout de point.
import Link from "next/link"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { BOUTON_SECONDAIRE, CHAMP, LIEN } from "@/lib/classes-formulaire"

import { basculerModeTerrainAction, ajouterPointAction, changerStatutPointAction } from "../actions"
import type { pageListe } from "../lectures-ecran"
import { COULEUR_ZONE, LIBELLES_PHASE, LIBELLES_STATUT_POINT, LIBELLES_ZONE } from "../libelles"
import { pointsCritiquesOuverts, avancementPourcent, zoneDeListe, type PointRegle } from "../regles"
import type { Phase } from "../services-serveur"
import { FormulaireChecklist } from "./formulaire-checklist"
import { TiroirPoint, type EntreeHistorique, type PointOuvert } from "./tiroir-point"

type Donnees = NonNullable<Awaited<ReturnType<typeof pageListe>>>

export function PageListe({
  donnees,
  pointOuvert,
}: {
  donnees: Donnees
  pointOuvert: { point: PointOuvert; historique: EntreeHistorique[] } | null
}) {
  const { liste, niveau, terrain, avertissement, phaseEnCours } = donnees
  const peutCocher = niveau === "contribution" || niveau === "ecriture" || niveau === "gestion"
  const peutAjouter = peutCocher
  const points: Array<PointRegle & { id: string }> = liste.sections.flatMap((section) => section.items)
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
        <h2 className={`font-semibold ${terrain ? "text-3xl" : "text-2xl"}`}>{liste.titre}</h2>
        <p className="text-texte-discret">{LIBELLES_PHASE[liste.phase as Phase]}</p>
        <p className="chiffre text-3xl font-semibold">{avancement} %</p>
        <p className={COULEUR_ZONE[zone]}>{LIBELLES_ZONE[zone]}</p>
        <p className="text-sm">
          {critiques === 0 ? "Aucun point critique ouvert" : `${critiques} point${critiques > 1 ? "s" : ""} critique${critiques > 1 ? "s" : ""} ouvert${critiques > 1 ? "s" : ""}`}
        </p>
      </header>

      {avertissement.length > 0 && (
        <section role="alert" aria-label="Avertissement avant phase" className="flex flex-col gap-3 rounded-lg border border-etat-orange p-4">
          <p className="font-medium">
            Phase en cours : {LIBELLES_PHASE[phaseEnCours]}. Des points critiques des phases précédentes restent ouverts :
          </p>
          <ul className="list-disc pl-6">
            {avertissement.map((a, index) => (
              <li key={index}>
                {a.libelle} <span className="text-texte-discret">({a.listeTitre})</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link href="/apps/checklist" className={BOUTON_SECONDAIRE}>
              Revenir
            </Link>
            <Link href={`/apps/checklist/liste/${liste.id}`} className={BOUTON_SECONDAIRE}>
              Démarrer quand même
            </Link>
          </div>
        </section>
      )}

      <div>
        <FormulaireChecklist
          action={basculerModeTerrainAction}
          champsCaches={{ actif: terrain ? "" : "on" }}
          libelle={terrain ? "Quitter le mode terrain" : "Mode terrain"}
          classe={BOUTON_SECONDAIRE}
        />
      </div>

      {liste.sections.length === 0 && <p className="text-texte-discret">Cette liste n'a pas encore de section.</p>}

      {liste.sections.map((section) => (
        <section key={section.id} aria-label={section.titre} className="flex flex-col gap-3">
          <h3 className={`font-semibold ${terrain ? "text-2xl" : "text-lg"}`}>{section.titre}</h3>
          <ul className="flex flex-col gap-2">
            {section.items.map((point) => {
              const coche = point.statut === "fait"
              return (
                <li key={point.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-bordure bg-surface p-3">
                  {peutCocher ? (
                    <FormulaireChecklist
                      action={changerStatutPointAction}
                      champsCaches={{ pointId: point.id, statut: coche ? "a_faire" : "fait" }}
                      libelle={coche ? "✓ Fait" : "Faire"}
                      classe={`${tailleCoche} rounded-md px-3 font-medium ${coche ? "border border-marque text-marque" : "bg-marque text-marque-texte"}`}
                    />
                  ) : (
                    <span className="text-sm">{LIBELLES_STATUT_POINT[point.statut as keyof typeof LIBELLES_STATUT_POINT]}</span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">
                      {point.libelle}
                      {point.critique && <span className="ml-2 text-sm font-semibold">Critique</span>}
                    </span>
                    <span className="text-sm text-texte-discret">
                      {LIBELLES_STATUT_POINT[point.statut as keyof typeof LIBELLES_STATUT_POINT]}
                    </span>
                  </div>
                  <Link href={`/apps/checklist/liste/${liste.id}?point=${point.id}`} className={LIEN}>
                    Détail
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {peutAjouter && liste.sections.length > 0 && (
        <TiroirAction libelle="+ Ajouter un point" titre="Ajouter un point" sousTitre={liste.titre} action={ajouterPointAction} libelleBouton="Ajouter le point">
          <label className="flex flex-col gap-1">
            <span className="text-sm">Section</span>
            <select name="sectionId" className={CHAMP}>
              {liste.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.titre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Libellé du point</span>
            <input name="libelle" required maxLength={200} className={CHAMP} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="critique" className="size-5" /> Point critique
          </label>
        </TiroirAction>
      )}

      {pointOuvert && <TiroirPoint point={pointOuvert.point} historique={pointOuvert.historique} niveau={niveau} listeId={liste.id} />}
    </div>
  )
}
