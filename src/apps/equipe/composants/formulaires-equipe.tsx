"use client"

// Formulaires d'Équipe en tiroirs (brief 5.2, §1 : formulaires en tiroirs partout). Chaque tiroir envoie une action de
// ../actions.ts ; la garde (droits, dossier propre) est dans le service. Un bouton refusé affiche sa raison, dans la page.

import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"

import { ChampFichier } from "@/components/formulaire/champ-fichier"
import { TiroirAction } from "@/components/formulaire/tiroir"
import { CHAMP } from "@/lib/classes-formulaire"

import {
  ajouterEquipementAction,
  ajouterLicenceAction,
  creerPersonneAction,
  modifierEquipementAction,
  modifierLicenceAction,
  modifierProfilAction,
  repondreDisponibiliteAction,
  retirerEquipementAction,
  retirerLicenceAction,
} from "../actions"
import { LIBELLE_REPONSE, LIBELLE_ROLE_HABITUEL } from "../libelles"
import { LIBELLES_TYPE_EQUIPEMENT, LIBELLES_TYPE_LICENCE, REPONSES_DISPONIBILITE, ROLES_HABITUELS, TYPES_EQUIPEMENT, TYPES_LICENCE } from "../regles"
import type { RoleHabituel, ReponseDisponibilite, TypeEquipement, TypeLicence } from "../regles"

export function Champ({ libelle, children, aide }: { libelle: string; children: ReactNode; aide?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{libelle}</span>
      {children}
      {aide && <span className="text-texte-discret">{aide}</span>}
    </label>
  )
}

// Date civile « AAAA-MM-JJ » pour un champ date, depuis une date de colonne (minuit UTC).
export function jourPourChamp(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : ""
}

// --- Nouvelle personne ----------------------------------------------------------------------

export function NouvellePersonne({ ouvertDepart = false }: { ouvertDepart?: boolean }) {
  const router = useRouter()
  return (
    <TiroirAction
      libelle="Nouvelle personne"
      secondaire={false}
      ouvertDepart={ouvertDepart}
      titre="Nouvelle personne"
      sousTitre="Prénom, nom et rôle habituel. L'invitation se fait ensuite, dans Réglages."
      action={creerPersonneAction}
      libelleBouton="Ajouter la personne"
      libelleEnCours="Ajout…"
      onSucces={(resultat) => {
        if (resultat.id) router.push(`/apps/equipe/personnes/${resultat.id}`)
      }}
    >
      <Champ libelle="Prénom">
        <input name="prenom" required maxLength={80} className={CHAMP} autoComplete="off" />
      </Champ>
      <Champ libelle="Nom">
        <input name="nom" required maxLength={80} className={CHAMP} autoComplete="off" />
      </Champ>
      <Champ libelle="Rôle habituel">
        <select name="roleHabituel" aria-label="Rôle habituel" required defaultValue="" className={CHAMP}>
          <option value="" disabled>
            Choisir un rôle
          </option>
          {ROLES_HABITUELS.map((role) => (
            <option key={role} value={role}>
              {LIBELLE_ROLE_HABITUEL[role]}
            </option>
          ))}
        </select>
      </Champ>
    </TiroirAction>
  )
}

// --- Profil -----------------------------------------------------------------------------------

export interface ValeursProfil {
  personId: string
  roles: RoleHabituel[]
  debutSportAuto: Date | null
  afficherTrophees: boolean
  // Le contact d'urgence et la taille ne sont dans le formulaire que pour qui les voit (dossier propre, écriture et plus).
  voitContact: boolean
  tailleVetements: string | null
  contactUrgence: string | null
}

export function ModifierProfil({ valeurs, desactive, raison }: { valeurs: ValeursProfil; desactive: boolean; raison: string | null }) {
  return (
    <TiroirAction
      libelle="Modifier le profil"
      titre="Profil"
      action={modifierProfilAction}
      libelleBouton="Enregistrer"
      libelleEnCours="Enregistrement…"
      desactive={desactive}
    >
      <input type="hidden" name="personId" value={valeurs.personId} />
      {raison && <p className="text-sm text-texte-discret">{raison}</p>}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Rôles habituels</legend>
        {ROLES_HABITUELS.map((role) => (
          <label key={role} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="rolesHabituels" value={role} defaultChecked={valeurs.roles.includes(role)} className="size-5" />
            {LIBELLE_ROLE_HABITUEL[role]}
          </label>
        ))}
      </fieldset>
      <Champ libelle="Début dans le sport auto" aide="Facultatif.">
        <input type="date" name="debutSportAuto" defaultValue={jourPourChamp(valeurs.debutSportAuto)} className={CHAMP} />
      </Champ>
      {valeurs.voitContact && (
        <>
          <Champ libelle="Taille de vêtements">
            <input name="tailleVetements" defaultValue={valeurs.tailleVetements ?? ""} maxLength={40} className={CHAMP} />
          </Champ>
          <Champ libelle="Contact d'urgence" aide="Seulement pour l'équipe : aucune donnée médicale.">
            <input name="contactUrgence" defaultValue={valeurs.contactUrgence ?? ""} maxLength={200} className={CHAMP} />
          </Champ>
        </>
      )}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="afficherTrophees" defaultChecked={valeurs.afficherTrophees} className="size-5" />
        Afficher mes paliers et trophées dans l'équipe
      </label>
    </TiroirAction>
  )
}

