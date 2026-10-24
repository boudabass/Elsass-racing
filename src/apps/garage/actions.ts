"use server"

// Server Actions du Garage. N'exportent que des enveloppes des fonctions gardées de services-serveur.ts, jamais une
// fonction …Dans(ctx, …). Chacune renvoie { ok: true, id? } ou { ok: false, message } en français.

import { executer, texte, texteOuNull, type Resultat } from "@/core/sdk/actions-serveur"

import { refus } from "./erreurs"
import type { MotifDepose } from "./libelles"
import type { DestinationAncienne } from "./regles"
import {
  affecterOrdre,
  ajouterPieceOrdre,
  ajouterUsureManuelle,
  avancerOrdre,
  changerStatutOrdre,
  changerStatutPiece,
  creerCommande,
  creerIntervention,
  creerOrdre,
  creerPiece,
  expedierCommande,
  modifierCoutOrdre,
  modifierOrdre,
  modifierOrgane,
  poserNouvellePiece,
  poserPiece,
  preparerAtelier,
  recevoirCommande,
  reparerOrgane,
  retirerOrgane,
  retirerPieceOrdre,
  terminerOrdre,
  type EntreeCommande,
  type EntreeModificationOrdre,
  type EntreeNouvellePiece,
  type EntreeOrdre,
  type EntreeOrgane,
  type EntreePiece,
  type EntreeUsureManuelle,
} from "./services-serveur"
import { ajouterTrain, ajouterTrainAchete, monterTrain, saisirUsureTrain } from "./pneus-serveur"

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

// Préparer l'atelier : pose les organes par défaut d'une voiture qui n'en a pas encore (bouton « Préparer l'atelier »).
export async function preparerAtelierAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() => preparerAtelier(texte(donnees, "vehicleId")))
}

// Remplacer : la pièce en place (si elle existe) part avec son motif et sa destination. La pièce posée est une rechange
// du stock (source « rechange ») ou une nouvelle pièce, achetée avec un prix ou entrée au stock sans prix (source « nouvelle »).
export async function remplacerPieceAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(async () => {
    const organeId = texte(donnees, "organeId")
    const options = {
      motifDepose: texteOuNull(donnees, "motifDepose") as MotifDepose | null,
      destinationAncienne: texteOuNull(donnees, "destinationAncienne") as DestinationAncienne | null,
    }
    if (texteOuNull(donnees, "source") === "nouvelle") {
      const entree: EntreeNouvellePiece = {
        designation: texte(donnees, "designation"),
        marque: texteOuNull(donnees, "marque"),
        qualite: (texteOuNull(donnees, "qualite") ?? "origine") as EntreePiece["qualite"],
        dureeVieKm: entierOuNull(donnees, "dureeVieKm", "La durée en kilomètres"),
        dureeVieEpreuves: entierOuNull(donnees, "dureeVieEpreuves", "La durée en épreuves"),
        prixCents: centimesOuNull(donnees, "prixCents"),
        fournisseurContactId: texteOuNull(donnees, "fournisseurContactId"),
      }
      await poserNouvellePiece(organeId, entree, options)
      return
    }
    await poserPiece(organeId, texte(donnees, "partId"), options)
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

// Réglages d'un ordre : seuls les champs présents dans le formulaire sont écrits.
export async function modifierOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() => {
    const entree: EntreeModificationOrdre = {}
    if (donnees.has("titre")) entree.titre = texte(donnees, "titre")
    if (donnees.has("type")) entree.type = texte(donnees, "type") as EntreeOrdre["type"]
    if (donnees.has("priorite")) entree.priorite = texte(donnees, "priorite") as EntreeOrdre["priorite"]
    if (donnees.has("vehicleComponentId")) entree.vehicleComponentId = texteOuNull(donnees, "vehicleComponentId")
    if (donnees.has("aFaireAvantEventId")) entree.aFaireAvantEventId = texteOuNull(donnees, "aFaireAvantEventId")
    if (donnees.has("dureeEstimeeMinutes")) entree.dureeEstimeeMinutes = entierOuNull(donnees, "dureeEstimeeMinutes", "La durée estimée")
    return modifierOrdre(texte(donnees, "ordreId"), entree)
  })
}

