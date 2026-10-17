"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export interface EntreePlus {
  libelle: string
  // Une entrée sans app existante reste visible, désactivée, avec sa raison en clair.
  desactivee: boolean
  raison?: string
  // Entrée active : elle mène à cette page.
  href?: string
}

const CLASSE_DECLENCHEUR = "cible-tactile items-center justify-center rounded-md bg-marque text-marque-texte hover:opacity-90"

// Menu « + » : les entrées sont déjà filtrées par les droits du membre (dans le layout).
// Sur PC (md et plus) : menu déroulant à droite. Sur téléphone : tiroir qui monte du bas, aux
// cibles tactiles de 44 px. Un seul des deux déclencheurs est visible à la fois.
export function BoutonPlus({ entrees, className }: { entrees: EntreePlus[]; className?: string }) {
  const [tiroirOuvert, setTiroirOuvert] = useState(false)
  if (entrees.length === 0) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Ajouter"
          className={`${CLASSE_DECLENCHEUR} hidden md:flex ${className ?? ""}`}
        >
          <Plus className="h-6 w-6" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-64 border-bordure bg-surface text-texte">
          <DropdownMenuLabel className="text-texte-discret">Ajouter</DropdownMenuLabel>
          {entrees.map((entree) =>
            entree.href && !entree.desactivee ? (
              <DropdownMenuItem key={entree.libelle} asChild className="cursor-pointer py-2">
                <Link href={entree.href} className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">{entree.libelle}</span>
                </Link>
              </DropdownMenuItem>
            ) : (
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
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        aria-label="Ajouter"
        onClick={() => setTiroirOuvert(true)}
        className={`${CLASSE_DECLENCHEUR} flex md:hidden ${className ?? ""}`}
      >
        <Plus className="h-6 w-6" aria-hidden />
      </button>
      <Sheet open={tiroirOuvert} onOpenChange={setTiroirOuvert}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto border-bordure bg-surface text-texte">
          <SheetHeader>
            <SheetTitle className="text-left text-texte-discret">Ajouter</SheetTitle>
          </SheetHeader>
          <ul className="mt-3 flex flex-col">
            {entrees.map((entree) => (
              <li key={entree.libelle}>
                {entree.href && !entree.desactivee ? (
                  <Link
                    href={entree.href}
                    onClick={() => setTiroirOuvert(false)}
                    className="flex min-h-11 flex-col items-start justify-center gap-0.5 rounded-md px-3 py-2 hover:bg-fond"
                  >
                    <span className="font-medium">{entree.libelle}</span>
                  </Link>
                ) : (
                  <div
                    aria-disabled="true"
                    className="flex min-h-11 flex-col items-start justify-center gap-0.5 px-3 py-2 opacity-60"
                  >
                    <span className="font-medium">{entree.libelle}</span>
                    {entree.desactivee && entree.raison && (
                      <span className="text-xs text-texte-discret">{entree.raison}</span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  )
}
