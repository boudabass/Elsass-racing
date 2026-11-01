// Liste (tâche 5.6, §1.2 et §1.4) : sections, coche d'un appui, avertissement avant phase, mode terrain, ajout de point.
// Le corps (en-tête, sections, coches) est un composant client, pour lire la base locale hors ligne (tâche 5.6b).
import Link from "next/link"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { BOUTON_SECONDAIRE, CHAMP } from "@/lib/classes-formulaire"

import { basculerModeTerrainAction, ajouterPointAction } from "../actions"
import type { pageListe } from "../lectures-ecran"
import { LIBELLES_PHASE } from "../libelles"
import type { Phase } from "../services-serveur"
import { CorpsListe } from "./corps-liste"
import { FormulaireChecklist } from "./formulaire-checklist"
import type { ObjetLieLu } from "../objets-types"
import type { ResolutionLien } from "../objets-lies"
import { FichePointTiroir } from "./fiche-point-tiroir"
import { ContenuFichePoint, type EntreeHistorique, type PersonnePointAffectable, type PhotoPoint, type PointOuvert } from "./tiroir-point"

type Donnees = NonNullable<Awaited<ReturnType<typeof pageListe>>>

export function PageListe({
  donnees,
  pointOuvert,
}: {
  donnees: Donnees
  pointOuvert: {
    point: PointOuvert
    historique: EntreeHistorique[]
    personnes: PersonnePointAffectable[]
    photos: PhotoPoint[]
    lien: ResolutionLien | null
    choixLiens: ObjetLieLu[]
  } | null
}) {
  const { liste, niveau, terrain, avertissement, phaseEnCours, etatsLiens } = donnees
  const peutCocher = niveau === "contribution" || niveau === "ecriture" || niveau === "gestion"
  const peutAjouter = peutCocher

  const bandeau =
    avertissement.length > 0 ? (
      <section role="alert" aria-label="Avertissement avant phase" className="flex flex-col gap-3 rounded-lg border border-etat-orange p-4">
        <p className="font-medium">Phase en cours : {LIBELLES_PHASE[phaseEnCours]}. Des points critiques des phases précédentes restent ouverts :</p>
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
    ) : null

  const modeTerrain = (
    <FormulaireChecklist
      action={basculerModeTerrainAction}
      champsCaches={{ actif: terrain ? "" : "on" }}
      libelle={terrain ? "Quitter le mode terrain" : "Mode terrain"}
      classe={BOUTON_SECONDAIRE}
    />
  )

  const ajout =
    peutAjouter && liste.sections.length > 0 ? (
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
    ) : null

  return (
    <>
      <CorpsListe
        listeId={liste.id}
        titre={liste.titre}
        phase={liste.phase}
        terrain={terrain}
        peutCocher={peutCocher}
        sections={liste.sections}
        etatsLiens={etatsLiens}
        avertissement={bandeau}
        modeTerrain={modeTerrain}
        ajout={ajout}
      />

      {pointOuvert && (
        <FichePointTiroir titre={pointOuvert.point.libelle} sousTitre={liste.titre} retour={`/apps/checklist/liste/${liste.id}`}>
          <ContenuFichePoint
            point={pointOuvert.point}
            historique={pointOuvert.historique}
            niveau={niveau}
            personnes={pointOuvert.personnes}
            photos={pointOuvert.photos}
            lien={pointOuvert.lien}
            choixLiens={pointOuvert.choixLiens}
          />
        </FichePointTiroir>
      )}
    </>
  )
}