// Personnes affectées : celles qui sont cochées. Aucune case cochée retire toutes les affectations.
export async function affecterOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() =>
    affecterOrdre(
      texte(donnees, "ordreId"),
      donnees.getAll("personIds").map(String).filter((id) => id !== ""),
    ),
  )
}

// Avancement : un entier de 0 à 100, saisi tel quel.
export async function avancerOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() => {
    const brut = texte(donnees, "pct")
    if (!/^\d+$/.test(brut)) refus("L'avancement doit être un nombre entier, de 0 à 100.")
    return avancerOrdre(texte(donnees, "ordreId"), Number(brut))
  })
}

// Statut « prévu » ou « en cours ». La fin passe par terminerOrdreAction.
export async function changerStatutOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() =>
    changerStatutOrdre(texte(donnees, "ordreId"), texte(donnees, "statut") as "prevu" | "en_cours"),
  )
}

// Coût de main-d'œuvre (en euros saisis) et prestataire. Vide efface le coût.
export async function modifierCoutOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() =>
    modifierCoutOrdre(texte(donnees, "ordreId"), {
      coutMainOeuvreCents: centimesOuNull(donnees, "coutMainOeuvre"),
      prestataireContactId: texteOuNull(donnees, "prestataireContactId"),
    }),
  )
}

export async function ajouterPieceOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() => ajouterPieceOrdre(texte(donnees, "ordreId"), texte(donnees, "partId")))
}

export async function retirerPieceOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() => retirerPieceOrdre(texte(donnees, "ordreId"), texte(donnees, "partId")))
}

// État de la pièce après réparation : vide reste null (la fin le refuse si la pièce l'exige), sinon un entier de 0 à 100.
function etatApresOuNull(donnees: FormData): number | null {
  const valeur = texteOuNull(donnees, "etatApresPct")
  if (valeur === null) return null
  if (!/^\d{1,3}$/.test(valeur) || Number(valeur) > 100) refus("L'état après réparation doit être un pourcentage entier, de 0 à 100.")
  return Number(valeur)
}

// Fin de l'ordre. Le motif de dépose n'est demandé que s'il y a une pièce en place (le service le vérifie). Une réparation
// sur un organe avec pièce montée demande aussi l'état de la pièce après réparation (954 v1.3, §4).
export async function terminerOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() =>
    terminerOrdre(texte(donnees, "ordreId"), {
      motifDepose: (texteOuNull(donnees, "motifDepose") as MotifDepose | null) ?? null,
      destinationAncienne: (texteOuNull(donnees, "destinationAncienne") as DestinationAncienne | null) ?? null,
      etatApresPct: etatApresOuNull(donnees),
    }),
  )
}

// Réparer (954 v1.3, §2) : un ordre de travail de type réparation sur l'organe, à faire. Coût et prestataire facultatifs.
export async function reparerOrganeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() =>
    reparerOrgane(texte(donnees, "organeId"), {
      titre: texte(donnees, "titre"),
      coutMainOeuvreCents: centimesOuNull(donnees, "coutMainOeuvre"),
      prestataireContactId: texteOuNull(donnees, "prestataireContactId"),
    }),
  )
}

// Intervention rapide : un ordre terminé, affecté à la personne qui saisit. La pièce est facultative.
export async function creerInterventionAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() =>
    creerIntervention(texte(donnees, "vehicleId"), {
      vehicleComponentId: texte(donnees, "vehicleComponentId"),
      titre: texte(donnees, "titre"),
      partId: texteOuNull(donnees, "partId"),
      motifDepose: (texteOuNull(donnees, "motifDepose") as MotifDepose | null) ?? null,
      destinationAncienne: (texteOuNull(donnees, "destinationAncienne") as DestinationAncienne | null) ?? null,
    }),
  )
}

