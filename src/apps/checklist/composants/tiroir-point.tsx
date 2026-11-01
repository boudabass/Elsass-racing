// Fiche d'un point (tâche 5.6, §1.3) : libellé, critique, note, statut au choix explicite, lien en lecture, historique.
import Link from "next/link"

import { BOUTON_SECONDAIRE, CHAMP, LIEN } from "@/lib/classes-formulaire"

import { modifierNotePointAction, changerStatutPointAction, retirerPointAction } from "../actions"
import { LIBELLES_LIEN, LIBELLES_STATUT_POINT } from "../libelles"
import type { StatutPoint } from "../regles"
import type { Niveau } from "@/core/droits/niveaux"
import { FormulaireChecklist } from "./formulaire-checklist"

const STATUTS: StatutPoint[] = ["a_faire", "fait", "sans_objet", "probleme"]

// Où mène chaque type de lien (lecture seule : on ouvre l'app, son état est branché en 5.7).
const APP_DU_LIEN: Record<string, { cle: string; libelle: string }> = {
  organe_garage: { cle: "garage", libelle: "Garage" },
  train_pneus: { cle: "garage", libelle: "Garage" },
  papier_voiture: { cle: "voiture", libelle: "Voiture" },
  logo_voiture: { cle: "voiture", libelle: "Voiture" },
  licence_equipe: { cle: "equipe", libelle: "Équipe" },
  homologation_equipe: { cle: "equipe", libelle: "Équipe" },
  contrepartie_partenaires: { cle: "partenaires", libelle: "Partenaires" },
  document_documents: { cle: "documents", libelle: "Documents" },
}

export interface PointOuvert {
  id: string
  libelle: string
  critique: boolean
  statut: string
  note: string | null
  lienType: string
  lienId: string | null
  ajoutePendantEpreuve: boolean
  personne: { prenom: string; nom: string } | null
  section: { liste: { id: string; titre: string } }
}

export interface EntreeHistorique {
  id: string
  ancienStatut: string | null
  nouveauStatut: string
  le: Date
  horsLigne: boolean
}

export function TiroirPoint({
  point,
  historique,
  niveau,
  listeId,
}: {
  point: PointOuvert
  historique: EntreeHistorique[]
  niveau: Niveau
  listeId: string
}) {
  const lien = point.lienType !== "aucun" ? APP_DU_LIEN[point.lienType] : undefined
  const peutEcrire = niveau !== "lecture"
  return (
    <aside aria-label="Fiche du point" className="flex flex-col gap-5 rounded-lg border border-marque bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xl font-semibold">{point.libelle}</h3>
        <Link href={`/apps/checklist/liste/${listeId}`} className={LIEN}>
          Fermer
        </Link>
      </div>

      <p className="text-sm">
        {point.critique ? "Point critique" : "Point normal"}
        {point.personne ? ` · Affecté à ${point.personne.prenom} ${point.personne.nom}` : ""}
        {point.ajoutePendantEpreuve ? " · Ajouté pendant l'épreuve" : ""}
      </p>

      <section aria-label="Statut" className="flex flex-col gap-2">
        <h4 className="font-medium">Statut</h4>
        {peutEcrire ? (
          <div className="flex flex-wrap gap-2">
            {STATUTS.map((statut) => (
              <FormulaireChecklist
                key={statut}
                action={changerStatutPointAction}
                champsCaches={{ pointId: point.id, statut }}
                libelle={LIBELLES_STATUT_POINT[statut]}
                classe={`${BOUTON_SECONDAIRE} ${point.statut === statut ? "border-marque font-medium" : ""}`}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm">{LIBELLES_STATUT_POINT[point.statut as StatutPoint] ?? point.statut}</p>
        )}
      </section>

      <section aria-label="Note" className="flex flex-col gap-2">
        <h4 className="font-medium">Note</h4>
        {peutEcrire ? (
          <FormulaireChecklist
            action={modifierNotePointAction}
            champsCaches={{ pointId: point.id }}
            libelle="Enregistrer la note"
            enfants={<textarea name="note" rows={3} maxLength={2000} defaultValue={point.note ?? ""} className={CHAMP} />}
          />
        ) : (
          <p className="text-sm">{point.note ?? "Pas de note."}</p>
        )}
      </section>

      {lien && (
        <section aria-label="Lien" className="flex flex-col gap-2">
          <h4 className="font-medium">Lié à</h4>
          <p className="text-sm">
            {LIBELLES_LIEN[point.lienType]}
            {point.lienId ? "" : " (non renseigné)"}
          </p>
          <Link href={`/apps/${lien.cle}`} className={LIEN}>
            Ouvrir dans {lien.libelle}
          </Link>
        </section>
      )}

      <section aria-label="Historique des coches" className="flex flex-col gap-2">
        <h4 className="font-medium">Historique</h4>
        {historique.length === 0 ? (
          <p className="text-sm text-texte-discret">Aucune coche enregistrée.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {historique.map((entree) => (
              <li key={entree.id}>
                {entree.le.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} :{" "}
                {entree.ancienStatut ? `${LIBELLES_STATUT_POINT[entree.ancienStatut as StatutPoint] ?? entree.ancienStatut} → ` : ""}
                {LIBELLES_STATUT_POINT[entree.nouveauStatut as StatutPoint] ?? entree.nouveauStatut}
                {entree.horsLigne ? " (hors ligne)" : ""}
              </li>
            ))}
          </ol>
        )}
      </section>

      {peutEcrire && (
        <FormulaireChecklist action={retirerPointAction} champsCaches={{ pointId: point.id }} libelle="Retirer le point" classe={BOUTON_SECONDAIRE} />
      )}
    </aside>
  )
}
