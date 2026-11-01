// Objets de Garage lus par Check-lists (tâche 5.7a, 956 §4) : un organe et un train de pneus. Pure : les données viennent
// des lectures de lectures-partagees.ts, déjà contrôlées par team.
import type { ObjetLieLu } from "@/apps/checklist/objets-types"

import { nomAvecPosition } from "./emplacements"
import { libelleZone } from "./mise-en-forme"

type ZoneOrgane = Parameters<typeof libelleZone>[0]

export function objetOrgane(
  organe: { id: string; nom: string; position: string | null; zone: ZoneOrgane; pieceMontee: boolean },
  vehicleId: string,
): ObjetLieLu {
  return {
    type: "organe_garage",
    id: organe.id,
    libelle: nomAvecPosition(organe.nom, organe.position),
    etat: organe.pieceMontee ? libelleZone(organe.zone) : "Aucune pièce montée",
    alerte: organe.pieceMontee && organe.zone === "rouge",
    vehicleId,
    personId: null,
  }
}

export function objetTrain(train: { id: string; marque: string; modele: string | null; nombreEpreuves: number }, vehicleId: string): ObjetLieLu {
  return {
    type: "train_pneus",
    id: train.id,
    libelle: [train.marque, train.modele].filter((morceau) => morceau && morceau.trim() !== "").join(" "),
    etat: train.nombreEpreuves <= 1 ? `${train.nombreEpreuves} épreuve` : `${train.nombreEpreuves} épreuves`,
    alerte: false,
    vehicleId,
    personId: null,
  }
}