// --- Licence --------------------------------------------------------------------------------

export interface ValeursLicence {
  id: string
  type: TypeLicence
  numero: string | null
  saison: string | null
  valableDu: Date | null
  valableAu: Date | null
  montantCents: number | null
  asaContactId: string | null
}

// Document de la licence : facultatif. Sans nouveau fichier, le document déjà joint est gardé (voir le service).
function ChampDocumentLicence() {
  const [fichier, setFichier] = useState<string | null>(null)
  return <ChampFichier app="equipe" libelle="Document de la licence" valeur={fichier} name="documentFileId" onChange={(f) => setFichier(f?.id ?? null)} />
}

function champsLicence(valeurs: ValeursLicence | undefined, asas: Array<{ id: string; nom: string }>) {
  return (
    <>
      <Champ libelle="Type de licence">
        <select name="type" aria-label="Type de licence" required defaultValue={valeurs?.type ?? ""} className={CHAMP}>
          {!valeurs && (
            <option value="" disabled>
              Choisir un type
            </option>
          )}
          {TYPES_LICENCE.map((type) => (
            <option key={type} value={type}>
              {LIBELLES_TYPE_LICENCE[type]}
            </option>
          ))}
        </select>
      </Champ>
      <Champ libelle="Numéro">
        <input name="numero" defaultValue={valeurs?.numero ?? ""} maxLength={60} className={CHAMP} />
      </Champ>
      <Champ libelle="Saison">
        <input name="saison" defaultValue={valeurs?.saison ?? ""} maxLength={20} className={CHAMP} />
      </Champ>
      <Champ libelle="Valable du">
        <input type="date" name="valableDu" defaultValue={jourPourChamp(valeurs?.valableDu ?? null)} className={CHAMP} />
      </Champ>
      <Champ libelle="Valable jusqu'au" aide="Sans date de fin, la licence n'expire pas.">
        <input type="date" name="valableAu" defaultValue={jourPourChamp(valeurs?.valableAu ?? null)} className={CHAMP} />
      </Champ>
      <Champ libelle="ASA" aide={asas.length === 0 ? "Aucune ASA parmi les contacts de la team." : "Le contact d'ASA de la licence, s'il est connu."}>
        <select name="asaContactId" aria-label="ASA" defaultValue={valeurs?.asaContactId ?? ""} className={CHAMP}>
          <option value="">Aucune</option>
          {asas.map((asa) => (
            <option key={asa.id} value={asa.id}>
              {asa.nom}
            </option>
          ))}
        </select>
      </Champ>
      <ChampDocumentLicence />
      <Champ libelle="Montant payé (€)" aide="Si tu le saisis, Budget propose la dépense. Une seule fois.">
        <input
          name="montant"
          inputMode="decimal"
          defaultValue={valeurs?.montantCents != null ? (valeurs.montantCents / 100).toString().replace(".", ",") : ""}
          className={CHAMP}
        />
      </Champ>
    </>
  )
}

export function AjouterLicence({
  personId,
  asas,
  desactive,
  raison,
}: {
  personId: string
  asas: Array<{ id: string; nom: string }>
  desactive: boolean
  raison: string | null
}) {
  return (
    <TiroirAction
      libelle="Ajouter une licence"
      titre="Nouvelle licence"
      action={ajouterLicenceAction}
      libelleBouton="Ajouter la licence"
      libelleEnCours="Ajout…"
      desactive={desactive}
    >
      <input type="hidden" name="personId" value={personId} />
      {raison && <p className="text-sm text-texte-discret">{raison}</p>}
      {champsLicence(undefined, asas)}
    </TiroirAction>
  )
}

export function ModifierLicence({
  valeurs,
  asas,
  desactive,
  raison,
}: {
  valeurs: ValeursLicence
  asas: Array<{ id: string; nom: string }>
  desactive: boolean
  raison: string | null
}) {
  return (
    <>
      <TiroirAction
        libelle="Modifier"
        titre="Modifier la licence"
        action={modifierLicenceAction}
        libelleBouton="Enregistrer"
        libelleEnCours="Enregistrement…"
        desactive={desactive}
      >
        <input type="hidden" name="id" value={valeurs.id} />
        {raison && <p className="text-sm text-texte-discret">{raison}</p>}
        {champsLicence(valeurs, asas)}
      </TiroirAction>
      <RetirerLicence id={valeurs.id} desactive={desactive} />
    </>
  )
}

function RetirerLicence({ id, desactive }: { id: string; desactive: boolean }) {
  return (
    <TiroirAction
      libelle="Retirer"
      danger
      titre="Retirer la licence"
      question="Retirer cette licence de la fiche ? Elle reste dans l'historique de la personne."
      action={retirerLicenceAction}
      libelleBouton="Retirer"
      libelleEnCours="Retrait…"
      desactive={desactive}
    >
      <input type="hidden" name="id" value={id} />
    </TiroirAction>
  )
}

