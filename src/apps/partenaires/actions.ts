"use server"

// Server Actions de Partenaires (brief 3.6, §1). Chacune est une enveloppe d'une fonction gardée de
// services-serveur.ts (ou de document-serveur.ts) : jamais une fonction …Dans. Elles renvoient { ok, id? } ou
// { ok: false, message } en français. Le lien de la page partenaire renvoie son jeton une seule fois (ResultatLien).

import { revalidatePath } from "next/cache"

import { messageDe, texte, texteOuNull, executer, type Resultat } from "@/core/sdk/actions-serveur"

import { genererBilan, marquerBilanEnvoye } from "./bilan-serveur"
import { centimesDeSaisie } from "./affichage"
import { refus } from "./erreurs"
import { genererDocumentPdf } from "./document-serveur"
import { lirePartenaire, verifierEntreprise } from "./lectures-serveur"
import {
  ajouterAvenant,
  ajouterContrepartie,
  ajouterInteraction,
  ajouterPreuve,
  changerActifModele,
  creerCatalogue,
  creerConvention,
  creerLien,
  creerModele,
  creerProspect,
  marquerEnvoyee,
  marquerLu,
  marquerSignee,
  marquerTraite,
  masquerPreuve,
  modifierCatalogue,
  modifierContrepartie,
  modifierConvention,
  modifierCoordonnees,
  modifierInteraction,
  modifierModele,
  modifierPartenaire,
  modifierSections,
  poserLogoPartenaire,
  renouveler,
  renouvelerLien,
  resilier,
  reporter,
  revoquerLien,
  saisirAvancement,
  supprimerInteraction,
  supprimerPartenaire,
  supprimerPreuve,
  type EntreeCatalogue,
  type EntreeConvention,
  type EntreeContrepartie,
  type EntreeModifierContrepartie,
  type EntreeModifierConvention,
  type EntreeInteraction,
  type EntreeModele,
  type EntreePreuve,
  type EntreePartenaire,
  type EntreeCoordonnees,
  type EntreeAvenant,
  type EntreeProspect,
  type EntreeSignature,
} from "./services-serveur"

export type { Resultat }

export type ResultatLien = { ok: true; jeton: string } | { ok: false; message: string }

const CHEMIN = "/apps/partenaires"

const executerPartenaires = (action: () => Promise<string | void>) => executer(CHEMIN, action)

// Un montant saisi en euros (« 1 500 », « 1500,50 ») devient des centimes. Vide : zéro.
function centimesDe(saisie: string): number {
  const centimes = centimesDeSaisie(saisie)
  if (centimes === null) refus("Le montant doit être un nombre positif, en euros.")
  return centimes
}

// Nombre facultatif : vide devient null, un texte qui n'est pas un nombre entier est refusé.
function entierOuNull(donnees: FormData, cle: string): number | null {
  const valeur = texte(donnees, cle)
  if (valeur === "") return null
  if (!/^\d+$/.test(valeur)) refus("Ce nombre doit être entier.")
  return Number(valeur)
}

function listeDe(donnees: FormData, cle: string): string[] {
  return donnees.getAll(cle).map((valeur) => String(valeur)).filter((valeur) => valeur !== "")
}

// « Prénom Nom » : le premier mot est le prénom, le reste le nom.
function interlocuteurDe(saisie: string): { prenom: string; nom: string } | null {
  const mots = saisie.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return null
  if (mots.length === 1) refus("Indiquez le prénom et le nom de l'interlocuteur, ou laissez le champ vide.")
  return { prenom: mots[0], nom: mots.slice(1).join(" ") }
}

// --- Prospection et partenaire --------------------------------------------------------------

export async function creerProspectAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(async () => {
    const entree: EntreeProspect = { entreprise: texte(donnees, "entreprise"), contact: interlocuteurDe(texte(donnees, "contact")) }
    return creerProspect(entree)
  })
}

