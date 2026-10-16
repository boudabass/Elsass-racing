// Curseur de synchro : position opaque dans une table, « updated_at puis id » de la dernière ligne
// reçue. Encodé en base64url pour que le client ne l'interprète pas.

import { z } from "zod"

export interface PositionCurseur {
  date: string
  id: string
}

const schemaPosition = z.object({ d: z.string().datetime(), i: z.string().uuid() })

export function encoderCurseur(position: PositionCurseur): string {
  return Buffer.from(JSON.stringify({ d: position.date, i: position.id }), "utf8").toString("base64url")
}

// Curseur absent ou illisible : on repart du début. Repartir du début ne perd rien, la synchro
// renvoie tout, et les lignes déjà reçues sont simplement remises à jour.
export function decoderCurseur(curseur: string | null | undefined): PositionCurseur | null {
  if (!curseur) return null
  try {
    const brut = JSON.parse(Buffer.from(curseur, "base64url").toString("utf8")) as unknown
    const analyse = schemaPosition.safeParse(brut)
    return analyse.success ? { date: analyse.data.d, id: analyse.data.i } : null
  } catch {
    return null
  }
}
