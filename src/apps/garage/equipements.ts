// Règles pures des équipements de la team (tâche 4.6, 954 v1.4 §2 et §3). Sans accès base : les services sont dans
// equipements-serveur.ts, les lectures dans lectures-equipements-serveur.ts. Aucune règle automatique : un contrôle
// dépassé ou proche ne déclenche rien (ni événement, ni action, ni Prochaine étape). L'écran le dit, c'est tout.

import { jourCivil } from "./commandes"

export const CATEGORIES_EQUIPEMENT = ["remorque", "outillage", "levage", "assistance", "stand"] as const
export type CategorieEquipement = (typeof CATEGORIES_EQUIPEMENT)[number]

export function categorieValide(valeur: string): valeur is CategorieEquipement {
  return (CATEGORIES_EQUIPEMENT as readonly string[]).includes(valeur)
}

// Un contrôle à moins de ce nombre de jours est « bientôt » (brief 4.6, §3).
export const SEUIL_CONTROLE_JOURS = 30

export const NOM_MAX = 120
export const ETAT_MAX = 200
export const EMPLACEMENT_MAX = 120

// Plus grand entier de la colonne valeur_cents (INTEGER, 32 bits).
const VALEUR_MAX_CENTIMES = 2_147_483_647

export type Echeance = { etat: "aucun" } | { etat: "depasse" | "bientot" | "plus_tard"; jours: number }

// Date civile « AAAA-MM-JJ », valide au calendrier. Renvoie la date telle quelle, ou null.
export function dateCivileValide(texte: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) return null
  const date = new Date(`${texte}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== texte ? null : texte
}

// Échéance du contrôle, en jours civils entiers depuis le jour de Paris (aujourdhui). Les dates sont des dates civiles :
// le changement d'heure du 25/10 ne décale rien.
export function echeanceControle(prochainControleLe: string | null, aujourdhui: string): Echeance {
  if (prochainControleLe === null) return { etat: "aucun" }
  const jours = jourCivil(prochainControleLe) - jourCivil(aujourdhui)
  if (jours < 0) return { etat: "depasse", jours: -jours }
  if (jours < SEUIL_CONTROLE_JOURS) return { etat: "bientot", jours }
  return { etat: "plus_tard", jours }
}

function libelleJours(nombre: number): string {
  return `${nombre} ${nombre === 1 ? "jour" : "jours"}`
}

// Ce que dit l'écran de l'échéance, en clair.
export function libelleEcheance(echeance: Echeance): string {
  if (echeance.etat === "aucun") return "Aucun contrôle prévu"
  if (echeance.etat === "depasse") return `Contrôle dépassé depuis ${libelleJours(echeance.jours)}`
  if (echeance.etat === "bientot" && echeance.jours === 0) return "Contrôle aujourd'hui"
  return `Contrôle dans ${libelleJours(echeance.jours)}`
}

// Mot qui accompagne l'icône quand le contrôle demande l'attention : jamais la couleur seule.
export const LIBELLE_ALERTE_ECHEANCE = { depasse: "Dépassé", bientot: "Bientôt" } as const

export function alerteEcheance(echeance: Echeance): keyof typeof LIBELLE_ALERTE_ECHEANCE | null {
  if (echeance.etat === "depasse" || echeance.etat === "bientot") return echeance.etat
  return null
}

// Montant saisi en euros (« 12,50 », « 12 », « 1 200,50 ») : des centimes entiers. Vide devient null ; un montant négatif
// ou illisible est refusé avec sa raison.
export const MESSAGE_VALEUR = "La valeur est un montant en euros, positif, par exemple 1 200,50."

export function valeurEnCentimes(saisie: string | null | undefined): { valeurCents: number | null } | { erreur: string } {
  if (!saisie || saisie.trim() === "") return { valeurCents: null }
  const normalise = saisie.replace(/\s/g, "").replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(normalise)) return { erreur: MESSAGE_VALEUR }
  const centimes = Math.round(Number(normalise) * 100)
  if (centimes > VALEUR_MAX_CENTIMES) return { erreur: "La valeur est trop grande pour être enregistrée." }
  return { valeurCents: centimes }
}

// Saisie brute du formulaire (chaînes, vides ou absentes). La validation la rend propre ou dit pourquoi elle est refusée.
export interface SaisieBrute {
  nom?: string | null
  categorie?: string | null
  etat?: string | null
  acheteLe?: string | null
  valeur?: string | null
  prochainControleLe?: string | null
  emplacement?: string | null
}

export interface SaisieEquipement {
  nom: string
  categorie: CategorieEquipement
  etat: string | null
  // Date civile « AAAA-MM-JJ » ; la couche service la range à minuit UTC.
  acheteLe: string | null
  valeurCents: number | null
  prochainControleLe: string | null
  emplacement: string | null
}

const nettoye = (valeur: string | null | undefined): string | null => valeur?.trim() || null

export function validerSaisieEquipement(brute: SaisieBrute): { saisie: SaisieEquipement } | { erreur: string } {
  const nom = nettoye(brute.nom)
  if (nom === null) return { erreur: "Indique le nom de l'équipement." }
  if (nom.length > NOM_MAX) return { erreur: `Le nom tient en ${NOM_MAX} caractères au plus.` }

  if (!brute.categorie || !categorieValide(brute.categorie)) {
    return { erreur: "Choisis la catégorie de l'équipement." }
  }

  const etat = nettoye(brute.etat)
  if (etat !== null && etat.length > ETAT_MAX) return { erreur: `L'état tient en ${ETAT_MAX} caractères au plus.` }

  const emplacement = nettoye(brute.emplacement)
  if (emplacement !== null && emplacement.length > EMPLACEMENT_MAX) {
    return { erreur: `L'emplacement tient en ${EMPLACEMENT_MAX} caractères au plus.` }
  }

  const dateAchat = nettoye(brute.acheteLe)
  const acheteLe = dateAchat === null ? null : dateCivileValide(dateAchat)
  if (dateAchat !== null && acheteLe === null) return { erreur: "La date d'achat n'est pas une date valide." }

  const dateControle = nettoye(brute.prochainControleLe)
  const prochainControleLe = dateControle === null ? null : dateCivileValide(dateControle)
  if (dateControle !== null && prochainControleLe === null) {
    return { erreur: "La date du prochain contrôle n'est pas une date valide." }
  }

  const valeur = valeurEnCentimes(brute.valeur)
  if ("erreur" in valeur) return { erreur: valeur.erreur }

  return {
    saisie: {
      nom,
      categorie: brute.categorie,
      etat,
      acheteLe,
      valeurCents: valeur.valeurCents,
      prochainControleLe,
      emplacement,
    },
  }
}