export async function modifierCoordonneesAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(async () => {
    const entree: EntreeCoordonnees = {
      adresse: texte(donnees, "adresse"),
      telephone: texte(donnees, "telephone"),
      email: texte(donnees, "email"),
      site: texte(donnees, "site"),
      siret: texte(donnees, "siret").replace(/\s/g, ""),
    }
    await modifierCoordonnees(texte(donnees, "partnerId"), entree)
  })
}

export async function modifierPartenaireAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(async () => {
    const source = texteOuNull(donnees, "source")
    const entree: EntreePartenaire = {
      source: source as EntreePartenaire["source"],
      secteur: texteOuNull(donnees, "secteur"),
      notes: texteOuNull(donnees, "notes"),
      suiviParPersonId: texteOuNull(donnees, "suiviParPersonId"),
    }
    await modifierPartenaire(texte(donnees, "partnerId"), entree)
  })
}

export async function changerStatutAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(async () => {
    await modifierPartenaire(texte(donnees, "partnerId"), { statut: texte(donnees, "statut") as EntreePartenaire["statut"] })
  })
}

// Relance d'une semaine : la date d'après la prochaine relance (ou d'aujourd'hui si elle est absente).
export async function reporterRelanceAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(async () => {
    const partenaire = await lirePartenaire(texte(donnees, "partnerId"))
    if (!partenaire) refus("Partenaire introuvable.")
    const base = partenaire.prochaineRelance ?? new Date().toISOString().slice(0, 10)
    const date = new Date(`${base}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + 7)
    await modifierPartenaire(partenaire.id, { prochaineRelance: date.toISOString().slice(0, 10) })
  })
}

export async function supprimerPartenaireAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(async () => {
    await supprimerPartenaire(texte(donnees, "partnerId"))
  })
}

export async function poserLogoAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(async () => {
    await poserLogoPartenaire(texte(donnees, "partnerId"), texte(donnees, "fileId"))
  })
}

// Indice affiché pendant la saisie du « + » : contact déjà connu, et déjà partenaire ou non.
export async function verifierEntrepriseAction(nom: string) {
  return verifierEntreprise(nom)
}

// --- Échanges ------------------------------------------------------------------------------

function entreeInteraction(donnees: FormData): EntreeInteraction {
  return {
    date: texte(donnees, "date"),
    type: texte(donnees, "type") as EntreeInteraction["type"],
    resume: texte(donnees, "resume"),
    auteurPersonId: texteOuNull(donnees, "auteurPersonId"),
    prochaineAction: texte(donnees, "prochaineAction"),
    prochaineActionLe: texteOuNull(donnees, "prochaineActionLe"),
  }
}

export async function ajouterInteractionAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => ajouterInteraction(texte(donnees, "partnerId"), entreeInteraction(donnees)))
}

export async function modifierInteractionAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => modifierInteraction(texte(donnees, "interactionId"), entreeInteraction(donnees)))
}

export async function supprimerInteractionAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => supprimerInteraction(texte(donnees, "interactionId")))
}

// --- Page partenaire -------------------------------------------------------------------------

export async function creerLienAction(_etat: ResultatLien | null, donnees: FormData): Promise<ResultatLien> {
  try {
    const { jeton } = await creerLien(texte(donnees, "partnerId"))
    revalidatePath(CHEMIN, "layout")
    return { ok: true, jeton }
  } catch (erreur) {
    return { ok: false, message: messageDe(erreur) }
  }
}

export async function renouvelerLienAction(_etat: ResultatLien | null, donnees: FormData): Promise<ResultatLien> {
  try {
    const { jeton } = await renouvelerLien(texte(donnees, "partnerId"))
    revalidatePath(CHEMIN, "layout")
    return { ok: true, jeton }
  } catch (erreur) {
    return { ok: false, message: messageDe(erreur) }
  }
}

export async function revoquerLienAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => revoquerLien(texte(donnees, "lienId")))
}

export async function modifierSectionsAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => modifierSections(texte(donnees, "lienId"), listeDe(donnees, "sections")))
}

export async function marquerLuAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => marquerLu(texte(donnees, "messageId")))
}

export async function marquerTraiteAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => marquerTraite(texte(donnees, "messageId"), texteOuNull(donnees, "personneId")))
}

// --- Conventions -----------------------------------------------------------------------------

// Lignes de l'échéancier : « date » et « montant » répétés, dans le même ordre.
function echeancierDe(donnees: FormData): { date: string; montantCentimes: number }[] {
  const dates = donnees.getAll("echeancierDate").map(String)
  const montants = donnees.getAll("echeancierMontant").map(String)
  return dates
    .map((date, index) => ({ date, montant: montants[index] ?? "" }))
    .filter((ligne) => ligne.date !== "" || ligne.montant.trim() !== "")
    .map((ligne) => {
      if (ligne.date === "") refus("Chaque ligne de l'échéancier a besoin d'une date.")
      return { date: ligne.date, montantCentimes: centimesDe(ligne.montant) }
    })
}

function champsConvention(donnees: FormData): EntreeModifierConvention {
  return {
    templateId: texte(donnees, "templateId") || undefined,
    seasonId: texteOuNull(donnees, "seasonId"),
    dateDebut: texte(donnees, "dateDebut") || undefined,
    dateFin: texte(donnees, "dateFin") || undefined,
    apportFinancierCentimes: centimesDe(texte(donnees, "apportFinancier")),
    apportNatureDescription: texteOuNull(donnees, "apportNatureDescription") ?? undefined,
    apportNatureValeurCentimes: texte(donnees, "apportNatureValeur") ? centimesDe(texte(donnees, "apportNatureValeur")) : null,
    echeancier: echeancierDe(donnees),
  }
}

export async function creerConventionAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(async () => {
    // Les montants et l'échéancier sont lus avant la création : une saisie fausse ne laisse pas de brouillon vide.
    const champs = champsConvention(donnees)
    const base: EntreeConvention = {
      partnerId: texte(donnees, "partnerId"),
      templateId: texte(donnees, "templateId"),
      seasonId: texteOuNull(donnees, "seasonId"),
      dateDebut: texte(donnees, "dateDebut"),
      dateFin: texte(donnees, "dateFin"),
    }
    const id = await creerConvention(base)
    await modifierConvention(id, champs)
    return id
  })
}

export async function modifierConventionAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(async () => {
    await modifierConvention(texte(donnees, "agreementId"), champsConvention(donnees))
  })
}

// Le PDF est généré et rattaché à la convention ; sa réponse porte l'identifiant du fichier.
export async function genererDocumentAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => genererDocumentPdf(texte(donnees, "agreementId")))
}

// --- Bilans ----------------------------------------------------------------------------------

// Le bilan est un PDF rattaché au partenaire ; sa réponse porte l'identifiant du bilan.
export async function genererBilanAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() =>
    genererBilan({
      partnerId: texte(donnees, "partnerId"),
      debut: texte(donnees, "debut"),
      fin: texte(donnees, "fin"),
      agreementId: texteOuNull(donnees, "agreementId"),
    }),
  )
}

export async function marquerBilanEnvoyeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => marquerBilanEnvoye(texte(donnees, "reportId")))
}

export async function marquerEnvoyeeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => marquerEnvoyee(texte(donnees, "agreementId")))
}

export async function marquerSigneeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(async () => {
    const entree: EntreeSignature = {
      signeeLe: texte(donnees, "signeeLe"),
      signataires: texte(donnees, "signataires"),
      documentSigneFileId: texteOuNull(donnees, "documentSigneFileId"),
    }
    await marquerSignee(texte(donnees, "agreementId"), entree)
  })
}

export async function resilierAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => resilier(texte(donnees, "agreementId"), { motif: texte(donnees, "motif") }))
}

export async function renouvelerAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => renouveler(texte(donnees, "agreementId")))
}

export async function ajouterAvenantAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => {
    const entree: EntreeAvenant = {
      date: texte(donnees, "date"),
      motif: texte(donnees, "motif"),
      changements: texte(donnees, "changements"),
      documentFileId: texteOuNull(donnees, "documentFileId"),
      signeLe: texteOuNull(donnees, "signeLe"),
    }
    return ajouterAvenant(texte(donnees, "agreementId"), entree)
  })
}

// --- Contreparties ---------------------------------------------------------------------------

function champsContrepartie(donnees: FormData): EntreeModifierContrepartie {
  return {
    libelle: texte(donnees, "libelle") || undefined,
    type: (texte(donnees, "type") || undefined) as EntreeModifierContrepartie["type"],
    quantitePromise: entierOuNull(donnees, "quantitePromise") ?? undefined,
    slotId: texteOuNull(donnees, "slotId"),
    slotNom: texte(donnees, "slotNom"),
    eventIds: listeDe(donnees, "eventIds"),
    echeance: texteOuNull(donnees, "echeance"),
  }
}

export async function ajouterContrepartieAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(async () => {
    const entree: EntreeContrepartie = {
      catalogId: texteOuNull(donnees, "catalogId"),
      libelle: texte(donnees, "libelle"),
      type: (texte(donnees, "type") || undefined) as EntreeContrepartie["type"],
      quantitePromise: entierOuNull(donnees, "quantitePromise") ?? undefined,
      unite: texteOuNull(donnees, "unite"),
    }
    // L'emplacement, les épreuves et l'échéance sont lus avant la création, pour qu'une erreur ne laisse rien à moitié fait.
    const complement = champsContrepartie(donnees)
    const id = await ajouterContrepartie(texte(donnees, "agreementId"), entree)
    if (complement.slotId || complement.eventIds?.length || complement.echeance) await modifierContrepartie(id, complement)
    return id
  })
}

export async function modifierContrepartieAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => modifierContrepartie(texte(donnees, "benefitId"), champsContrepartie(donnees)))
}

export async function saisirAvancementAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => saisirAvancement(texte(donnees, "benefitId"), entierOuNull(donnees, "quantiteTenue") ?? 0))
}

export async function reporterContrepartieAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => reporter(texte(donnees, "benefitId"), texteOuNull(donnees, "echeance")))
}

export async function ajouterPreuveAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => {
    const entree: EntreePreuve = {
      date: texte(donnees, "date"),
      type: texte(donnees, "type") as EntreePreuve["type"],
      eventId: texteOuNull(donnees, "eventId"),
      fileId: texteOuNull(donnees, "fileId"),
      lien: texteOuNull(donnees, "lien"),
      commentaire: texte(donnees, "commentaire"),
      visiblePartenaire: donnees.get("visiblePartenaire") === "on",
    }
    return ajouterPreuve(texte(donnees, "benefitId"), entree)
  })
}

export async function masquerPreuveAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => masquerPreuve(texte(donnees, "proofId"), texte(donnees, "visible") === "oui"))
}

export async function supprimerPreuveAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => supprimerPreuve(texte(donnees, "proofId")))
}

// --- Modèles et liste de base ----------------------------------------------------------------

export async function creerModeleAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => creerModele({ nom: texte(donnees, "nom"), texte: texte(donnees, "texte") }))
}

export async function modifierModeleAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => modifierModele(texte(donnees, "modeleId"), { nom: texte(donnees, "nom"), texte: texte(donnees, "texte") }))
}

export async function dupliquerModeleAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => creerModele({ nom: `${texte(donnees, "nom")} (copie)`, texte: texte(donnees, "texte") }))
}

export async function changerActifModeleAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => changerActifModele(texte(donnees, "modeleId"), texte(donnees, "actif") === "oui"))
}

function entreeCatalogue(donnees: FormData): EntreeCatalogue {
  return {
    nom: texte(donnees, "nom"),
    type: texte(donnees, "type") as EntreeCatalogue["type"],
    unite: texte(donnees, "unite"),
    quantiteDefaut: entierOuNull(donnees, "quantiteDefaut") ?? 1,
    ordre: entierOuNull(donnees, "ordre") ?? 0,
    actif: donnees.get("actif") === "on",
  }
}

export async function creerCatalogueAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => creerCatalogue(entreeCatalogue(donnees)))
}

export async function modifierCatalogueAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerPartenaires(() => modifierCatalogue(texte(donnees, "catalogueId"), entreeCatalogue(donnees)))
}
