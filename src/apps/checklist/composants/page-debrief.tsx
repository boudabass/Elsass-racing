// Débrief (tâche 5.6, §1.6) : après l'épreuve, ce qui n'a pas été coché, ce qui est en problème, et « Ajouter au modèle ».
import Link from "next/link"

import { BOUTON_SECONDAIRE, LIEN } from "@/lib/classes-formulaire"

import { ajouterAuModeleAction } from "../actions"
import type { pageDebrief } from "../lectures-ecran"
import { LIBELLES_STATUT_POINT } from "../libelles"
import type { StatutPoint } from "../regles"
import { FormulaireChecklist } from "./formulaire-checklist"

type Donnees = Awaited<ReturnType<typeof pageDebrief>>

export function PageDebrief({ donnees }: { donnees: Donnees }) {
  const { epreuve, epreuves, lignes, niveau } = donnees
  if (!epreuve) {
    return <p className="py-12 text-center text-lg text-texte-discret">Aucune épreuve passée à débriefer pour l'instant.</p>
  }
  const gere = niveau === "gestion"

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Épreuves passées" className="flex flex-wrap gap-3">
        {epreuves.map((e) => (
          <Link
            key={e.id}
            href={`/apps/checklist/debrief?epreuve=${e.id}`}
            aria-current={e.id === epreuve.id ? "page" : undefined}
            className={`${BOUTON_SECONDAIRE} ${e.id === epreuve.id ? "border-marque font-medium" : ""}`}
          >
            {e.nom}
          </Link>
        ))}
      </nav>

      <h2 className="text-xl font-semibold">{epreuve.nom}</h2>

      {lignes.length === 0 ? (
        <p className="text-texte-discret">Tout a été coché, aucun problème signalé, aucun point ajouté pendant l'épreuve.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lignes.map((ligne) => (
            <li key={ligne.pointId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bordure bg-surface p-4">
              <div className="flex flex-col">
                <span className="font-medium">
                  {ligne.libelle}
                  {ligne.critique && <span className="ml-2 text-sm font-semibold">Critique</span>}
                </span>
                <span className="text-sm text-texte-discret">
                  {ligne.listeTitre} · {LIBELLES_STATUT_POINT[ligne.statut as StatutPoint] ?? ligne.statut}
                  {ligne.ajoute ? " · Ajouté pendant l'épreuve" : ""}
                </span>
              </div>
              {ligne.peutAjouterAuModele && gere && (
                <FormulaireChecklist action={ajouterAuModeleAction} champsCaches={{ pointId: ligne.pointId }} libelle="Ajouter au modèle" classe={BOUTON_SECONDAIRE} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