// Valeur affichée : « 1 200,50 € ». Espaces ordinaires pour les milliers, pour un rendu identique partout.
export function formaterValeur(centimes: number): string {
  const euros = Math.floor(centimes / 100)
  const cents = String(centimes % 100).padStart(2, "0")
  return `${String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${cents} €`
}

// En tête de l'écran : nombre d'équipements, contrôles dépassés, contrôles proches, valeur totale (niveau écriture seulement).
export interface ResumeEquipements {
  nombre: number
  depasses: number
  bientot: number
  valeurTotaleCents: number
}

export function resumeEquipements(
  equipements: Array<{ valeurCents: number | null; prochainControleLe: string | null }>,
  aujourdhui: string,
): ResumeEquipements {
  const echeances = equipements.map((equipement) => echeanceControle(equipement.prochainControleLe, aujourdhui))
  return {
    nombre: equipements.length,
    depasses: echeances.filter((echeance) => echeance.etat === "depasse").length,
    bientot: echeances.filter((echeance) => echeance.etat === "bientot").length,
    valeurTotaleCents: equipements.reduce((total, equipement) => total + (equipement.valeurCents ?? 0), 0),
  }
}

// Regroupe par catégorie, dans l'ordre de la liste de référence ; une catégorie vide n'apparaît pas. Nom en ordre alphabétique.
export function groupesParCategorie<T extends { categorie: CategorieEquipement; nom: string }>(
  equipements: T[],
): Array<{ categorie: CategorieEquipement; equipements: T[] }> {
  return CATEGORIES_EQUIPEMENT.map((categorie) => ({
    categorie,
    equipements: equipements
      .filter((equipement) => equipement.categorie === categorie)
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
  })).filter((groupe) => groupe.equipements.length > 0)
}
