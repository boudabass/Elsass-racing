// Tirage : pour chaque table synchronisable lisible par le membre, les lignes de la team modifiées
// après le curseur, par paquets, suppressions douces comprises.

import { perimetreLecture } from "./contribution"
import { niveauDe } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { newId } from "@/core/ids"
import { prisma, prismaPourTeam } from "@/lib/prisma"

import { decoderCurseur, encoderCurseur } from "./curseur"
import { LIMITE_PAQUET, type LigneSynchro } from "./protocole"
import { toutesLesDeclarations } from "./registre"

export interface PaquetTable {
  lignes: LigneSynchro[]
  curseur: string | null
  // Vrai si le paquet est plein : il reste des lignes à tirer.
  suite: boolean
}

export interface ReponseTirage {
  tables: Record<string, PaquetTable>
  horodatage: string
}

export async function tirerPaquets(ctx: ContexteTeam, curseurs: Record<string, string | null>): Promise<ReponseTirage> {
  const tables: Record<string, PaquetTable> = {}

  for (const declaration of toutesLesDeclarations()) {
    const niveau = await niveauDe(ctx, declaration.app)
    const perimetre = perimetreLecture(niveau, declaration.niveauLecture)
    if (perimetre === "aucun") continue

    const curseurRecu = curseurs[declaration.cle] ?? null
    const lignes = await declaration.lirePaquet(
      prismaPourTeam(ctx.teamId, ctx.userId),
      ctx.teamId,
      decoderCurseur(curseurRecu),
      LIMITE_PAQUET,
      perimetre === "ses_lignes" ? ctx.userId : null,
    )

    const derniere = lignes[lignes.length - 1]
    tables[declaration.cle] = {
      lignes,
      curseur: derniere ? encoderCurseur({ date: derniere.updatedAt, id: derniere.id }) : curseurRecu,
      suite: lignes.length === LIMITE_PAQUET,
    }
  }

  return { tables, horodatage: new Date().toISOString() }
}

// Mémorise la synchro de cet appareil : sa dernière synchro, et les curseurs reçus.
export async function memoriserSynchro(ctx: ContexteTeam, deviceId: string, tables: Record<string, PaquetTable>): Promise<void> {
  const maintenant = new Date()
  await prisma.coreDevice.updateMany({
    where: { id: deviceId, userId: ctx.userId },
    data: { derniereSyncAt: maintenant },
  })

  const curseurs = JSON.stringify(Object.fromEntries(Object.entries(tables).map(([cle, paquet]) => [cle, paquet.curseur])))
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const existant = await client.coreSyncCursor.findFirst({ where: { teamId: ctx.teamId, deviceId }, select: { id: true } })
  if (existant) {
    await client.coreSyncCursor.update({ where: { id: existant.id }, data: { curseur: curseurs, derniereSyncAt: maintenant } })
  } else {
    await client.coreSyncCursor.create({
      data: { id: newId(), teamId: ctx.teamId, deviceId, curseur: curseurs, derniereSyncAt: maintenant },
    })
  }
}
