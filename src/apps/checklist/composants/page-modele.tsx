// Modèle (tâche 5.6, §1.7) : sections et points, en lecture pour la team, en écriture pour la gestion sur ses modèles.
import Link from "next/link"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { BOUTON_SECONDAIRE, CHAMP, LIEN } from "@/lib/classes-formulaire"

import { ajouterPointModeleAction, ajouterSectionModeleAction, modifierModeleAction, retirerPointModeleAction } from "../actions"
import type { pageModele } from "../lectures-ecran"
import { LIBELLES_LIEN, LIBELLES_PHASE, LIBELLES_ROLE_SUGGERE } from "../libelles"
import type { Phase } from "../services-serveur"
import { FormulaireChecklist } from "./formulaire-checklist"

type Donnees = NonNullable<Awaited<ReturnType<typeof pageModele>>>

const LIBELLES_ECHEANCE: Record<string, string> = { j_moins_7: "J-7", j_moins_1: "J-1", jour_j: "Jour J" }

export function PageModele({ donnees }: { donnees: Donnees }) {
  const { modele, niveau } = donnees
  // Un modèle fourni ne se modifie pas : on le copie d'abord (règle du brief §1).
  const modifiable = !modele.fourni && niveau === "gestion"

  return (
    <div className="flex flex-col gap-8">
      <Link href="/apps/checklist/modeles" className={LIEN}>
        ← Modèles
      </Link>
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold">{modele.nom}</h2>
        <p className="text-sm text-texte-discret">
          {modele.portee === "engagement" ? "Par engagement" : "Commun à l'épreuve"}
          {modele.phase ? ` · ${LIBELLES_PHASE[modele.phase as Phase]}` : ""}
          {modele.fourni ? " · Prêt à l'emploi (lecture seule : copie-le pour le modifier)" : ""}
        </p>
        {modifiable && (
          <TiroirAction
            libelle="Modifier le modèle"
            titre="Modifier le modèle"
            sousTitre={modele.nom}
            action={modifierModeleAction}
            libelleBouton="Enregistrer"
          >
            <input type="hidden" name="modeleId" value={modele.id} />
            <label className="flex flex-col gap-1">
              <span className="text-sm">Nom</span>
              <input name="nom" required maxLength={120} defaultValue={modele.nom} className={CHAMP} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Portée</span>
              <select name="portee" defaultValue={modele.portee} className={CHAMP}>
                <option value="engagement">Par engagement (une voiture et son équipage)</option>
                <option value="epreuve">Commun à l'épreuve</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Phase par défaut</span>
              <select name="phase" defaultValue={modele.phase ?? ""} className={CHAMP}>
                <option value="">Aucune</option>
                {(Object.keys(LIBELLES_PHASE) as Phase[]).map((phase) => (
                  <option key={phase} value={phase}>
                    {LIBELLES_PHASE[phase]}
                  </option>
                ))}
              </select>
            </label>
          </TiroirAction>
        )}
      </header>

      {modele.sections.length === 0 &&<p className="text-texte-discret">Ce modèle n'a pas encore de section.</p>}

      {modele.sections.map((section) => (
        <section key={section.id} aria-label={section.titre} className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">{section.titre}</h3>
          <ul className="flex flex-col gap-2">
            {section.items.map((point) => (
              <li key={point.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bordure bg-surface p-3">
                <div className="flex flex-col">
                  <span className="font-medium">
                    {point.libelle}
                    {point.critique && <span className="ml-2 text-sm font-semibold">Critique</span>}
                  </span>
                  <span className="text-sm text-texte-discret">
                    {[
                      point.roleSuggere ? LIBELLES_ROLE_SUGGERE[point.roleSuggere as keyof typeof LIBELLES_ROLE_SUGGERE] : null,
                      point.echeanceRelative ? LIBELLES_ECHEANCE[point.echeanceRelative] : null,
                      point.lienType !== "aucun" ? LIBELLES_LIEN[point.lienType] : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sans rôle, échéance ni lien"}
                  </span>
                </div>
                {modifiable && (
                  <FormulaireChecklist action={retirerPointModeleAction} champsCaches={{ pointId: point.id }} libelle="Retirer" classe={BOUTON_SECONDAIRE} />
                )}
              </li>
            ))}
          </ul>

          {modifiable && (
            <TiroirAction
              libelle={`+ Ajouter un point dans « ${section.titre} »`}
              titre="Ajouter un point"
              sousTitre={section.titre}
              action={ajouterPointModeleAction}
              libelleBouton="Ajouter le point"
            >
              <input type="hidden" name="sectionId" value={section.id} />
              <ChampsPoint />
            </TiroirAction>
          )}
        </section>
      ))}

      {modifiable && (
        <TiroirAction libelle="+ Nouvelle section" titre="Nouvelle section" sousTitre={modele.nom} action={ajouterSectionModeleAction} libelleBouton="Ajouter la section">
          <input type="hidden" name="modeleId" value={modele.id} />
          <label className="flex flex-col gap-1">
            <span className="text-sm">Titre de la section</span>
            <input name="titre" required maxLength={120} className={CHAMP} />
          </label>
        </TiroirAction>
      )}
    </div>
  )
}

function ChampsPoint() {
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Libellé du point</span>
        <input name="libelle" required maxLength={200} className={CHAMP} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="critique" className="size-5" /> Point critique
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Rôle suggéré</span>
        <select name="roleSuggere" defaultValue="" className={CHAMP}>
          <option value="">Aucun</option>
          <option value="equipage">Équipage</option>
          <option value="assistance">Assistance</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Échéance</span>
        <select name="echeanceRelative" defaultValue="" className={CHAMP}>
          <option value="">Aucune</option>
          <option value="j_moins_7">J-7</option>
          <option value="j_moins_1">J-1</option>
          <option value="jour_j">Jour J</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Type de lien</span>
        <select name="lienType" defaultValue="aucun" className={CHAMP}>
          {Object.entries(LIBELLES_LIEN).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
