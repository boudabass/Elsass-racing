"use client"

import type { ReactNode } from "react"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

// Panneau de la boîte d'actions : à droite sur PC, pleine largeur sur téléphone.
// Le contenu est rendu côté serveur (BoiteActions) et passé en enfant.
export function ConteneurBoite({ declencheur, children }: { declencheur: ReactNode; children: ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>{declencheur}</SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto border-bordure bg-fond p-0 text-texte sm:max-w-md">
        <SheetHeader className="border-b border-bordure px-4 py-4 text-left">
          <SheetTitle className="titre-rallye text-2xl">Boîte d'actions</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
