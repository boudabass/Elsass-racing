// Contenu de la fiche d'un point (tâche 5.6, §1.3) : statut, note, personne affectée, photos, lien en lecture, historique.
// Il est rendu dans le tiroir du socle (FichePointTiroir) : la fermeture et la garde des modifications sont là.
import Link from "next/link"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { BOUTON_SECONDAIRE, CHAMP, LIEN } from "@/lib/classes-formulaire"
import type { Niveau } from "@/core/droits/niveaux"

import { affecterPointAction, ajouterPhotoPointAction, changerStatutPointAction, lierPointAction, modifierNotePointAction, retirerLienPointAction, retirerPhotoPointAction, retirerPointAction } from "../actions"
import { APP_DU_TYPE, libelleEtatLien, type ResolutionLien } from "../objets-lies"
import { TYPES_OBJET_LIE, type ObjetLieLu, type TypeObjetLie } from "../objets-types"
import { LIBELLES_LIEN, LIBELLES_STATUT_POINT } from "../libelles"
import type { StatutPoint } from "../regles"
import { FormulaireChecklist } from "./formulaire-checklist"

const STATUTS: StatutPoint[] = ["a_faire", "fait", "sans_objet", "probleme"]

export interface PointOuvert {
  id: string
  libelle: string
  critique: boolean
  statut: string
  note: string | null
  lienType: string
  lienId: string | null
  ajoutePendantEpreuve: boolean
  personneId: string | null
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

export interface PersonnePointAffectable {
  id: string
  prenom: string
  nom: string
}

export interface PhotoPoint {
  id: string
  fileId: string
  nom: string
  auteur: string
  retirable: boolean
}

export function ContenuFichePoint({
  point,
  historique,
  niveau,
  personnes,
  photos,
  lien,
  choixLiens,
}: {
  point: PointOuvert
  historique: EntreeHistorique[]
  niveau: Niveau
  personnes: PersonnePointAffectable[]
  photos: PhotoPoint[]
  lien: ResolutionLien | null
  choixLiens: ObjetLieLu[]
}) {
  const peutEcrire = niveau !== "lecture"
  const peutAffecter = niveau === "ecriture" || niveau === "gestion"
  // « Lié à » : posé seulement si un identifiant est là. Le choix ne se propose qu'à l'écriture (956 §6).
  const lienPose = point.lienId !== null && point.lienType !== "aucun"
  const valeurLien = lienPose ? `${point.lienType}|${point.lienId}` : ""
  const groupes = TYPES_OBJET_LIE.map((type) => [type, choixLiens.filter((objet) => objet.type === type)] as const).filter(([, objets]) => objets.length > 0)
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        {point.critique ? "Point critique" : "Point normal"}
        {point.ajoutePendantEpreuve ? " · Ajouté pendant l'épreuve" : ""}
      </p>

      <section aria-label="Statut" className="flex flex-col gap-2">
        <h3 className="font-medium">Statut</h3>
        {peutEcrire ? (
          <div className="flex flex-wrap gap-2">
            {STATUTS.map((statut) => (
              <FormulaireChecklist
                key={statut}
                action={changerStatutPointAction}
                champsCaches={{ pointId: point.id, statut }}
                libelle={LIBELLES_STATUT_POINT[statut]}
                classe={`${BOUTON_SECONDAIRE} ${point.statut === statut ? "border-marque font-medium" : ""}`}
                actif={point.statut === statut}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm">{LIBELLES_STATUT_POINT[point.statut as StatutPoint] ?? point.statut}</p>
        )}
      </section>

      <section aria-label="Affectation" className="flex flex-col gap-2">
        <h3 className="font-medium">Affecté à</h3>
        {peutAffecter ? (
          <FormulaireChecklist
            action={affecterPointAction}
            champsCaches={{ pointId: point.id }}
            libelle="Enregistrer l'affectation"
            classe={BOUTON_SECONDAIRE}
            enfants={
              <select name="personneId" defaultValue={point.personneId ?? ""} className={CHAMP}>
                <option value="">Personne</option>
                {personnes.map((personne) => (
                  <option key={personne.id} value={personne.id}>
                    {personne.prenom} {personne.nom}
                  </option>
                ))}
              </select>
            }
          />
        ) : (
          <p className="text-sm">{point.personne ? `${point.personne.prenom} ${point.personne.nom}` : "Personne"}</p>
        )}
      </section>

      <section aria-label="Note" className="flex flex-col gap-2">
        <h3 className="font-medium">Note</h3>
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

      <section aria-label="Photos" className="flex flex-col gap-3">
        <h3 className="font-medium">Photos</h3>
        {peutEcrire && (
          <TiroirAction libelle="Ajouter une photo" titre="Ajouter une photo" libelleBouton="Envoyer la photo" libelleEnCours="Envoi…" action={ajouterPhotoPointAction}>
            <input type="hidden" name="pointId" value={point.id} />
            <input type="file" name="fichier" accept="image/*" capture="environment" required className={CHAMP} />
          </TiroirAction>
        )}
        {photos.length === 0 && <p className="text-sm text-texte-discret">Aucune photo sur ce point.</p>}
        <ul className="grid grid-cols-2 gap-3">
          {photos.map((photo) => (
            <li key={photo.id} className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-2">
              {/* Vignette servie par /api/fichiers : les droits de lecture sont contrôlés au serveur. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/fichiers/${photo.fileId}`} alt={photo.nom} loading="lazy" className="aspect-square w-full rounded-md object-cover" />
              <p className="text-sm text-texte-discret">{photo.auteur}</p>
              {photo.retirable && (
                <TiroirAction
                  libelle="Retirer"
                  danger
                  titre="Retirer cette photo ?"
                  question="La photo disparaît de la fiche. Le fichier reste en archive."
                  libelleBouton="Retirer la photo"
                  action={retirerPhotoPointAction}
                >
                  <input type="hidden" name="pointId" value={point.id} />
                  <input type="hidden" name="photoId" value={photo.id} />
                </TiroirAction>
              )}
            </li>
          ))}
        </ul>
      </section>

      {(peutAffecter || lien) && (
        <section aria-label="Lien" className="flex flex-col gap-3">
          <h3 className="font-medium">Lié à</h3>
          {lien ? (
            <>
              <p className="text-sm">
                {LIBELLES_LIEN[point.lienType]} · {libelleEtatLien(lien)}
              </p>
              {lien.statut === "objet" && (
                <Link href={`/apps/${APP_DU_TYPE[point.lienType as TypeObjetLie].cle}`} className={LIEN}>
                  Ouvrir dans {APP_DU_TYPE[point.lienType as TypeObjetLie].libelle}
                </Link>
              )}
            </>
          ) : (
            <p className="text-sm text-texte-discret">Aucun objet lié à ce point.</p>
          )}
          {peutAffecter && (
            <>
              <p className="text-xs text-texte-discret">Un lien n'ajoute ni ne retire aucune coche : le point se coche à la main.</p>
              <FormulaireChecklist
                action={lierPointAction}
                champsCaches={{ pointId: point.id }}
                libelle="Enregistrer le lien"
                classe={BOUTON_SECONDAIRE}
                enfants={
                  <select name="lien" defaultValue={valeurLien} aria-label="Objet lié" className={CHAMP}>
                    <option value="">Aucun lien</option>
                    {lienPose && lien && lien.statut !== "objet" && (
                      <option value={valeurLien}>{lien.statut === "acces_refuse" ? "Objet non accessible (conservé)" : "Objet introuvable (conservé)"}</option>
                    )}
                    {groupes.map(([type, objets]) => (
                      <optgroup key={type} label={LIBELLES_LIEN[type]}>
                        {objets.map((objet) => (
                          <option key={objet.id} value={`${type}|${objet.id}`}>
                            {objet.libelle} · {objet.etat}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                }
              />
              {lienPose && <FormulaireChecklist action={retirerLienPointAction} champsCaches={{ pointId: point.id }} libelle="Retirer le lien" classe={BOUTON_SECONDAIRE} />}
            </>
          )}
        </section>
      )}

      <section aria-label="Historique des coches" className="flex flex-col gap-2">
        <h3 className="font-medium">Historique</h3>
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
    </div>
  )
}
