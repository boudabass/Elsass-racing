// Règles pures des fichiers (brief 3.1, section 1.1). Aucun accès base ni disque : importable partout.

import { aAuMoins, type Niveau } from "@/core/droits/niveaux"

export type TypeFichier = "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "image/svg+xml"

export const TAILLE_MAX = 10 * 1024 * 1024

export const MESSAGE_FORMATS = "Formats acceptés : photo (JPEG, PNG, WebP), PDF ou SVG."

const octetsDe = (texte: string) => Array.from(texte, (caractere) => caractere.charCodeAt(0))

function commence(debut: Uint8Array, signature: number[], decalage = 0): boolean {
  if (debut.length < decalage + signature.length) return false
  return signature.every((octet, i) => debut[decalage + i] === octet)
}

// Le type se lit dans le contenu, jamais dans le nom ni dans le type annoncé par le navigateur.
// Le SVG est du texte : il faut que le contenu commence par <?xml ou <svg (après espaces et BOM)
// et qu'il contienne <svg. Renvoie null pour tout le reste.
export function detecterType(debut: Uint8Array): TypeFichier | null {
  if (commence(debut, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (commence(debut, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
  if (commence(debut, octetsDe("RIFF")) && commence(debut, octetsDe("WEBP"), 8)) return "image/webp"
  if (commence(debut, octetsDe("%PDF-"))) return "application/pdf"

  let texte: string
  try {
    texte = new TextDecoder("utf-8", { fatal: true }).decode(debut)
  } catch {
    return null
  }
  const debutTexte = texte.trimStart()
  if ((debutTexte.startsWith("<?xml") || debutTexte.startsWith("<svg")) && texte.includes("<svg")) return "image/svg+xml"
  return null
}

// Chemin de stockage : team, année et mois de l'envoi, identifiant du fichier. Le nom d'origine n'y entre jamais.
export function cleStockage(teamId: string, fileId: string, date: Date): string {
  const annee = date.getUTCFullYear()
  const mois = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${teamId}/${annee}/${mois}/${fileId}`
}

// Nom d'origine, gardé pour l'affichage seulement : sans chemin, sans caractères de contrôle ni caractères
// interdits sur Windows, 120 caractères au plus.
export function nomPropre(nom: string): string {
  const dernierSegment = nom.split(/[\\/]/).pop() ?? ""
  const propre = Array.from(dernierSegment.replace(/[\u0000-\u001f\u007f\/\\:*?"<>|]/g, "").trim())
    .slice(0, 120)
    .join("")
  return propre === "" ? "fichier" : propre
}

export interface ParametresLecture {
  // La team du fichier est celle de la personne (le RLS et la requête le garantissent aussi).
  estDansLaTeam: boolean
  // Apps des rattachements du fichier : vide quand il n'est rattaché à rien.
  applis: string[]
  // Niveau effectif de la personne, par app. Une app absente vaut « aucun ».
  niveaux: Partial<Record<string, Niveau>>
  // Le fichier est le logo courant de la team.
  estLogoTeam: boolean
  // La personne a envoyé le fichier (aperçu juste après l'envoi).
  estAuteur: boolean
}

// Règle de lecture (brief 1.3). Avec des rattachements : au moins « lecture » sur une de leurs apps.
// Sans rattachement : seulement le logo de la team, ou l'auteur. Tout refus donne 404 côté route.
export function peutLire(p: ParametresLecture): boolean {
  if (!p.estDansLaTeam) return false
  if (p.applis.length > 0) return p.applis.some((app) => aAuMoins(p.niveaux[app] ?? "aucun", "lecture"))
  return p.estLogoTeam || p.estAuteur
}
