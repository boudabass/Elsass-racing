"use server"

// Server Actions de Saison. N'exportent QUE des enveloppes des fonctions gardées de
// services-serveur.ts : jamais une fonction …Dans(ctx, …) (cf. actions.test.ts).
// Chaque action renvoie { ok: true } ou { ok: false, message } en français.

import { executer, texte, texteOuNull, type Resultat } from "@/core/sdk/actions-serveur"

import {
  ErreurSaison,
  annulerEpreuve,
  ajouterProgramme,
  ajouterSpeciale,
  creerEngagement,
  creerEpreuve,
  enregistrerPaiement,
  modifierInfosEpreuve,
  modifierInscription,
  saisirResultat,
  joindrePreuve,
  validerResultat,
  contesterResultat,
  creerSaison,
  cloturerSaison,
  enregistrerRecce,
  type EntreeInfos,
} from "./services-serveur"
import { parserDuree } from "./regles-resultats"
import { instantParis } from "./regles"

export type { Resultat }

const executerSaison = (action: () => Promise<string | void>) => executer("/apps/saison", action)

// Montant saisi en euros (virgule ou point), stocké en centimes.
function centimes(donnees: FormData, cle: string): number | null {
  const brut = texte(donnees, cle).replace(",", ".")
  if (brut === "") return null
  const euros = Number(brut)
  if (!Number.isFinite(euros)) throw new ErreurSaison(`Montant invalide : « ${brut} ».`)
  return Math.round(euros * 100)
}

function nombre(donnees: FormData, cle: string): number | null {
  const brut = texte(donnees, cle).replace(",", ".")
  if (brut === "") return null
  const valeur = Number(brut)
  if (!Number.isFinite(valeur)) throw new ErreurSaison(`Nombre invalide : « ${brut} ».`)
  return valeur
}

function entier(donnees: FormData, cle: string): number | null {
  const valeur = nombre(donnees, cle)
  return valeur === null ? null : Math.trunc(valeur)
}

// Date calendaire AAAA-MM-JJ, vide devient null.
function dateCivile(donnees: FormData, cle: string): string | null {
  return texteOuNull(donnees, cle)
}

// Date et heure d'un champ datetime-local (fuseau de Paris, heure d'été ou d'hiver), en ISO.
function instant(donnees: FormData, cle: string): string | null {
  const brut = texteOuNull(donnees, cle)
  if (!brut) return null
  const date = instantParis(brut)
  if (!date) throw new ErreurSaison("Date et heure invalides.")
  return date.toISOString()
}

export async function creerEpreuveAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerSaison(() =>
    creerEpreuve({
      nom: texte(donnees, "nom"),
      dateDebut: texte(donnees, "dateDebut"),
      dateFin: texte(donnees, "dateFin"),
      type: texte(donnees, "type") as "rallye",
    }),
  )
}

export async function modifierInfosAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  const entree: EntreeInfos = {
    lieu: texteOuNull(donnees, "lieu"),
    departement: texteOuNull(donnees, "departement"),
    lienOfficiel: texteOuNull(donnees, "lienOfficiel"),
    organisateurContactId: texteOuNull(donnees, "organisateurContactId"),
    asaContactId: texteOuNull(donnees, "asaContactId"),
    championnat: texteOuNull(donnees, "championnat"),
    lienResultats: texteOuNull(donnees, "lienResultats"),
    engagementsOuverture: dateCivile(donnees, "engagementsOuverture"),
    engagementsCloture: dateCivile(donnees, "engagementsCloture"),
    tarifNormal: centimes(donnees, "tarifNormal"),
    tarifLicencieAsa: centimes(donnees, "tarifLicencieAsa"),
    geolocalisationIncluse: donnees.get("geolocalisationIncluse") === "on",
    nbSpeciales: entier(donnees, "nbSpeciales"),
    kmChronometresPrevus: nombre(donnees, "kmChronometresPrevus"),
    kmTotal: nombre(donnees, "kmTotal"),
    lieuParcAssistance: texteOuNull(donnees, "lieuParcAssistance"),
    adresseEnvoiDossier: texteOuNull(donnees, "adresseEnvoiDossier"),
  }
  return executerSaison(() => modifierInfosEpreuve(texte(donnees, "eventId"), entree))
}

export async function annulerEpreuveAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerSaison(() => annulerEpreuve(texte(donnees, "eventId")))
}

export async function engagerVoitureAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerSaison(() =>
    creerEngagement({
      eventId: texte(donnees, "eventId"),
      vehicleId: texte(donnees, "vehicleId"),
      piloteId: texteOuNull(donnees, "piloteId"),
      copiloteId: texteOuNull(donnees, "copiloteId"),
    }),
  )
}

