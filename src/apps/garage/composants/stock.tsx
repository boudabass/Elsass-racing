// Stock du Garage (tâche 4.2, §3) : les pièces de rechange de la voiture choisie, groupées par organe. Les pièces
// identiques ne font qu'une ligne, avec leur quantité ; chacune reste ouvrable. Usées, cassées et vendues sont dans un
// filtre à part, jamais mêlées au stock disponible. Aucun prix ici, à aucun niveau.

import Link from "next/link"

import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import { BOUTON_SECONDAIRE, LIEN } from "@/lib/classes-formulaire"

import { LIBELLE_QUALITE, LIBELLE_STATUT_PIECE } from "../libelles"
import { regrouperStock, type GroupeOrgane, type PieceStock } from "../mise-en-forme"

import { ChoixVehicule } from "./atelier"
import { FormulairePiece } from "./formulaires-stock"

export type FiltreStock = "stock" | "hors"

// Le stock disponible : en stock et en révision. Le reste (usées, cassées, vendues) est le filtre « hors stock ».
const STATUTS_DISPONIBLES = ["en_stock", "en_revision"]
const STATUTS_HORS_STOCK = ["usee", "cassee", "vendue"]

export function pieceVisible(piece: PieceStock, filtre: FiltreStock): boolean {
  return (filtre === "hors" ? STATUTS_HORS_STOCK : STATUTS_DISPONIBLES).includes(piece.statut)
}

const libelleQualite = (qualite: string) => LIBELLE_QUALITE[qualite as keyof typeof LIBELLE_QUALITE] ?? qualite

function Groupes({ organes }: { organes: GroupeOrgane[] }) {
  return (
    <ul className="flex flex-col gap-8">
      {organes.map((organe) => (
        <li key={organe.componentTypeId} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{organe.organeNom}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {organe.groupes.map((groupe) => (
              <li key={groupe.cle} className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{groupe.designation}</p>
                    <p className="text-sm text-texte-discret">
                      {[groupe.marque, groupe.reference, libelleQualite(groupe.qualite)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {groupe.pieces.length > 1 && <span className="chiffre shrink-0 text-lg font-semibold">×{groupe.pieces.length}</span>}
                </div>
                <ul className="flex flex-col">
                  {groupe.pieces.map((piece) => (
                    <li key={piece.id}>
                      <Link href={`/apps/garage/pieces/${piece.id}`} className={`${LIEN} py-1`}>
                        {[LIBELLE_STATUT_PIECE[piece.statut as keyof typeof LIBELLE_STATUT_PIECE], piece.emplacement].filter(Boolean).join(" · ")}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

export interface StockEcranProps {
  vehicules: Array<{ id: string; nomCourt: string }>
  choisi: { id: string; nomCourt: string }
  filtre: FiltreStock
  pieces: PieceStock[]
  organes: Array<{ componentTypeId: string; nom: string }>
  niveau: Niveau
  // Présents seulement au niveau écriture.
  fournisseurs?: Array<{ id: string; nom: string }>
}

export function StockEcran({ vehicules, choisi, filtre, pieces, organes, niveau, fournisseurs }: StockEcranProps) {
  const peutEcrire = aAuMoins(niveau, "ecriture")
  const groupes = regrouperStock(pieces.filter((piece) => pieceVisible(piece, filtre)))
  const lien = (cible: FiltreStock) => `/apps/garage/stock?vehicule=${choisi.id}${cible === "hors" ? "&filtre=hors" : ""}`

  return (
    <section className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">Stock</h1>
        {vehicules.length > 1 && <ChoixVehicule vehicules={vehicules} choisi={choisi.id} chemin="/apps/garage/stock" />}
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filtre du stock" className="flex flex-wrap gap-2">
          <Link
            href={lien("stock")}
            aria-current={filtre === "stock" ? "page" : undefined}
            className={`cible-tactile inline-flex items-center rounded-md border px-4 ${filtre === "stock" ? "border-texte bg-surface-2 font-semibold" : "border-bordure"}`}
          >
            En stock
          </Link>
          <Link
            href={lien("hors")}
            aria-current={filtre === "hors" ? "page" : undefined}
            className={`cible-tactile inline-flex items-center rounded-md border px-4 ${filtre === "hors" ? "border-texte bg-surface-2 font-semibold" : "border-bordure"}`}
          >
            Usées, cassées, vendues
          </Link>
        </nav>

        {peutEcrire ? (
          <FormulairePiece vehicleId={choisi.id} organes={organes} fournisseurs={fournisseurs} />
        ) : (
          <div className="flex flex-col items-start gap-2">
            <button type="button" disabled className={`${BOUTON_SECONDAIRE} opacity-60`}>
              Ajouter une pièce
            </button>
            <p className="text-sm text-texte-discret">Seul l&apos;équipage peut ajouter une pièce.</p>
          </div>
        )}
      </div>

      {groupes.length === 0 ? (
        <p className="text-texte-discret">
          {filtre === "hors" ? "Aucune pièce usée, cassée ou vendue pour cette voiture." : "Aucune pièce de rechange en stock pour cette voiture."}
        </p>
      ) : (
        <Groupes organes={groupes} />
      )}
    </section>
  )
}
