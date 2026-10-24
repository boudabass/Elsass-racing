"use client"

// Écran Équipements (tâche 4.6, brief §3) : les équipements de la team, regroupés par catégorie, une carte par équipement.
// Ajouter, modifier et retirer se font dans des tiroirs. Hors ligne, ces actions restent visibles, désactivées, avec la
// raison (954 v1.4 : écriture en ligne seulement). La valeur ne figure que pour le niveau écriture.

import { useRouter } from "next/navigation"
import { Clock, TriangleAlert } from "lucide-react"
import { useState } from "react"

import { TiroirFormulaire } from "@/components/formulaire/tiroir"
import { useEtatSynchro } from "@/core/synchro/client/react"
import { BOUTON, BOUTON_SECONDAIRE, CHAMP } from "@/lib/classes-formulaire"

import { creerEquipementAction, modifierEquipementAction, retirerEquipementAction } from "../actions"
import {
  alerteEcheance,
  echeanceControle,
  formaterValeur,
  groupesParCategorie,
  LIBELLE_ALERTE_ECHEANCE,
  libelleEcheance,
  resumeEquipements,
  SEUIL_CONTROLE_JOURS,
} from "../equipements"
import { LIBELLE_CATEGORIE_EQUIPEMENT } from "../libelles"
import type { EquipementLigne } from "../lectures-equipements-serveur"

export interface EquipementsEcranProps {
  equipements: EquipementLigne[]
  // Ajouter, modifier, retirer : niveau écriture seulement. Sans lui, la liste reste en lecture.
  peutEcrire: boolean
  // Jour de Paris, calculé sur le serveur : même date pour le calcul des échéances et pour l'affichage.
  aujourdhui: string
  // Ouvre le tiroir d'ajout dès l'arrivée (entrée « Équipement » du bouton +).
  nouvelleOuverte: boolean
}

const MESSAGE_HORS_LIGNE = "Les équipements se modifient en ligne."

// Date civile « AAAA-MM-JJ » en « JJ/MM/AAAA », comme dans le reste de l'app.
const dateAffichee = (dateCivile: string) => dateCivile.split("-").reverse().join("/")

