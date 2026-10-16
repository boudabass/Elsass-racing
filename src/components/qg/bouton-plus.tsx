"use client"

import { Plus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface EntreePlus {
  libelle: string
  // Une entrée sans app existante reste visible, désactivée, avec sa raison en clair.
  desactivee: boolean
  raison?: string
}

// Menu « + » : les entrées sont déjà filtrées par les droits du membre (dans le layout).
export function BoutonPlus({ entrees, className }: { entrees: EntreePlus[]; className?: string }) {
  if (entrees.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Ajouter"
        className={`cible-tactile flex items-center justify-center rounded-md bg-marque text-white hover:opacity-90 ${className ?? ""}`}
      >
        <Plus className="h-6 w-6" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-64 border-bordure bg-surface text-texte">
        <DropdownMenuLabel className="text-texte-discret">Ajouter</DropdownMenuLabel>
        {entrees.map((entree) => (
          <DropdownMenuItem
            key={entree.libelle}
            disabled={entree.desactivee}
            className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
          >
            <span className="font-medium">{entree.libelle}</span>
            {entree.desactivee && entree.raison && (
              <span className="text-xs text-texte-discret">{entree.raison}</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
