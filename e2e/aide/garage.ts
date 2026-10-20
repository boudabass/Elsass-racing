// Atelier de test du Garage (tâche 4.2) : une voiture Saxo avec ses organes suivis, une pièce montée sur la plupart,
// à des états variés, écrits directement en base comme les autres aides. La team et la voiture viennent de session.ts ;
// supprimerEquipe efface toutes les lignes de la team, donc rien à nettoyer ici.

import "./env"

import { Pool } from "pg"

import { TYPES_DEFAUT } from "../../src/apps/garage/types-defaut"
import { newId } from "../../src/core/ids"

import type { Equipe } from "./session"

let pool: Pool | null = null

function bd(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL
    if (!connectionString) throw new Error("DATABASE_URL_MIGRATION absente : les tests ne peuvent pas écrire l'atelier.")
    pool = new Pool({ connectionString, idleTimeoutMillis: 10_000, max: 2 })
  }
  return pool
}

// Organes de l'atelier de test, par clé de type. `ref` : durée de vie de référence de l'organe (km), `usure` : km de la
// pièce montée, `piece` : false pour un organe sans pièce. Les freins ont une pièce sans durée : « À renseigner ».
// Le mode « km » donne un état sans durée en épreuves ; le mode par défaut (« les deux ») attend les deux durées.
const ORGANES: Record<string, { position?: string; mode?: "km"; ref: number | null; usure: number; piece: boolean; designation?: string; marque?: string; reference?: string }> = {
  moteur: { mode: "km", ref: 150000, usure: 30000, piece: true, designation: "Moteur reconditionné", marque: "Renault", reference: "K7M" },
  boite: { mode: "km", ref: 120000, usure: 96000, piece: true, designation: "Boîte 5 vitesses", marque: "Renault", reference: "JB1" },
  embrayage: { mode: "km", ref: 60000, usure: 59000, piece: true, designation: "Kit d'embrayage", marque: "Valeo", reference: "826578" },
  transmissions: { ref: null, usure: 0, piece: false },
  freins: { position: "Avant droit", ref: null, usure: 0, piece: true, designation: "Disque et plaquettes", marque: "Brembo" },
  amortisseurs: { mode: "km", ref: 80000, usure: 8000, piece: true, designation: "Amortisseurs avant", marque: "Bilstein" },
  pneus: { ref: null, usure: 0, piece: false },
}

// Prépare l'atelier de la voiture : gabarit Saxo, les types de la team, un organe par type, une pièce montée sur les
// organes qui en ont une. Renvoie l'identifiant de chaque organe, par clé de type.
export async function preparerAtelierSaxo(equipe: Equipe, vehicleId: string): Promise<Record<string, string>> {
  const client = await bd().connect()
  const organes: Record<string, string> = {}
  try {
    await client.query("BEGIN")
    await client.query(
      `UPDATE voiture_vehicle SET gabarit_cle = 'citadine_3p_saxo', updated_at = now() WHERE team_id = $1 AND vehicle_id = $2`,
      [equipe.teamId, vehicleId],
    )

    for (const type of TYPES_DEFAUT) {
      const typeId = newId()
      await client.query(
        `INSERT INTO garage_component_type (id, team_id, nom, cle, icone, critique, ordre, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
        [typeId, equipe.teamId, type.nom, type.cle, type.icone, type.critique, type.ordre],
      )

      const organe = ORGANES[type.cle]
      const organeId = newId()
      organes[type.cle] = organeId
      await client.query(
        `INSERT INTO garage_vehicle_component
           (id, team_id, vehicle_id, component_type_id, position, mode_usure, duree_vie_reference_km, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
        [organeId, equipe.teamId, vehicleId, typeId, organe.position ?? null, organe.mode ?? "les_deux", organe.ref],
      )

      if (!organe.piece) continue
      const pieceId = newId()
      await client.query(
        `INSERT INTO garage_part
           (id, team_id, vehicle_id, component_type_id, designation, marque, reference, statut, km_cumules, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'montee', $8, now())`,
        [pieceId, equipe.teamId, vehicleId, typeId, organe.designation, organe.marque ?? null, organe.reference ?? null, organe.usure],
      )
      await client.query(
        `INSERT INTO garage_part_mount (id, team_id, part_id, vehicle_component_id, posee_le, km_pose, updated_at)
         VALUES ($1, $2, $3, $4, now(), 0, now())`,
        [newId(), equipe.teamId, pieceId, organeId],
      )
    }

    await client.query("COMMIT")
    return organes
  } catch (erreur) {
    await client.query("ROLLBACK")
    throw erreur
  } finally {
    client.release()
  }
}
