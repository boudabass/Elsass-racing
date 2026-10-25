"use client"

// Formulaires et boutons d'action du vivier et de la prochaine épreuve (tâche 5.2). Chaque geste envoie une action de
// ../actions.ts ; la garde (droits, rôle affectable, tâche à soi) est dans le service. Un bouton refusé affiche sa raison.

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { BOUTON_SECONDAIRE, CHAMP } from "@/lib/classes-formulaire"

import {
  affecterPersonneAction,
  ajouterAuVivierAction,
  changerStatutTacheAction,
  modifierVivierAction,
  retirerAffectationAction,
  retirerDuVivierAction,
} from "../actions"
import { LIBELLE_INTERET } from "../libelles"
import { INTERETS_VIVIER, type InteretVivier, type RoleEpreuve } from "../regles"

import { Champ, jourPourChamp } from "./formulaires-equipe"

// --- Vivier ---------------------------------------------------------------------------------------------------

export interface ValeursVivier {
  id: string
  personId: string
  roleRecherche: RoleEpreuve
  source: string | null
  dernierContact: Date | null
  interet: InteretVivier
  notes: string | null
}

interface RoleVivier {
  role: RoleEpreuve
  libelle: string
}

// Les champs communs à l'ajout et à la modification. Chaque select a un aria-label : le nom accessible reste le libellé.
function ChampsVivier({ roles, valeurs }: { roles: RoleVivier[]; valeurs?: ValeursVivier }) {
  return (
    <>
        <Champ libelle="Rôle recherché">
          <select name="roleRecherche" aria-label="Rôle recherché" required defaultValue={valeurs?.roleRecherche ?? ""} className={CHAMP}>
            {!valeurs && (
              <option value="" disabled>
                Choisir un rôle
              </option>
            )}
            {roles.map((role) => (
              <option key={role.role} value={role.role}>
                {role.libelle}
              </option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Intérêt">
          <select name="interet" aria-label="Intérêt" required defaultValue={valeurs?.interet ?? "moyen"} className={CHAMP}>
            {INTERETS_VIVIER.map((interet) => (
              <option key={interet} value={interet}>
                {LIBELLE_INTERET[interet]}
              </option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Source" aide="D'où vient le nom : un ami, un club, une course.">
          <input name="source" maxLength={120} defaultValue={valeurs?.source ?? ""} className={CHAMP} autoComplete="off" />
        </Champ>
        <Champ libelle="Dernier contact">
          <input name="dernierContact" type="date" defaultValue={jourPourChamp(valeurs?.dernierContact ?? null)} className={CHAMP} />
        </Champ>
        <Champ libelle="Notes">
          <textarea name="notes" maxLength={1000} rows={3} defaultValue={valeurs?.notes ?? ""} className={CHAMP} />
        </Champ>
    </>
  )
}

export function AjouterVivier({
  personnes,
  roles,
  desactive,
  raison,
}: {
  personnes: Array<{ personId: string; nom: string }>
  roles: RoleVivier[]
  desactive: boolean
  raison: string | null
}) {
  return (
    <>
      <TiroirAction
        libelle="Ajouter au vivier"
        titre="Ajouter au vivier"
        sousTitre="Une personne qu'on pourrait appeler pour une épreuve. Ce n'est pas une affectation."
        action={ajouterAuVivierAction}
        libelleBouton="Ajouter"
        libelleEnCours="Ajout…"
        desactive={desactive}
      >
        <Champ libelle="Personne">
          <select name="personId" aria-label="Personne" required defaultValue="" className={CHAMP}>
            <option value="" disabled>
              Choisir une personne
            </option>
            {personnes.map((personne) => (
              <option key={personne.personId} value={personne.personId}>
                {personne.nom}
              </option>
            ))}
          </select>
        </Champ>
        <ChampsVivier roles={roles} />
      </TiroirAction>
      {raison && <p className="text-sm text-texte-discret">{raison}</p>}
    </>
  )
}

export function ModifierVivier({ valeurs, roles, desactive, raison }: { valeurs: ValeursVivier; roles: RoleVivier[]; desactive: boolean; raison: string | null }) {
  return (
    <>
      <TiroirAction
        libelle="Modifier"
        secondaire
        titre="Modifier l'entrée du vivier"
        action={modifierVivierAction}
        libelleBouton="Enregistrer"
        libelleEnCours="Enregistrement…"
        desactive={desactive}
      >
        <input type="hidden" name="id" value={valeurs.id} />
        <ChampsVivier roles={roles} valeurs={valeurs} />
      </TiroirAction>
      {raison && <p className="text-sm text-texte-discret">{raison}</p>}
    </>
  )
}

export function RetirerVivier({ id, nom, desactive, raison }: { id: string; nom: string; desactive: boolean; raison: string | null }) {
  return (
    <>
      <TiroirAction
        libelle="Retirer"
        danger
        titre="Retirer du vivier"
        question={`Retirer ${nom} du vivier ? La personne reste dans l'équipe.`}
        action={retirerDuVivierAction}
        libelleBouton="Retirer"
        libelleEnCours="Retrait…"
        desactive={desactive}
      >
        <input type="hidden" name="id" value={id} />
      </TiroirAction>
      {raison && <p className="text-sm text-texte-discret">{raison}</p>}
    </>
  )
}

// --- Prochaine épreuve : affectations --------------------------------------------------------------------------

export function AffecterPersonne({
  eventId,
  personnes,
  roles,
  desactive,
  raison,
}: {
  eventId: string
  personnes: Array<{ personId: string; nom: string }>
  roles: RoleVivier[]
  desactive: boolean
  raison: string | null
}) {
  return (
    <>
      <TiroirAction
        libelle="Affecter une personne"
        titre="Affecter à l'épreuve"
        sousTitre="Le rôle d'épreuve ne donne aucun droit. Une tâche liée est créée pour la personne, à faire avant le jour de l'épreuve."
        action={affecterPersonneAction}
        libelleBouton="Affecter"
        libelleEnCours="Affectation…"
        desactive={desactive}
      >
        <input type="hidden" name="eventId" value={eventId} />
        <Champ libelle="Personne">
          <select name="personId" aria-label="Personne" required defaultValue="" className={CHAMP}>
            <option value="" disabled>
              Choisir une personne
            </option>
            {personnes.map((personne) => (
              <option key={personne.personId} value={personne.personId}>
                {personne.nom}
              </option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Rôle d'épreuve">
          <select name="roleEpreuve" aria-label="Rôle d'épreuve" required defaultValue="" className={CHAMP}>
            <option value="" disabled>
              Choisir un rôle
            </option>
            {roles.map((role) => (
              <option key={role.role} value={role.role}>
                {role.libelle}
              </option>
            ))}
          </select>
        </Champ>
      </TiroirAction>
      {raison && <p className="text-sm text-texte-discret">{raison}</p>}
    </>
  )
}

export function RetirerAffectation({ id, nom, role, desactive, raison }: { id: string; nom: string; role: string; desactive: boolean; raison: string | null }) {
  return (
    <>
      <TiroirAction
        libelle="Retirer"
        danger
        titre="Retirer l'affectation"
        question={`Retirer ${nom} (${role}) de cette épreuve ? Sa tâche liée est retirée avec elle.`}
        action={retirerAffectationAction}
        libelleBouton="Retirer"
        libelleEnCours="Retrait…"
        desactive={desactive}
      >
        <input type="hidden" name="id" value={id} />
      </TiroirAction>
      {raison && <p className="text-sm text-texte-discret">{raison}</p>}
    </>
  )
}

// Cocher ou rouvrir une tâche liée. Pas de tiroir : le geste est direct, et la page se relit après l'action.
export function BasculerTache({ id, fait, desactive, raison }: { id: string; fait: boolean; desactive: boolean; raison: string | null }) {
  const router = useRouter()
  const [enCours, demarrer] = useTransition()
  const [refus, setRefus] = useState<string | null>(null)

  function basculer() {
    setRefus(null)
    demarrer(async () => {
      const donnees = new FormData()
      donnees.set("id", id)
      donnees.set("fait", fait ? "non" : "oui")
      const resultat = await changerStatutTacheAction(null, donnees)
      if (resultat.ok) router.refresh()
      else setRefus(resultat.message)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={basculer} disabled={desactive || enCours} className={`${BOUTON_SECONDAIRE} min-h-11`}>
        {fait ? "Rouvrir" : "Marquer fait"}
      </button>
      {desactive && raison && <p className="text-sm text-texte-discret">{raison}</p>}
      {refus && (
        <p role="alert" className="text-sm text-etat-rouge">
          {refus}
        </p>
      )}
    </div>
  )
}
