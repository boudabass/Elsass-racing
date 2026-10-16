"use server"

// Server Actions de Saison. N'exportent QUE des enveloppes des fonctions gardées de
// services-serveur.ts : jamais une fonction …Dans(ctx, …) (cf. actions.test.ts).
// Chaque action renvoie { ok: true } ou { ok: false, message } en français.

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { ErreurAcces, libelleErreurAcces } from "@/core/droits/erreurs"

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
  saisirDebrief,
  creerSaison,
  cloturerSaison,
  enregistrerRecce,
  type EntreeInfos,
} from "./services-serveur"
import { parserDuree } from "./regles-resultats"
import { instantParis } from "./regles"

export type Resultat = { ok: true; id?: string } | { ok: false; message: string }

function messageDe(erreur: unknown): string {
  if (erreur instanceof ErreurSaison) return erreur.message
  if (erreur instanceof ErreurAcces) return libelleErreurAcces(erreur)
  if (erreur instanceof z.ZodError) return erreur.issues[0]?.message ?? "Donnée invalide."
  return "L'enregistrement n'a pas pu être fait. Réessaie."
}

async function executer(action: () => Promise<string | void>): Promise<Resultat> {
  try {
    const id = await action()
    revalidatePath("/apps/saison", "layout")
    return { ok: true, id: id ?? undefined }
  } catch (erreur) {
    return { ok: false, message: messageDe(erreur) }
  }
}

function texte(donnees: FormData, cle: string): string {
  return String(donnees.get(cle) ?? "").trim()
}

// Champ optionnel : vide devient null.
function textePlein(donnees: FormData, cle: string): string | null {
  const valeur = texte(donnees, cle)
  return valeur === "" ? null : valeur
}

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
  return textePlein(donnees, cle)
}

// Date et heure d'un champ datetime-local (fuseau de Paris, heure d'été ou d'hiver), en ISO.
function instant(donnees: FormData, cle: string): string | null {
  const brut = textePlein(donnees, cle)
  if (!brut) return null
  const date = instantParis(brut)
  if (!date) throw new ErreurSaison("Date et heure invalides.")
  return date.toISOString()
}

export async function creerEpreuveAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(() =>
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
    lieu: textePlein(donnees, "lieu"),
    departement: textePlein(donnees, "departement"),
    lienOfficiel: textePlein(donnees, "lienOfficiel"),
    organisateurContactId: textePlein(donnees, "organisateurContactId"),
    asaContactId: textePlein(donnees, "asaContactId"),
    championnat: textePlein(donnees, "championnat"),
    lienResultats: textePlein(donnees, "lienResultats"),
    engagementsOuverture: dateCivile(donnees, "engagementsOuverture"),
    engagementsCloture: dateCivile(donnees, "engagementsCloture"),
    tarifNormal: centimes(donnees, "tarifNormal"),
    tarifLicencieAsa: centimes(donnees, "tarifLicencieAsa"),
    geolocalisationIncluse: donnees.get("geolocalisationIncluse") === "on",
    nbSpeciales: entier(donnees, "nbSpeciales"),
    kmChronometresPrevus: nombre(donnees, "kmChronometresPrevus"),
    kmTotal: nombre(donnees, "kmTotal"),
    lieuParcAssistance: textePlein(donnees, "lieuParcAssistance"),
    adresseEnvoiDossier: textePlein(donnees, "adresseEnvoiDossier"),
  }
  return executer(() => modifierInfosEpreuve(texte(donnees, "eventId"), entree))
}

export async function annulerEpreuveAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(() => annulerEpreuve(texte(donnees, "eventId")))
}

export async function engagerVoitureAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(() =>
    creerEngagement({
      eventId: texte(donnees, "eventId"),
      vehicleId: texte(donnees, "vehicleId"),
      piloteId: textePlein(donnees, "piloteId"),
      copiloteId: textePlein(donnees, "copiloteId"),
    }),
  )
}

export async function enregistrerPaiementAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  const montant = centimes(donnees, "montant")
  if (montant === null) return { ok: false, message: "Indique le montant payé." }
  return executer(() =>
    enregistrerPaiement(texte(donnees, "entryId"), {
      payeLe: texte(donnees, "payeLe"),
      mode: texte(donnees, "mode") as "virement",
      payeurPersonId: textePlein(donnees, "payeurPersonId"),
      montant,
    }),
  )
}

export async function modifierInscriptionAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(() =>
    modifierInscription(texte(donnees, "entryId"), {
      concurrentNom: textePlein(donnees, "concurrentNom"),
      montantDu: centimes(donnees, "montantDu"),
      dossierEnvoyeLe: instant(donnees, "dossierEnvoyeLe"),
      confirmationRecueLe: instant(donnees, "confirmationRecueLe"),
      listeEngagesPubliee: donnees.get("listeEngagesPubliee") === "on",
      remarques: textePlein(donnees, "remarques"),
      numeroCourse: textePlein(donnees, "numeroCourse"),
      groupe: textePlein(donnees, "groupe"),
      classe: textePlein(donnees, "classe"),
    }),
  )
}

export async function ajouterSpecialeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(() =>
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
  return executer(() =>
    ajouterProgramme(texte(donnees, "eventId"), {
      type: texte(donnees, "type") as "depart",
      stageId: textePlein(donnees, "stageId"),
      numeroPassage: entier(donnees, "numeroPassage"),
      heurePrevue: instant(donnees, "heurePrevue"),
      lieu: textePlein(donnees, "lieu"),
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
  return executer(() =>
    saisirResultat(entryId, {
      statutFinal: texte(donnees, "statutFinal") as "arrivee",
      causeAbandon: textePlein(donnees, "causeAbandon"),
      stageAbandonId: textePlein(donnees, "stageAbandonId"),
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
  return executer(() =>
    joindrePreuve(texte(donnees, "entryId"), { preuveLien: textePlein(donnees, "preuveLien") }),
  )
}

export async function validerResultatAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(() => validerResultat(texte(donnees, "entryId")))
}

export async function contesterResultatAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(() => contesterResultat(texte(donnees, "entryId"), texte(donnees, "commentaire")))
}

export async function saisirDebriefAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(() =>
    saisirDebrief(texte(donnees, "entryId"), {
      ressenti: entier(donnees, "ressenti") ?? 0,
      pointsPositifs: textePlein(donnees, "pointsPositifs"),
      pointsAAmeliorer: textePlein(donnees, "pointsAAmeliorer"),
      problemesVoiture: textePlein(donnees, "problemesVoiture"),
    }),
  )
}

export async function creerSaisonAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  const annee = entier(donnees, "annee") ?? 0
  const debut = texte(donnees, "dateDebut")
  const fin = texte(donnees, "dateFin")
  return executer(() => creerSaison(annee, debut && fin ? { debut, fin } : undefined))
}

export async function cloturerSaisonAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(() => cloturerSaison(texte(donnees, "seasonId")))
}

// --- Tâche 2.4 : reconnaissances ---

export async function enregistrerRecceAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(() =>
    enregistrerRecce(texte(donnees, "eventId"), {
      debutAutorise: instant(donnees, "debutAutorise"),
      finAutorisee: instant(donnees, "finAutorisee"),
      passagesAutorises: entier(donnees, "passagesAutorises"),
      vitesseMax: entier(donnees, "vitesseMax"),
      vehiculeId: textePlein(donnees, "vehiculeId"),
      plaqueRecue: donnees.get("plaqueRecue") === "on",
      consignes: textePlein(donnees, "consignes"),
    }),
  )
}