export function EquipementsEcran({ equipements, peutEcrire, aujourdhui, nouvelleOuverte }: EquipementsEcranProps) {
  const enLigne = useEtatSynchro().enLigne
  const resume = resumeEquipements(equipements, aujourdhui)
  const groupes = groupesParCategorie(equipements)

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="titre-rallye text-3xl">Équipements</h1>
        <p className="text-sm text-texte-discret">Équipements de la team : ils ne dépendent pas de la voiture choisie.</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <li>
            <span className="chiffre font-semibold">{resume.nombre}</span> équipement{resume.nombre > 1 ? "s" : ""}
          </li>
          <li>
            Contrôles dépassés : <span className="chiffre font-semibold">{resume.depasses}</span>
          </li>
          <li>
            Contrôles dans les {SEUIL_CONTROLE_JOURS} jours : <span className="chiffre font-semibold">{resume.bientot}</span>
          </li>
          {peutEcrire && (
            <li>
              Valeur totale : <span className="chiffre font-semibold">{formaterValeur(resume.valeurTotaleCents)}</span>
            </li>
          )}
        </ul>
        {peutEcrire ? (
          <div className="flex flex-col items-start gap-2">
            <AjouterEquipement ouvertDes={nouvelleOuverte} enLigne={enLigne} />
            {!enLigne && <p className="text-sm text-texte-discret">{MESSAGE_HORS_LIGNE}</p>}
          </div>
        ) : (
          <p className="text-sm text-texte-discret">Seuls le responsable et l&apos;équipage ajoutent, modifient ou retirent les équipements.</p>
        )}
      </header>

      {equipements.length === 0 ? (
        <p className="text-texte-discret">Aucun équipement enregistré.</p>
      ) : (
        groupes.map((groupe) => (
          <section key={groupe.categorie} aria-labelledby={`categorie-${groupe.categorie}`} className="flex flex-col gap-3">
            <h2 id={`categorie-${groupe.categorie}`} className="text-lg font-semibold">
              {LIBELLE_CATEGORIE_EQUIPEMENT[groupe.categorie]}
            </h2>
            <ul className="flex flex-col gap-3">
              {groupe.equipements.map((equipement) => (
                <CarteEquipement key={equipement.id} equipement={equipement} aujourdhui={aujourdhui} peutEcrire={peutEcrire} enLigne={enLigne} />
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  )
}

// --- Carte ------------------------------------------------------------------------------------------------------------

interface CarteEquipementProps {
  equipement: EquipementLigne
  aujourdhui: string
  peutEcrire: boolean
  enLigne: boolean
}

// Une carte : nom, état, emplacement, valeur (écriture seulement), échéance du contrôle en clair. Un contrôle dépassé ou
// proche porte une icône et un mot, jamais la couleur seule.
function CarteEquipement({ equipement, aujourdhui, peutEcrire, enLigne }: CarteEquipementProps) {
  const router = useRouter()
  const [modifierOuvert, setModifierOuvert] = useState(false)
  const [retirerOuvert, setRetirerOuvert] = useState(false)
  const echeance = echeanceControle(equipement.prochainControleLe, aujourdhui)
  const alerte = alerteEcheance(echeance)
  const Icone = alerte === "depasse" ? TriangleAlert : alerte === "bientot" ? Clock : null

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-bordure p-4">
      <p className="font-semibold">{equipement.nom}</p>
      {equipement.etat && <p className="text-sm text-texte-discret">État : {equipement.etat}</p>}
      {equipement.emplacement && <p className="text-sm text-texte-discret">Emplacement : {equipement.emplacement}</p>}
      {equipement.valeurCents !== null && <p className="text-sm text-texte-discret">Valeur : {formaterValeur(equipement.valeurCents)}</p>}
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {Icone && <Icone aria-hidden="true" className="h-4 w-4 shrink-0" />}
        <span>{libelleEcheance(echeance)}</span>
        {alerte && <span className="rounded-md border border-bordure px-2 py-0.5 text-xs font-semibold">{LIBELLE_ALERTE_ECHEANCE[alerte]}</span>}
      </p>
      {equipement.prochainControleLe && <p className="text-sm text-texte-discret">Échéance : {dateAffichee(equipement.prochainControleLe)}</p>}

      {peutEcrire &&
        (enLigne ? (
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" onClick={() => setModifierOuvert(true)} className={BOUTON_SECONDAIRE} aria-haspopup="dialog">
              Modifier
            </button>
            <button type="button" onClick={() => setRetirerOuvert(true)} className={BOUTON_SECONDAIRE} aria-haspopup="dialog">
              Retirer
            </button>
            <TiroirFormulaire
              ouvert={modifierOuvert}
              onOuvertChange={setModifierOuvert}
              titre={`Modifier : ${equipement.nom}`}
              action={modifierEquipementAction}
              libelleBouton="Enregistrer"
              libelleEnCours="Enregistrement…"
              onSucces={() => router.refresh()}
            >
              <input type="hidden" name="id" value={equipement.id} />
              <ChampsEquipement defaut={equipement} />
            </TiroirFormulaire>
            <TiroirFormulaire
              ouvert={retirerOuvert}
              onOuvertChange={setRetirerOuvert}
              titre="Retirer l'équipement"
              question="L'équipement disparaît de la liste et du total. Rien n'est effacé définitivement."
              danger
              action={retirerEquipementAction}
              libelleBouton="Retirer l'équipement"
              libelleEnCours="Retrait…"
              onSucces={() => router.refresh()}
            >
              <input type="hidden" name="id" value={equipement.id} />
            </TiroirFormulaire>
          </div>
        ) : (
          <div className="mt-1 flex flex-col items-start gap-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled className={`${BOUTON_SECONDAIRE} opacity-60`}>
                Modifier
              </button>
              <button type="button" disabled className={`${BOUTON_SECONDAIRE} opacity-60`}>
                Retirer
              </button>
            </div>
            <p className="text-sm text-texte-discret">{MESSAGE_HORS_LIGNE}</p>
          </div>
        ))}
    </li>
  )
}

// --- Ajouter ----------------------------------------------------------------------------------------------------------

// Bouton d'ajout et son tiroir. Ouvert d'office quand l'écran vient de l'entrée « Équipement » du bouton +.
function AjouterEquipement({ ouvertDes, enLigne }: { ouvertDes: boolean; enLigne: boolean }) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(ouvertDes)

  if (!enLigne) {
    return (
      <button type="button" disabled className={`${BOUTON} opacity-60`}>
        Ajouter un équipement
      </button>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={BOUTON} aria-haspopup="dialog">
        Ajouter un équipement
      </button>
      <TiroirFormulaire
        ouvert={ouvert}
        onOuvertChange={setOuvert}
        titre="Ajouter un équipement"
        action={creerEquipementAction}
        libelleBouton="Ajouter l'équipement"
        libelleEnCours="Enregistrement…"
        onSucces={() => router.refresh()}
      >
        <ChampsEquipement />
      </TiroirFormulaire>
    </>
  )
}

// --- Champs partagés par l'ajout et la modification ------------------------------------------------------------------

// Les champs d'un équipement. Sans défaut : ajout. Avec défaut : modification, prérempli. Seul le nom et la catégorie sont
// obligatoires ; la valeur porte le renvoi vers Budget, parce qu'un équipement ne crée aucune dépense.
function ChampsEquipement({ defaut }: { defaut?: EquipementLigne }) {
  const valeurEuros = defaut && defaut.valeurCents !== null ? (defaut.valeurCents / 100).toFixed(2).replace(".", ",") : ""
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Nom</span>
        <input name="nom" required maxLength={120} defaultValue={defaut?.nom} placeholder="Remorque, compresseur…" className={CHAMP} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Catégorie</span>
        <select name="categorie" required defaultValue={defaut?.categorie ?? ""} className={CHAMP}>
          <option value="" disabled>
            Choisir la catégorie
          </option>
          {Object.entries(LIBELLE_CATEGORIE_EQUIPEMENT).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">État (facultatif)</span>
        <input name="etat" maxLength={200} defaultValue={defaut?.etat ?? ""} placeholder="Bon, pneu de secours usé…" className={CHAMP} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Emplacement (facultatif)</span>
        <input name="emplacement" maxLength={120} defaultValue={defaut?.emplacement ?? ""} placeholder="Remorque, atelier…" className={CHAMP} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Acheté le (facultatif)</span>
          <input name="acheteLe" type="date" defaultValue={defaut?.acheteLe ?? ""} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Prochain contrôle (facultatif)</span>
          <input name="prochainControleLe" type="date" defaultValue={defaut?.prochainControleLe ?? ""} className={CHAMP} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Valeur, en euros (facultatif)</span>
        <input name="valeur" inputMode="decimal" defaultValue={valeurEuros} placeholder="0,00" className={CHAMP} />
        <span className="text-sm text-texte-discret">Pour la dépense, saisis-la dans Budget.</span>
      </label>
    </>
  )
}