export async function enregistrerPaiementAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  const montant = centimes(donnees, "montant")
  if (montant === null) return { ok: false, message: "Indique le montant payé." }
  return executerSaison(() =>
    enregistrerPaiement(texte(donnees, "entryId"), {
      payeLe: texte(donnees, "payeLe"),
      mode: texte(donnees, "mode") as "virement",
      payeurPersonId: texteOuNull(donnees, "payeurPersonId"),
      montant,
    }),
  )
}

export async function modifierInscriptionAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerSaison(() =>
    modifierInscription(texte(donnees, "entryId"), {
      concurrentNom: texteOuNull(donnees, "concurrentNom"),
      montantDu: centimes(donnees, "montantDu"),
      dossierEnvoyeLe: instant(donnees, "dossierEnvoyeLe"),
      confirmationRecueLe: instant(donnees, "confirmationRecueLe"),
      listeEngagesPubliee: donnees.get("listeEngagesPubliee") === "on",
      remarques: texteOuNull(donnees, "remarques"),
      numeroCourse: texteOuNull(donnees, "numeroCourse"),
      groupe: texteOuNull(donnees, "groupe"),
      classe: texteOuNull(donnees, "classe"),
    }),
  )
}

export async function ajouterSpecialeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerSaison(() =>
    ajouterSpeciale(texte(donnees, "eventId"), {
      numero: entier(donnees, "numero") ?? 0,
      nom: texte(donnees, "nom"),
      longueurKm: nombre(donnees, "longueurKm"),
      nbPassages: entier(donnees, "nbPassages"),
      type: (texte(donnees, "type") || "speciale") as "speciale",
    }),
  )
}

export async function ajouterProgrammeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerSaison(() =>
    ajouterProgramme(texte(donnees, "eventId"), {
      type: texte(donnees, "type") as "depart",
      stageId: texteOuNull(donnees, "stageId"),
      numeroPassage: entier(donnees, "numeroPassage"),
      heurePrevue: instant(donnees, "heurePrevue"),
      lieu: texteOuNull(donnees, "lieu"),
    }),
  )
}

// --- Tâche 2.3 : résultats, débrief, saisons ------------------------------------------------------

// Temps saisi en mm:ss,d, stocké en millisecondes. Vide devient null ; invalide refuse.
function tempsMs(donnees: FormData, cle: string): number | null {
  const brut = texte(donnees, cle)
  if (brut === "") return null
  const ms = parserDuree(brut)
  if (ms === null) throw new ErreurSaison(`Temps invalide : « ${brut} ». Format attendu : mm:ss,d.`)
  return ms
}

export async function saisirResultatAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  const entryId = texte(donnees, "entryId")
  return executerSaison(() =>
    saisirResultat(entryId, {
      statutFinal: texte(donnees, "statutFinal") as "arrivee",
      causeAbandon: texteOuNull(donnees, "causeAbandon"),
      stageAbandonId: texteOuNull(donnees, "stageAbandonId"),
      classementGeneral: entier(donnees, "classementGeneral"),
      classementClasse: entier(donnees, "classementClasse"),
      nbClasses: entier(donnees, "nbClasses"),
      classementGroupe: entier(donnees, "classementGroupe"),
      nbPartantsClasse: entier(donnees, "nbPartantsClasse"),
      tempsTotalMs: tempsMs(donnees, "tempsTotal"),
      penalitesMs: tempsMs(donnees, "penalites"),
      kmChronometres: nombre(donnees, "kmChronometres"),
      public: donnees.get("public") === "on",
    }),
  )
}

export async function joindrePreuveAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerSaison(() =>
    joindrePreuve(texte(donnees, "entryId"), { preuveLien: texteOuNull(donnees, "preuveLien") }),
  )
}

export async function validerResultatAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerSaison(() => validerResultat(texte(donnees, "entryId")))
}

export async function contesterResultatAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerSaison(() => contesterResultat(texte(donnees, "entryId"), texte(donnees, "commentaire")))
}

export async function creerSaisonAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  const annee = entier(donnees, "annee") ?? 0
  const debut = texte(donnees, "dateDebut")
  const fin = texte(donnees, "dateFin")
  return executerSaison(() => creerSaison(annee, debut && fin ? { debut, fin } : undefined))
}

export async function cloturerSaisonAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerSaison(() => cloturerSaison(texte(donnees, "seasonId")))
}

// --- Tâche 2.4 : reconnaissances ---

export async function enregistrerRecceAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerSaison(() =>
    enregistrerRecce(texte(donnees, "eventId"), {
      debutAutorise: instant(donnees, "debutAutorise"),
      finAutorisee: instant(donnees, "finAutorisee"),
      passagesAutorises: entier(donnees, "passagesAutorises"),
      vitesseMax: entier(donnees, "vitesseMax"),
      vehiculeId: texteOuNull(donnees, "vehiculeId"),
      plaqueRecue: donnees.get("plaqueRecue") === "on",
      consignes: texteOuNull(donnees, "consignes"),
    }),
  )
}
