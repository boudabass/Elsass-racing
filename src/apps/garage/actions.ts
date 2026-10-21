"use server"

// Server Actions du Garage. N'exportent que des enveloppes des fonctions gardées de services-serveur.ts, jamais une
// fonction …Dans(ctx, …). Chacune renvoie { ok: true, id? } ou { ok: false, message } en français.

import { executer, texte, texteOuNull, type Resultat } from "@/core/sdk/actions-serveur"

import { refus } from "./erreurs"
import type { MotifDepose } from "./libelles"
import {
  ajouterUsureManuelle,
  changerStatutPiece,
  creerOrdre,
  creerPiece,
  modifierOrgane,
  poserPiece,
  retirerOrgane,
  type EntreeOrdre,
  type EntreeOrgane,
  type EntreePiece,
  type EntreeUsureManuelle,
} from "./services-serveur"

export type { Resultat }

const executerGarage = (action: () => Promise<string | void>) => executer("/apps/garage", action)

// Nombre facultatif d'un formulaire : vide devient null, un texte qui n'est pas un entier positif est refusé.
function entierOuNull(donnees: FormData, cle: string, libelle: string): number | null {
  const valeur = texteOuNull(donnees, cle)
  if (valeur === null) return null
  if (!/^\d+$/.test(valeur) || Number(valeur) < 1) refus(`${libelle} doit être un nombre entier, supérieur à zéro.`)
  return Number(valeur)
}

// Durées de vie de référence de l'organe. Le mode d'usure dit lesquelles sont saisies : seules les durées présentes
// dans le formulaire sont écrites, une durée absente du mode reste telle quelle.
export async function renseignerDureeVieAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() => {
    const entree: Partial<EntreeOrgane> = {}
    if (donnees.has("dureeVieReferenceKm")) {
      entree.dureeVieReferenceKm = entierOuNull(donnees, "dureeVieReferenceKm", "La durée en kilomètres")
    }
    if (donnees.has("dureeVieReferenceEpreuves")) {
      entree.dureeVieReferenceEpreuves = entierOuNull(donnees, "dureeVieReferenceEpreuves", "La durée en épreuves")
    }
    return modifierOrgane(texte(donnees, "organeId"), entree)
  })
}

// Remplacer : la pièce en place (si elle existe) part avec le motif de dépose, la rechange se pose, en une seule écriture.
export async function remplacerPieceAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(async () => {
    const motif = texteOuNull(donnees, "motifDepose") as MotifDepose | null
    await poserPiece(texte(donnees, "organeId"), texte(donnees, "partId"), { motifDepose: motif })
  })
}

// Régler l'organe : mode d'usure, durées de référence, seuils, position. Seuls les champs présents sont écrits ; un seuil
// vide reste tel quel, une durée vide redevient « à renseigner ».
export async function reglerOrganeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() => {
    const entree: Partial<EntreeOrgane> = {}
    if (donnees.has("modeUsure")) entree.modeUsure = texte(donnees, "modeUsure") as EntreeOrgane["modeUsure"]
    if (donnees.has("dureeVieReferenceKm")) {
      entree.dureeVieReferenceKm = entierOuNull(donnees, "dureeVieReferenceKm", "La durée en kilomètres")
    }
    if (donnees.has("dureeVieReferenceEpreuves")) {
      entree.dureeVieReferenceEpreuves = entierOuNull(donnees, "dureeVieReferenceEpreuves", "La durée en épreuves")
    }
    if (texteOuNull(donnees, "seuilOrangePct") !== null) {
      entree.seuilOrangePct = entierOuNull(donnees, "seuilOrangePct", "Le seuil orange") ?? undefined
    }
    if (texteOuNull(donnees, "seuilRougePct") !== null) {
      entree.seuilRougePct = entierOuNull(donnees, "seuilRougePct", "Le seuil rouge") ?? undefined
    }
    if (donnees.has("position")) entree.position = texteOuNull(donnees, "position")
    return modifierOrgane(texte(donnees, "organeId"), entree)
  })
}

// Retirer : refusé par le service si l'organe porte encore une pièce ; le motif s'affiche tel quel.
export async function retirerOrganeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() => retirerOrgane(texte(donnees, "organeId")))
}

// Montant saisi en euros (« 12,50 », ou « 12 ») : des centimes entiers. Vide devient null ; un montant illisible est refusé.
function centimesOuNull(donnees: FormData, cle: string): number | null {
  const valeur = texteOuNull(donnees, cle)
  if (valeur === null) return null
  const normalise = valeur.replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(normalise)) refus("Le prix doit être un montant en euros, par exemple 12,50.")
  return Math.round(Number(normalise) * 100)
}

// Ajouter une pièce au stock. Le prix et le fournisseur ne sont envoyés que par le formulaire complet (niveau écriture).
export async function creerPieceAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(async () => {
    const entree: EntreePiece = {
      componentTypeId: texte(donnees, "componentTypeId"),
      designation: texte(donnees, "designation"),
      marque: texteOuNull(donnees, "marque"),
      reference: texteOuNull(donnees, "reference"),
      numeroSerie: texteOuNull(donnees, "numeroSerie"),
      qualite: (texteOuNull(donnees, "qualite") ?? "origine") as EntreePiece["qualite"],
      dureeVieKm: entierOuNull(donnees, "dureeVieKm", "La durée en kilomètres"),
      dureeVieEpreuves: entierOuNull(donnees, "dureeVieEpreuves", "La durée en épreuves"),
      emplacement: texteOuNull(donnees, "emplacement"),
    }
    if (donnees.has("prixCents")) entree.prixCents = centimesOuNull(donnees, "prixCents")
    if (donnees.has("fournisseurContactId")) entree.fournisseurContactId = texteOuNull(donnees, "fournisseurContactId")
    return creerPiece(texte(donnees, "vehicleId"), entree)
  })
}

// Changer le statut à la main : seuls les statuts manuels passent, le service refuse une pièce montée.
export async function changerStatutPieceAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() =>
    changerStatutPiece(texte(donnees, "partId"), texte(donnees, "statut") as Parameters<typeof changerStatutPiece>[1]),
  )
}

// Roulage : kilomètres roulés sur la voiture et épreuve comptée ou non. Les km vides valent 0 ; une épreuve seule suffit.
export async function ajouterRoulageAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() => {
    const brut = texteOuNull(donnees, "km")
    if (brut !== null && (!/^\d+$/.test(brut) || Number(brut) > 100000)) {
      refus("Les kilomètres doivent être un nombre entier, de 0 à 100 000.")
    }
    const entree: EntreeUsureManuelle = { km: brut === null ? 0 : Number(brut), epreuve: donnees.has("epreuve") }
    return ajouterUsureManuelle(texte(donnees, "vehicleId"), entree)
  })
}

// Nouvel ordre de travail. Les personnes arrivent en plusieurs champs « personIds » ; une case vide est ignorée.
export async function creerOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() =>
    creerOrdre(texte(donnees, "vehicleId"), {
      type: texte(donnees, "type") as EntreeOrdre["type"],
      titre: texte(donnees, "titre"),
      vehicleComponentId: texteOuNull(donnees, "vehicleComponentId"),
      priorite: (texteOuNull(donnees, "priorite") ?? "normale") as EntreeOrdre["priorite"],
      aFaireAvantEventId: texteOuNull(donnees, "aFaireAvantEventId"),
      dureeEstimeeMinutes: entierOuNull(donnees, "dureeEstimeeMinutes", "La durée estimée"),
      personIds: donnees.getAll("personIds").map(String).filter((id) => id !== ""),
    }),
  )
}