// --- Équipement -------------------------------------------------------------------------------

export interface ValeursEquipement {
  id: string
  type: TypeEquipement
  marque: string | null
  modele: string | null
  norme: string | null
  finHomologation: Date | null
  taille: string | null
  acheteLe: Date | null
}

function champsEquipement(valeurs?: ValeursEquipement) {
  return (
    <>
      <Champ libelle="Type d'équipement">
        <select name="type" aria-label="Type d'équipement" required defaultValue={valeurs?.type ?? ""} className={CHAMP}>
          {!valeurs && (
            <option value="" disabled>
              Choisir un type
            </option>
          )}
          {TYPES_EQUIPEMENT.map((type) => (
            <option key={type} value={type}>
              {LIBELLES_TYPE_EQUIPEMENT[type]}
            </option>
          ))}
        </select>
      </Champ>
      <Champ libelle="Marque">
        <input name="marque" defaultValue={valeurs?.marque ?? ""} maxLength={80} className={CHAMP} />
      </Champ>
      <Champ libelle="Modèle">
        <input name="modele" defaultValue={valeurs?.modele ?? ""} maxLength={80} className={CHAMP} />
      </Champ>
      <Champ libelle="Norme">
        <input name="norme" defaultValue={valeurs?.norme ?? ""} maxLength={40} className={CHAMP} />
      </Champ>
      <Champ libelle="Fin d'homologation" aide="Sans date, l'équipement n'expire pas.">
        <input type="date" name="finHomologation" defaultValue={jourPourChamp(valeurs?.finHomologation ?? null)} className={CHAMP} />
      </Champ>
      <Champ libelle="Taille">
        <input name="taille" defaultValue={valeurs?.taille ?? ""} maxLength={20} className={CHAMP} />
      </Champ>
      <Champ libelle="Acheté le">
        <input type="date" name="acheteLe" defaultValue={jourPourChamp(valeurs?.acheteLe ?? null)} className={CHAMP} />
      </Champ>
    </>
  )
}

export function AjouterEquipement({ personId, desactive, raison }: { personId: string; desactive: boolean; raison: string | null }) {
  return (
    <TiroirAction
      libelle="Ajouter un équipement"
      titre="Nouvel équipement"
      action={ajouterEquipementAction}
      libelleBouton="Ajouter l'équipement"
      libelleEnCours="Ajout…"
      desactive={desactive}
    >
      <input type="hidden" name="personId" value={personId} />
      {raison && <p className="text-sm text-texte-discret">{raison}</p>}
      {champsEquipement()}
    </TiroirAction>
  )
}

export function ModifierEquipement({ valeurs, desactive, raison }: { valeurs: ValeursEquipement; desactive: boolean; raison: string | null }) {
  return (
    <>
      <TiroirAction
        libelle="Modifier"
        titre="Modifier l'équipement"
        action={modifierEquipementAction}
        libelleBouton="Enregistrer"
        libelleEnCours="Enregistrement…"
        desactive={desactive}
      >
        <input type="hidden" name="id" value={valeurs.id} />
        {raison && <p className="text-sm text-texte-discret">{raison}</p>}
        {champsEquipement(valeurs)}
      </TiroirAction>
      <TiroirAction
        libelle="Retirer"
        danger
        titre="Retirer l'équipement"
        question="Retirer cet équipement de la fiche ? Il reste dans l'historique de la personne."
        action={retirerEquipementAction}
        libelleBouton="Retirer"
        libelleEnCours="Retrait…"
        desactive={desactive}
      >
        <input type="hidden" name="id" value={valeurs.id} />
      </TiroirAction>
    </>
  )
}

// --- Disponibilité ----------------------------------------------------------------------------

export function RepondreDisponibilite({
  personId,
  eventId,
  nomEpreuve,
  reponseActuelle,
  desactive,
  raison,
}: {
  personId: string
  eventId: string
  nomEpreuve: string
  reponseActuelle: ReponseDisponibilite | null
  desactive: boolean
  raison: string | null
}) {
  return (
    <TiroirAction
      libelle={reponseActuelle ? "Changer ma réponse" : "Répondre"}
      secondaire={false}
      titre="Disponibilité"
      sousTitre={nomEpreuve}
      action={repondreDisponibiliteAction}
      libelleBouton="Enregistrer ma réponse"
      libelleEnCours="Envoi…"
      desactive={desactive}
    >
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="eventId" value={eventId} />
      {raison && <p className="text-sm text-texte-discret">{raison}</p>}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Tu viens à cette épreuve ?</legend>
        {REPONSES_DISPONIBILITE.map((reponse) => (
          <label key={reponse} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="radio" name="reponse" value={reponse} defaultChecked={reponseActuelle === reponse} required className="size-5" />
            {LIBELLE_REPONSE[reponse]}
          </label>
        ))}
      </fieldset>
    </TiroirAction>
  )
}