// Commande : jusqu'à cinq lignes au formulaire. Une ligne est prise dès qu'un de ses champs est rempli ; une ligne vide est
// ignorée. Le prix se saisit en euros, une quantité vide vaut 1.
const LIGNES_COMMANDE = 5
const champLigne = (n: number, champ: string) => `ligne${n}${champ}`

export async function creerCommandeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(async () => {
    const lignes: NonNullable<EntreeCommande["lignes"]> = []
    for (let n = 1; n <= LIGNES_COMMANDE; n += 1) {
      const saisie = ["Designation", "ComponentTypeId", "Reference", "Quantite", "Prix"].some((c) => texteOuNull(donnees, champLigne(n, c)) !== null)
      if (!saisie) continue
      lignes.push({
        designation: texte(donnees, champLigne(n, "Designation")),
        componentTypeId: texte(donnees, champLigne(n, "ComponentTypeId")),
        reference: texteOuNull(donnees, champLigne(n, "Reference")),
        quantite: entierOuNull(donnees, champLigne(n, "Quantite"), "La quantité") ?? 1,
        prixUnitaireCents: centimesOuNull(donnees, champLigne(n, "Prix")) ?? 0,
        qualite: (texteOuNull(donnees, champLigne(n, "Qualite")) ?? "origine") as "origine" | "renforcee" | "competition",
      })
    }
    return creerCommande(texte(donnees, "vehicleId"), {
      supplierContactId: texte(donnees, "supplierContactId"),
      commandeeLe: texte(donnees, "commandeeLe"),
      livraisonPrevueLe: texteOuNull(donnees, "livraisonPrevueLe"),
      lignes,
    })
  })
}

export async function expedierCommandeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() => expedierCommande(texte(donnees, "id")))
}

// Réception : crée les pièces en stock, une par unité, et émet garage.piece_achetee après la transaction.
export async function recevoirCommandeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() => recevoirCommande(texte(donnees, "id")))
}

// --- Trains de pneus (tâche 4.4, §2) ------------------------------------------------------------

// Ajouter un train. Avec un prix, le fournisseur est obligatoire et l'achat passe par une commande reçue (ajouterTrainAchete) ;
// sans prix, le train entre directement à la team.
export async function creerTrainAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(async () => {
    const train = {
      marque: texte(donnees, "marque"),
      modele: texteOuNull(donnees, "modele"),
      gomme: texteOuNull(donnees, "gomme"),
      type: texte(donnees, "type"),
      dimensions: texteOuNull(donnees, "dimensions"),
    }
    const vehicleId = texte(donnees, "vehicleId")
    const prixCents = centimesOuNull(donnees, "prixCents")
    if (prixCents === null) {
      return ajouterTrain(vehicleId, { ...train, acheteLe: texteOuNull(donnees, "acheteLe") })
    }
    return ajouterTrainAchete(vehicleId, {
      train,
      fournisseurContactId: texteOuNull(donnees, "fournisseurContactId"),
      prixCents,
    })
  })
}

// Monter : un seul train à la fois sur l'organe Pneus ; le précédent est démonté sans destination.
export async function monterTrainAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(async () => {
    await monterTrain(texte(donnees, "tyreSetId"), texte(donnees, "vehicleComponentId"))
  })
}

// Usure estimée (0 à 100 %) et statut, saisis à la main.
export async function saisirUsureTrainAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(async () => {
    const usureEstimeePct = entierOuNull(donnees, "usureEstimeePct", "L'usure estimée")
    if (usureEstimeePct === null) refus("Indiquez l'usure estimée, de 0 à 100 %.")
    await saisirUsureTrain(texte(donnees, "tyreSetId"), { usureEstimeePct, statut: texte(donnees, "statut") })
  })
}
