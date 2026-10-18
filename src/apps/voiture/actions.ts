"use server"

// Server Actions de Voiture. N'exportent que des enveloppes des fonctions gardées de services-serveur.ts,
// jamais une fonction …Dans(ctx, …). Chacune renvoie { ok: true, id? } ou { ok: false, message } en français.

import { executer, texte, texteOuNull, type Resultat } from "@/core/sdk/actions-serveur"

import { refus } from "./erreurs"
import { CHAMPS_REGLAGE } from "./regles"
import {
  creerPapier,
  creerReglage,
  creerVehicule,
  enregistrerCommeReference,
  masquerChamps,
  modifierFiche,
  modifierPapier,
  modifierReglage,
  poserPhotoPrincipale,
  supprimerPapier,
  supprimerReglage,
  type EntreeFiche,
  type EntreePapier,
  type EntreeReglage,
  type EntreeVehicule,
} from "./services-serveur"

export type { Resultat }

const executerVoiture = (action: () => Promise<string | void>) => executer("/apps/voiture", action)

// Nombre facultatif d'un formulaire : vide devient null, un texte qui n'est pas un entier est refusé.
function entierOuNull(donnees: FormData, cle: string): number | null {
  const valeur = texteOuNull(donnees, cle)
  if (valeur === null) return null
  if (!/^\d+$/.test(valeur)) refus(`${cle === "annee" ? "L'année" : "Ce nombre"} doit être un nombre entier.`)
  return Number(valeur)
}

export async function creerVehiculeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => {
    const entree: EntreeVehicule = {
      nom: texte(donnees, "nom"),
      type: texte(donnees, "type") as EntreeVehicule["type"],
      gabaritCle: texteOuNull(donnees, "gabaritCle"),
    }
    return creerVehicule(entree)
  })
}

// Identité : les champs de voiture_vehicle. Un champ vide est effacé (null), jamais enregistré vide.
export async function modifierFicheAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => {
    const entree: EntreeFiche = {
      marque: texteOuNull(donnees, "marque"),
      modele: texteOuNull(donnees, "modele"),
      version: texteOuNull(donnees, "version"),
      annee: entierOuNull(donnees, "annee"),
      cylindreeCm3: entierOuNull(donnees, "cylindreeCm3"),
      puissanceCh: entierOuNull(donnees, "puissanceCh"),
      poidsKg: entierOuNull(donnees, "poidsKg"),
      couleur: texteOuNull(donnees, "couleur"),
      immatriculation: texteOuNull(donnees, "immatriculation"),
      numeroSerie: texteOuNull(donnees, "numeroSerie"),
      groupe: texteOuNull(donnees, "groupe"),
      classe: texteOuNull(donnees, "classe"),
      discipline: texteOuNull(donnees, "discipline"),
      acheteLe: texteOuNull(donnees, "acheteLe"),
    }
    return modifierFiche(texte(donnees, "vehicleId"), entree)
  })
}

export async function poserPhotoPrincipaleAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => poserPhotoPrincipale(texte(donnees, "vehicleId"), texteOuNull(donnees, "fileId")))
}

// Papier : même formulaire pour l'ajout et la modification.
function entreePapier(donnees: FormData): EntreePapier {
  return {
    type: texte(donnees, "type") as EntreePapier["type"],
    libelle: texteOuNull(donnees, "libelle"),
    numero: texteOuNull(donnees, "numero"),
    delivreLe: texteOuNull(donnees, "delivreLe"),
    valableJusquAu: texteOuNull(donnees, "valableJusquAu"),
    documentFileId: texteOuNull(donnees, "documentFileId"),
  }
}

export async function creerPapierAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => creerPapier(texte(donnees, "vehicleId"), entreePapier(donnees)))
}

export async function modifierPapierAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => modifierPapier(texte(donnees, "papierId"), entreePapier(donnees)))
}

export async function supprimerPapierAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => supprimerPapier(texte(donnees, "papierId")))
}

// Fiche de réglage. Les valeurs arrivent en champs « v_<clé> » ; la virgule est acceptée. Un champ vide n'est
// pas envoyé (il n'y a donc pas de valeur à enregistrer). Les champs masqués gardent leur valeur par un champ caché.
const NOMBRE = /^-?\d+(?:[.,]\d+)?$/

function valeursDuFormulaire(donnees: FormData): Record<string, number> {
  const valeurs: Record<string, number> = {}
  for (const champ of CHAMPS_REGLAGE) {
    const brut = texteOuNull(donnees, `v_${champ.cle}`)
    if (brut === null) continue
    if (!NOMBRE.test(brut)) refus(`${champ.libelle} : un nombre est attendu.`)
    valeurs[champ.cle] = Number(brut.replace(",", "."))
  }
  return valeurs
}

// Épreuve : la valeur du formulaire est « entryId|eventId » (ou vide).
function entreeReglage(donnees: FormData): EntreeReglage {
  const [entryId, eventId] = (texteOuNull(donnees, "epreuve") ?? "|").split("|")
  const note = texteOuNull(donnees, "note")
  return {
    date: texte(donnees, "date"),
    eventId: eventId || null,
    entryId: entryId || null,
    conditions: texteOuNull(donnees, "conditions") as EntreeReglage["conditions"],
    revetement: texteOuNull(donnees, "revetement") as EntreeReglage["revetement"],
    valeurs: valeursDuFormulaire(donnees),
    remarques: texte(donnees, "remarques"),
    note: note ? Number(note) : null,
    setupTemplateId: texteOuNull(donnees, "modeleId"),
  }
}

export async function creerReglageAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => creerReglage(texte(donnees, "vehicleId"), entreeReglage(donnees)))
}

export async function modifierReglageAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => modifierReglage(texte(donnees, "reglageId"), entreeReglage(donnees)))
}

export async function supprimerReglageAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => supprimerReglage(texte(donnees, "reglageId")))
}

export async function enregistrerCommeReferenceAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => enregistrerCommeReference(texte(donnees, "reglageId"), texte(donnees, "nom")))
}

// Champs masqués : la liste des cases cochées remplace la préférence de la team. Les essentiels sont refusés par le service.
export async function masquerChampsAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => masquerChamps(donnees.getAll("masque").map((cle) => String(cle))))
}
