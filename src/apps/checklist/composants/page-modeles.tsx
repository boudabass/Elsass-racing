// Modèles (tâche 5.6, §1.7) : bibliothèque des modèles fournis (vide tant que la 5.5b n'est pas faite) et de la team.
import Link from "next/link"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { BOUTON_SECONDAIRE, CHAMP, LIEN } from "@/lib/classes-formulaire"

import { copierModeleAction, creerModeleAction } from "../actions"
import type { pageModeles } from "../lectures-ecran"
import { LIBELLES_PHASE } from "../libelles"
import type { Phase } from "../services-serveur"
import { FormulaireChecklist } from "./formulaire-checklist"

type Donnees = Awaited<ReturnType<typeof pageModeles>>

export function PageModeles({ donnees }: { donnees: Donnees }) {
  const { modeles, niveau } = donnees
  const fournis = modeles.filter((m) => m.fourni)
  const dEquipe = modeles.filter((m) => !m.fourni)
  const peutGerer = niveau === "gestion"

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Modèles prêts à l'emploi" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Prêts à l'emploi</h2>
        {fournis.length === 0 ? (
          <p className="text-texte-discret">Aucun modèle prêt à l'emploi pour l'instant. Ils arrivent avec la liste de la plateforme.</p>
        ) : (
          <ListeModeles modeles={fournis} peutCopier={true} peutModifier={false} />
        )}
      </section>

      <section aria-label="Modèles de la team" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">De la team</h2>
        {dEquipe.length === 0 ? (
          <p className="text-texte-discret">Aucun modèle de la team pour l'instant.</p>
        ) : (
          <ListeModeles modeles={dEquipe} peutCopier={true} peutModifier={peutGerer} />
        )}
      </section>

      {peutGerer && (
        <TiroirAction libelle="+ Nouveau modèle" titre="Nouveau modèle" action={creerModeleAction} libelleBouton="Créer le modèle">
          <label className="flex flex-col gap-1">
            <span className="text-sm">Nom</span>
            <input name="nom" required maxLength={120} className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Portée</span>
            <select name="portee" defaultValue="engagement" className={CHAMP}>
              <option value="engagement">Par engagement (une voiture et son équipage)</option>
              <option value="epreuve">Commun à l'épreuve</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Phase par défaut</span>
            <select name="phase" defaultValue="" className={CHAMP}>
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
    </div>
  )
}

function ListeModeles({
  modeles,
  peutCopier,
  peutModifier,
}: {
  modeles: Donnees["modeles"]
  peutCopier: boolean
  peutModifier: boolean
}) {
  return (
    <ul className="flex flex-col gap-3">
      {modeles.map((modele) => (
        <li key={modele.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bordure bg-surface p-4">
          <div className="flex flex-col">
            <span className="font-medium">{modele.nom}</span>
            <span className="text-sm text-texte-discret">
              {modele.portee === "engagement" ? "Par engagement" : "Commun à l'épreuve"}
              {modele.phase ? ` · ${LIBELLES_PHASE[modele.phase as Phase]}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {peutModifier && (
              <Link href={`/apps/checklist/modeles/${modele.id}`} className={LIEN}>
                Modifier
              </Link>
            )}
            {peutCopier && (
              <FormulaireChecklist action={copierModeleAction} champsCaches={{ modeleId: modele.id }} libelle="Copier" classe={BOUTON_SECONDAIRE} />
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
