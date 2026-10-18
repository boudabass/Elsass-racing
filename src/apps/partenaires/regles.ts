// Règles pures de Partenaires (brief 3.5, point 4) : aucune lecture de base, aucune date du jour
// cachée. Les dates sont des jours civils « AAAA-MM-JJ » (Europe/Paris), passés par l'appelant.

import { createHash, randomBytes } from "node:crypto"

export type StatutConvention = "brouillon" | "envoyee" | "signee" | "en_cours" | "terminee" | "resiliee"
export type ActionConvention = "envoyer" | "signer" | "resilier"
export type StatutPartenaire =
  | "a_contacter"
  | "contacte"
  | "relance"
  | "interesse"
  | "partenaire"
  | "ancien_partenaire"
  | "refus"
export type StatutContrepartie = "a_faire" | "en_cours" | "tenue" | "reportee"

export type TransitionConvention = { ok: true; statut: StatutConvention } | { ok: false; message: string }

const LIBELLE_STATUT: Record<StatutConvention, string> = {
  brouillon: "au brouillon",
  envoyee: "envoyée",
  signee: "signée",
  en_cours: "en cours",
  terminee: "terminée",
  resiliee: "résiliée",
}

// Tableau du point 1 : les passages à la main. Les passages automatiques sont dans statutAutomatique.
const TRANSITIONS: Record<ActionConvention, { de: StatutConvention[]; vers: StatutConvention; refus: string }> = {
  envoyer: { de: ["brouillon"], vers: "envoyee", refus: "Seule une convention au brouillon peut être envoyée." },
  signer: { de: ["envoyee"], vers: "signee", refus: "Seule une convention envoyée peut être signée." },
  resilier: { de: ["signee", "en_cours"], vers: "resiliee", refus: "Seule une convention signée ou en cours peut être résiliée." },
}

export function transitionConvention(statut: StatutConvention, action: ActionConvention): TransitionConvention {
  const regle = TRANSITIONS[action]
  if (!regle.de.includes(statut)) {
    return { ok: false, message: `${regle.refus} Celle-ci est ${LIBELLE_STATUT[statut]}.` }
  }
  return { ok: true, statut: regle.vers }
}

export interface ConventionPourStatut {
  statut: StatutConvention
  dateDebut: string
  dateFin: string
}

// Passages automatiques : signée → en cours le jour de date_debut ; en cours → terminée le lendemain de date_fin.
// Les deux peuvent s'enchaîner si le recalcul arrive après les deux dates.
export function statutAutomatique(convention: ConventionPourStatut, aujourdhui: string): StatutConvention {
  let statut = convention.statut
  if (statut === "signee" && aujourdhui >= convention.dateDebut) statut = "en_cours"
  if (statut === "en_cours" && aujourdhui > convention.dateFin) statut = "terminee"
  return statut
}

// Jour civil de Paris d'un instant, au format AAAA-MM-JJ.
export function jourParis(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant)
}

// ---------------------------------------------------------------------------
// Montants : en chiffres, puis en lettres entre parenthèses.
// ---------------------------------------------------------------------------

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
]
const DIZAINES: Record<number, string> = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" }

function sousCent(n: number): string {
  if (n < 20) return UNITES[n]
  if (n < 70) {
    const base = DIZAINES[Math.floor(n / 10)]
    const unite = n % 10
    if (unite === 0) return base
    if (unite === 1) return `${base} et un`
    return `${base}-${UNITES[unite]}`
  }
  if (n < 80) {
    const reste = n - 60
    return reste === 11 ? "soixante et onze" : `soixante-${UNITES[reste]}`
  }
  const reste = n - 80
  return reste === 0 ? "quatre-vingts" : `quatre-vingt-${UNITES[reste]}`
}

function sousMille(n: number): string {
  const centaines = Math.floor(n / 100)
  const reste = n % 100
  if (centaines === 0) return sousCent(reste)
  const tete = centaines === 1 ? "cent" : `${UNITES[centaines]} ${reste === 0 ? "cents" : "cent"}`
  return reste === 0 ? tete : `${tete} ${sousCent(reste)}`
}

function entier(n: number): string {
  if (n === 0) return "zéro"
  const millions = Math.floor(n / 1_000_000)
  const milliers = Math.floor((n % 1_000_000) / 1000)
  const reste = n % 1000
  const morceaux: string[] = []
  if (millions > 0) morceaux.push(millions === 1 ? "un million" : `${sousMille(millions)} millions`)
  if (milliers > 0) morceaux.push(milliers === 1 ? "mille" : `${sousMille(milliers)} mille`)
  if (reste > 0) morceaux.push(sousMille(reste))
  return morceaux.join(" ")
}

// Montant en centimes, écrit en français : « mille cinq cents euros et cinquante centimes ».
export function montantEnLettres(centimes: number): string {
  if (!Number.isInteger(centimes) || centimes < 0) throw new Error("Le montant doit être un entier positif en centimes.")
  const euros = Math.floor(centimes / 100)
  if (euros >= 1_000_000_000) throw new Error("Montant trop grand pour être écrit en lettres.")
  const cents = centimes % 100
  const centimesTexte = cents === 1 ? "un centime" : `${sousCent(cents)} centimes`

  if (euros === 0) return cents === 0 ? "zéro euro" : centimesTexte
  const mot = entier(euros)
  // « deux millions d'euros » : la préposition « de » s'élide devant une voyelle.
  const euroTexte =
    euros === 1 ? `${mot} euro` : euros >= 1_000_000 && euros % 1_000_000 === 0 ? `${mot} d'euros` : `${mot} euros`
  return cents === 0 ? euroTexte : `${euroTexte} et ${centimesTexte}`
}

