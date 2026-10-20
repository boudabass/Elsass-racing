// Mise en forme des pièces pour l'atelier (tâche 4.1, brief §6). Module pur, sans accès base : il est testé seul.
// Le prix n'entre dans l'objet qu'avec avecPrix (niveau écriture ou plus) : l'assistance n'en reçoit aucun.

import type { GaragePart } from "@/generated/prisma/client"

export type PieceAtelier = {
  id: string
  designation: string
  marque: string | null
  reference: string | null
  qualite: string
  statut: string
  kmCumules: number
  epreuvesCumulees: number
  // Prix : présent seulement pour un niveau écriture ou plus.
  prixCents?: number | null
}

export function versPiece(
  piece: Pick<GaragePart, "id" | "designation" | "marque" | "reference" | "qualite" | "statut" | "kmCumules" | "epreuvesCumulees" | "prixCents">,
  avecPrix: boolean,
): PieceAtelier {
  const base: PieceAtelier = {
    id: piece.id,
    designation: piece.designation,
    marque: piece.marque,
    reference: piece.reference,
    qualite: piece.qualite,
    statut: piece.statut,
    kmCumules: Number(piece.kmCumules),
    epreuvesCumulees: piece.epreuvesCumulees,
  }
  return avecPrix ? { ...base, prixCents: piece.prixCents } : base
}
