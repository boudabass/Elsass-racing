// Règles pures de Documents (tâche 5.3, brief section 3). Aucun accès à la base : les services et les lectures passent
// les valeurs déjà lues, ces fonctions renvoient une décision, testée dans regles.test.ts.
//
// Visibilité : un dossier invisible cache ses documents, sauf pour l'assistance (niveau contribution), qui ne voit que
// les siens et ceux qui lui sont ouverts. Un accès interne (documents_access) ouvre le document à la personne, mais
// pas un dossier caché aux membres du niveau lecture ou écriture.

import { jourDeParis } from "@/core/dates"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"

export type Zone = "vert" | "orange" | "rouge"
export type Visibilite = "team" | "gestion" | "prive"
export type NiveauAcces = "lecture" | "contribution"

export type TypeDocument =
  | "statuts"
  | "recepisse_rna"
  | "pv_ag"
  | "reglement_ffsa"
  | "reglement_particulier"
  | "modele"
  | "assurance_asso"
  | "attestation"
  | "autre"

// ─── Zones d'échéance ────────────────────────────────────────────────────────

// Bornes en jours civils (heure de Paris). Orange de 60 à 8 jours compris ; rouge à 7 jours et moins, expiré compris.
export const JOURS_ORANGE = 60
export const JOURS_ROUGE = 7