// Montant en chiffres : 1500,5 € → « 1 500,50 € » ; le groupement des milliers est un espace.
function chiffres(centimes: number): string {
  const euros = Math.floor(centimes / 100)
  const cents = String(centimes % 100).padStart(2, "0")
  const groupes = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${groupes},${cents} €`
}

// Apport tel qu'il s'écrit dans la convention : « 1 500,00 € (mille cinq cents euros) », ou « aucun ».
export function formaterMontant(centimes: number): string {
  if (centimes === 0) return "aucun"
  return `${chiffres(centimes)} (${montantEnLettres(centimes)})`
}

// ---------------------------------------------------------------------------
// Modèle de convention : remplissage des champs {{…}}.
// ---------------------------------------------------------------------------

// Champs connus. Un champ connu sans valeur devient « ________ » ; un champ inconnu reste visible.
export const CHAMPS_CONNUS = [
  "team.nom",
  "team.forme_juridique",
  "team.rna",
  "team.adresse",
  "team.representant",
  "partenaire.entreprise",
  "partenaire.adresse",
  "partenaire.representant",
  "convention.apport_financier",
  "convention.apport_nature",
  "convention.echeancier",
  "convention.date_debut",
  "convention.date_fin",
  "convention.saison",
  "contreparties",
  "lieu",
  "date",
] as const

export interface ContrepartieModele {
  libelle: string
  quantite: number
  unite?: string | null
  emplacement?: string | null
  epreuves?: string[]
  echeance?: string | null
}

export type ValeurModele = string | null | undefined | ContrepartieModele[]

export interface ResultatModele {
  texte: string
  inconnus: string[]
}

const BLANC = "________"
const SEGMENT_RNA = "inscrite sous le numéro {{team.rna}}, "

function valeurVide(valeur: ValeurModele): boolean {
  if (valeur === null || valeur === undefined) return true
  if (Array.isArray(valeur)) return valeur.length === 0
  return valeur.trim() === ""
}

// « 2027-06-30 » → « 30/06/2027 ».
function dateFrancaise(jour: string): string {
  const [annee, mois, date] = jour.split("-")
  return `${date}/${mois}/${annee}`
}

function ligneContrepartie(c: ContrepartieModele): string {
  const morceaux = [`${c.libelle} : ${c.quantite}${c.unite ? ` ${c.unite}` : ""}`]
  if (c.emplacement) morceaux.push(`emplacement ${c.emplacement}`)
  if (c.epreuves && c.epreuves.length > 0) morceaux.push(`épreuves ${c.epreuves.join(", ")}`)
  if (c.echeance) morceaux.push(`échéance ${dateFrancaise(c.echeance)}`)
  return `- ${morceaux.join(" ; ")}`
}

export function remplirModele(texte: string, valeurs: Partial<Record<(typeof CHAMPS_CONNUS)[number], ValeurModele>>): ResultatModele {
  // Sans numéro au registre, la mention entière disparaît (une association de droit local n'en a pas toujours un).
  const sansRna = valeurVide(valeurs["team.rna"]) ? texte.split(SEGMENT_RNA).join("") : texte
  const inconnus = new Set<string>()
  const connus = new Set<string>(CHAMPS_CONNUS)

  const rempli = sansRna.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (complet: string, cle: string) => {
    if (!connus.has(cle)) {
      inconnus.add(cle)
      return complet
    }
    const champ = cle as (typeof CHAMPS_CONNUS)[number]
    const valeur = valeurs[champ]
    if (valeurVide(valeur)) return BLANC
    if (Array.isArray(valeur)) return valeur.map(ligneContrepartie).join("\n")
    return String(valeur)
  })

  return { texte: rempli, inconnus: Array.from(inconnus) }
}

// ---------------------------------------------------------------------------
// Contreparties, relances, jetons.
// ---------------------------------------------------------------------------

export interface ContrepartiePourRegles {
  statut: StatutContrepartie
  quantitePromise: number
  quantiteTenue: number
  echeance: string | null
}

// Tenue dès que la quantité promise est atteinte, même reportée. Une quantité qui redescend la remet en cours.
export function statutContrepartie(contrepartie: ContrepartiePourRegles): StatutContrepartie {
  if (contrepartie.quantiteTenue >= contrepartie.quantitePromise) return "tenue"
  if (contrepartie.statut === "reportee") return "reportee"
  if (contrepartie.statut === "tenue") return "en_cours"
  return contrepartie.statut
}

export function enRetard(contrepartie: ContrepartiePourRegles, aujourdhui: string): boolean {
  if (contrepartie.echeance === null) return false
  if (contrepartie.statut === "tenue" || contrepartie.statut === "reportee") return false
  return contrepartie.echeance < aujourdhui
}

export interface PartenairePourRelance {
  statut: StatutPartenaire
  prochaineRelance: string | null
}

const STATUTS_SANS_RELANCE: StatutPartenaire[] = ["partenaire", "ancien_partenaire", "refus"]

export function relanceDue(partenaire: PartenairePourRelance, aujourdhui: string): boolean {
  if (partenaire.prochaineRelance === null) return false
  if (STATUTS_SANS_RELANCE.includes(partenaire.statut)) return false
  return partenaire.prochaineRelance <= aujourdhui
}

// Jeton de la page partenaire : 32 octets aléatoires, en base64url (43 caractères).
export function genererJeton(): string {
  return randomBytes(32).toString("base64url")
}

// Empreinte stockée à la place du jeton : sha256 en hexadécimal.
export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex")
}
