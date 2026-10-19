"use server"

// Server Actions de Voiture. N'exportent que des enveloppes des fonctions gardées de services-serveur.ts,
// jamais une fonction …Dans(ctx, …). Chacune renvoie { ok: true, id? } ou { ok: false, message } en français.

import { executer, texte, texteOuNull, type Resultat } from "@/core/sdk/actions-serveur"

import { refus } from "./erreurs"
import { reserverPourPartenaireDans } from "./liaisons-serveur"
import { lireSaisieReglage } from "./saisie-reglage"
import {
  ajouterEmplacement,
  choisirGabarit,
  completerGabarit,
  creerPapier,
  creerVehicule,
  enregistrerCommeReference,
  marquerIndisponible,
  masquerChamps,
  modifierEmplacement,
  modifierFiche,
  modifierPapier,
  modifierReglage,
  poserLogo,
  poserPhotoPrincipale,
  accesVoiture,
  reserverEmplacement,
  retirerLogo,
  supprimerEmplacement,
  supprimerPapier,
  supprimerReglage,
  type EntreeEmplacement,
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

// Fiche de réglage : la lecture du formulaire est dans saisie-reglage.ts. La création n'a pas d'action serveur :
// elle s'écrit dans la base locale (synchro, voiture_setup). Seule la modification passe ici.
function entreeReglage(donnees: FormData): EntreeReglage {
  const lecture = lireSaisieReglage(donnees)
  if (!lecture.ok) refus(lecture.message)
  return lecture.entree
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

// Plan de déco (brief 3.4). Une forme arrive en JSON depuis le plan ; le service la valide, comme les autres champs.
function formeDuFormulaire(donnees: FormData): unknown {
  const brut = texteOuNull(donnees, "forme")
  if (brut === null) return null
  try {
    return JSON.parse(brut)
  } catch {
    refus("La forme de l'emplacement n'est pas lisible.")
  }
}

// Ajout : un rectangle au centre de la vue affichée. Le nom vient du plan.
export async function ajouterEmplacementAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => {
    const entree: EntreeEmplacement = {
      nom: texte(donnees, "nom"),
      vue: texte(donnees, "vue") as EntreeEmplacement["vue"],
      forme: formeDuFormulaire(donnees) as EntreeEmplacement["forme"],
      symetrique: false,
      largeurCm: null,
      hauteurCm: null,
    }
    return ajouterEmplacement(texte(donnees, "vehicleId"), entree)
  })
}

// Complément du gabarit : ajoute les emplacements des vues ajoutées au gabarit à un véhicule existant, reprend les
// lignes hors plan, et retire les emplacements que le gabarit ne porte plus (sans toucher aux lignes occupées). Sans
// effet si tout y est déjà. Le message `avis` signale les lignes gardées.
export type ResultatComplement = { ok: true; avis?: string } | { ok: false; message: string }

const VUES_DU_PLAN = ["droite", "gauche", "avant", "arriere", "dessus"] as const

function avisDesConserves(conserves: string[]): ResultatComplement {
  if (conserves.length === 0) return { ok: true }
  const noms = conserves.map((nom) => `« ${nom} »`).join(", ")
  return {
    ok: true,
    avis: `${noms} ${conserves.length > 1 ? "sont occupées ou liées à une contrepartie et restent" : "est occupée ou liée à une contrepartie et reste"} sur le plan. Libérez-la pour la retirer.`,
  }
}

export async function completerGabaritAction(_etat: ResultatComplement | null, donnees: FormData): Promise<ResultatComplement> {
  const bilan: { conserves: string[] } = { conserves: [] }
  const resultat = await executerVoiture(async () => {
    const vue = VUES_DU_PLAN.find((v) => v === texte(donnees, "vue"))
    if (!vue) refus("Choisissez une vue du plan avant de compléter le gabarit.")
    bilan.conserves = (await completerGabarit(texte(donnees, "vehicleId"), vue)).conserves
  })
  if (!resultat.ok) return resultat
  return avisDesConserves(bilan.conserves)
}

// Choix du modèle de plan d'un véhicule qui n'en a pas : pose le modèle, puis crée ses emplacements dans la vue affichée.
export async function choisirGabaritAction(_etat: ResultatComplement | null, donnees: FormData): Promise<ResultatComplement> {
  const bilan: { conserves: string[] } = { conserves: [] }
  const resultat = await executerVoiture(async () => {
    const vue = VUES_DU_PLAN.find((v) => v === texte(donnees, "vue"))
    if (!vue) refus("Choisissez une vue du plan avant de choisir le modèle.")
    bilan.conserves = (await choisirGabarit(texte(donnees, "vehicleId"), texte(donnees, "gabaritCle"), vue)).conserves
  })
  if (!resultat.ok) return resultat
  return avisDesConserves(bilan.conserves)
}

// Renommer : le nom seulement. La place et la taille se règlent sur le plan, les dimensions en cm ne se saisissent plus.
export async function renommerEmplacementAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => modifierEmplacement(texte(donnees, "slotId"), { nom: texte(donnees, "nom") }))
}

// Déplacement ou redimensionnement : seule la forme change.
export async function enregistrerPositionAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => modifierEmplacement(texte(donnees, "slotId"), { forme: formeDuFormulaire(donnees) }))
}

export async function supprimerEmplacementAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => supprimerEmplacement(texte(donnees, "slotId")))
}

export async function marquerIndisponibleAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => marquerIndisponible(texte(donnees, "slotId"), texte(donnees, "indisponible") === "oui"))
}

// Réservation à la main : un partenaire de la liste (ses dates et son logo viennent de sa convention, brief 3.11 §3),
// ou « Autre » avec un nom libre, pour un sponsor hors app.
export async function reserverEmplacementAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(async () => {
    const partenaireId = texteOuNull(donnees, "partenaireId")
    if (partenaireId) {
      const { ctx } = await accesVoiture("ecriture")
      return reserverPourPartenaireDans(ctx, texte(donnees, "slotId"), partenaireId)
    }
    return reserverEmplacement(texte(donnees, "slotId"), {
      partenaireNom: texte(donnees, "partenaireNom"),
      du: texteOuNull(donnees, "du"),
      au: texteOuNull(donnees, "au"),
      logoFileId: texteOuNull(donnees, "logoFileId"),
    })
  })
}

export async function poserLogoAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() =>
    poserLogo(texte(donnees, "assignmentId"), {
      poseLe: texte(donnees, "poseLe"),
      photoPoseFileId: texteOuNull(donnees, "photoPoseFileId"),
    }),
  )
}

// Retrait du logo, et annulation d'une réservation : le même retrait.
export async function retirerLogoAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => retirerLogo(texte(donnees, "assignmentId")))
}