// Nombre de jours civils entre aujourd'hui (Paris) et la date de validité. Négatif si la date est passée.
// Les dates sont des colonnes DATE : Prisma les rend à minuit UTC, ce qui donne le jour civil sans décalage.
export function joursAvantEcheance(valableJusquAu: Date, maintenant: Date): number {
  const aujourdhui = Date.parse(`${jourDeParis(maintenant)}T00:00:00Z`)
  const echeance = Date.parse(`${valableJusquAu.toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((echeance - aujourdhui) / 86_400_000)
}

// Zone d'un document. Sans date de validité : pas de zone (null).
export function zoneDocument(valableJusquAu: Date | null, maintenant: Date): Zone | null {
  if (valableJusquAu === null) return null
  const jours = joursAvantEcheance(valableJusquAu, maintenant)
  if (jours <= JOURS_ROUGE) return "rouge"
  if (jours <= JOURS_ORANGE) return "orange"
  return "vert"
}

const GRAVITE_ZONE: Record<Zone, number> = { vert: 0, orange: 1, rouge: 2 }

// Pire zone d'un ensemble (la pastille d'un dossier). Les zones absentes (null) ne comptent pas.
export function pireZone(zones: ReadonlyArray<Zone | null>): Zone | null {
  let pire: Zone | null = null
  for (const zone of zones) {
    if (zone === null) continue
    if (pire === null || GRAVITE_ZONE[zone] > GRAVITE_ZONE[pire]) pire = zone
  }
  return pire
}

// Texte qui accompagne la zone : un état ne se dit jamais par la couleur seule.
export function texteEcheance(valableJusquAu: Date | null, maintenant: Date): string {
  if (valableJusquAu === null) return "Sans échéance"
  const jours = joursAvantEcheance(valableJusquAu, maintenant)
  if (jours < 0) return "Expiré"
  if (jours > JOURS_ORANGE) return "À jour"
  if (jours === 0) return "Expire aujourd'hui"
  return `Expire dans ${jours} jour${jours > 1 ? "s" : ""}`
}

// ─── Dossiers types (957, §1) ────────────────────────────────────────────────

export interface DossierType {
  nom: string
  // Types attendus pour la jauge de complétude. Vide : pas de jauge (la carte affiche seulement le nombre de documents).
  typesAttendus: readonly TypeDocument[]
}

// Constante unique : la base reprend ces nombres dans documents_folder.expected_count (complétude, brief §1).
export const DOSSIERS_TYPES: readonly DossierType[] = [
  { nom: "Association", typesAttendus: ["statuts", "recepisse_rna", "pv_ag"] },
  { nom: "Assurances", typesAttendus: ["assurance_asso"] },
  { nom: "Règlements", typesAttendus: ["reglement_ffsa"] },
  { nom: "Rallyes archivés", typesAttendus: [] },
  { nom: "Modèles", typesAttendus: [] },
  { nom: "Attestations", typesAttendus: [] },
  { nom: "Divers", typesAttendus: [] },
]

// Nombre attendu pour la jauge d'un dossier type, null sans jauge.
export function nombreAttenduDossierType(dossier: DossierType): number | null {
  return dossier.typesAttendus.length > 0 ? dossier.typesAttendus.length : null
}

export interface DocumentPourCompletude {
  docType: TypeDocument
  // « actif » seulement : un document archivé ne compte pas.
  status: "actif" | "archive"
  valableJusquAu: Date | null
}

// Jauge : un type attendu compte s'il a au moins un document actif et non expiré à ce jour. Deux documents du même
// type comptent une fois.
export function completude(
  typesAttendus: readonly TypeDocument[],
  documents: readonly DocumentPourCompletude[],
  maintenant: Date,
): { presents: number; attendus: number } {
  const presents = typesAttendus.filter((type) =>
    documents.some(
      (document) =>
        document.docType === type &&
        document.status === "actif" &&
        (document.valableJusquAu === null || joursAvantEcheance(document.valableJusquAu, maintenant) >= 0),
    ),
  ).length
  return { presents, attendus: typesAttendus.length }
}

// ─── Versions ────────────────────────────────────────────────────────────────

// Numéro de la version suivante : à partir de 1, croissant par document. Les numéros existants sont ceux de la base,
// archivés compris (une version ne se retire jamais).
export function numeroVersionSuivant(numerosExistants: readonly number[]): number {
  return numerosExistants.length === 0 ? 1 : Math.max(...numerosExistants) + 1
}

// ─── Visibilité et droits ────────────────────────────────────────────────────

// La personne qui agit : son identifiant de fiche et son niveau d'accès à Documents (core_app_access ou défaut du rôle).
// Un compte sans fiche personne a personId null : il ne possède rien, mais peut agir selon son niveau.
export interface QuiAgit {
  personId: string | null
  niveau: Niveau
}

export interface DossierPourDroits {
  ownerPersonId: string | null
  visibility: Visibilite
}

export interface DocumentPourDroits {
  ownerPersonId: string | null
  visibility: Visibilite
  // Niveau de l'accès interne actif pour la personne qui agit, null sans accès.
  accesPersonne: NiveauAcces | null
}

export type Decision = { permis: true } | { permis: false; raison: string }

const OUI: Decision = { permis: true }
const non = (raison: string): Decision => ({ permis: false, raison })

const estProprietaire = (ownerPersonId: string | null, qui: QuiAgit): boolean => ownerPersonId !== null && ownerPersonId === qui.personId

// Un dossier : le niveau gestion voit tout ; les autres voient les dossiers « team », et ceux dont ils sont propriétaires.
// La visibilité « gestion » et « prive » d'un dossier se lisent de la même façon : gestion et propriétaire.
export function peutVoirDossier(dossier: DossierPourDroits, qui: QuiAgit): boolean {
  if (!aAuMoins(qui.niveau, "lecture")) return false
  if (aAuMoins(qui.niveau, "gestion")) return true
  if (estProprietaire(dossier.ownerPersonId, qui)) return true
  return dossier.visibility === "team"
}

// Un document. Validé par l'orchestrateur (28/10) : c'est la plus stricte des deux visibilités, dossier et document,
// qui décide. Dans l'ordre :
// - le niveau gestion voit tout ;
// - le dossier doit être visible (un dossier invisible cache ses documents, l'assistance comprise) ;
// - l'assistance (contribution) ne voit ensuite que les documents dont elle est propriétaire et ceux qui lui sont
//   ouverts, quelle que soit la visibilité du document ;
// - les membres au niveau lecture ou écriture : « team » pour tout le monde ; « gestion » pour le propriétaire seul ;
//   « prive » pour le propriétaire et les personnes ouvertes.
export function peutVoirDocument(document: DocumentPourDroits, dossier: DossierPourDroits, qui: QuiAgit): boolean {
  if (!aAuMoins(qui.niveau, "lecture")) return false
  if (aAuMoins(qui.niveau, "gestion")) return true
  if (!peutVoirDossier(dossier, qui)) return false

  const proprietaire = estProprietaire(document.ownerPersonId, qui)
  if (qui.niveau === "contribution") return proprietaire || document.accesPersonne !== null
  if (document.visibility === "team") return true
  if (proprietaire) return true
  return document.visibility === "prive" && document.accesPersonne !== null
}

// Nom affiché pour un auteur (uploaded_by, granted_by) : la fiche personne quand elle existe, sinon le nom du compte.
// Un compte sans fiche n'est jamais bloqué : les champs d'auteur peuvent rester vides, l'écran affiche alors ce repli.
export function libelleAuteur(personne: string | null, compte: string | null): string {
  return personne ?? compte ?? "Un membre"
}

// Modifier les champs d'un document et ajouter une version. Le niveau écriture ou gestion modifie tout document qu'il
// voit. L'assistance ne modifie que les siens, ou ceux qui lui sont ouverts en contribution.
export function peutModifierDocument(document: DocumentPourDroits, dossier: DossierPourDroits, qui: QuiAgit): Decision {
  if (!peutVoirDocument(document, dossier, qui)) return non("Tu ne vois pas ce document.")
  if (!aAuMoins(qui.niveau, "contribution")) return non("Ton niveau d'accès ne permet que la lecture du coffre-fort.")
  if (qui.niveau === "contribution") {
    if (estProprietaire(document.ownerPersonId, qui) || document.accesPersonne === "contribution") return OUI
    return non("Ce document ne t'appartient pas et ne t'est pas ouvert en contribution.")
  }
  return OUI
}

// Ajouter un document (avec ou sans fichier) : l'assistance ajoute les siens.
export function peutAjouterDocument(qui: QuiAgit): Decision {
  if (!aAuMoins(qui.niveau, "contribution")) return non("Ton niveau d'accès ne permet que la lecture du coffre-fort.")
  return OUI
}

// Créer un dossier, le renommer ou le supprimer : niveau écriture seulement.
export function peutGererDossier(qui: QuiAgit): Decision {
  if (aAuMoins(qui.niveau, "ecriture")) return OUI
  return non("Tu ne peux pas gérer les dossiers : ajoute tes documents dans un dossier existant.")
}

// Archiver, déplacer et partager : niveau écriture, et document modifiable. L'assistance n'a aucun de ces gestes.
function peutAgirSurDocument(document: DocumentPourDroits, dossier: DossierPourDroits, qui: QuiAgit, geste: string): Decision {
  if (qui.niveau === "contribution") return non(`L'assistance ne peut pas ${geste} un document.`)
  return peutModifierDocument(document, dossier, qui)
}

export function peutArchiverDocument(document: DocumentPourDroits, dossier: DossierPourDroits, qui: QuiAgit): Decision {
  return peutAgirSurDocument(document, dossier, qui, "archiver")
}

export function peutDeplacerDocument(document: DocumentPourDroits, dossier: DossierPourDroits, qui: QuiAgit): Decision {
  return peutAgirSurDocument(document, dossier, qui, "déplacer")
}

export function peutPartagerDocument(document: DocumentPourDroits, dossier: DossierPourDroits, qui: QuiAgit): Decision {
  return peutAgirSurDocument(document, dossier, qui, "partager")
}
