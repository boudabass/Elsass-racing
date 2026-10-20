"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { journaliserRafraichissement } from "@/lib/diagnostic-rafraichissement"

// Panneau de la boîte d'actions : à droite sur PC, pleine largeur sur téléphone.
// Le contenu est rendu côté serveur (BoiteActions) et passé en enfant.
// Paramètre d'URL « boite=<id> » : le panneau s'ouvre, et la liste fait défiler jusqu'à l'action. Seule l'instance « écoute » lit le paramètre (il y a deux
// instances sur téléphone : la barre haute et la barre basse).
export function ConteneurBoite({
  declencheur,
  children,
  ecouteUrl = false,
}: {
  declencheur: ReactNode
  children: ReactNode
  ecouteUrl?: boolean
}) {
  const parametres = useSearchParams()
  const chemin = usePathname()
  const router = useRouter()
  const cible = ecouteUrl ? parametres.get("boite") : null
  const [ouvert, setOuvert] = useState(false)

  useEffect(() => {
    if (cible) setOuvert(true)
  }, [cible])

  // À l'ouverture, le contenu serveur (actions, compteur) se relit : une synchro faite pendant que le
  // panneau était fermé n'a pas pu rafraîchir la boîte.
  useEffect(() => {
    if (ouvert) {
      journaliserRafraichissement("boite-ouverture")
      router.refresh()
    }
  }, [ouvert, router])

  // Le panneau est monté à l'ouverture : on attend une image avant de chercher l'action.
  useEffect(() => {
    if (!ouvert || !cible) return
    const image = window.requestAnimationFrame(() => {
      const action = document.getElementById(`action-${cible}`)
      if (!action) return
      action.scrollIntoView({ block: "center" })
    })
    return () => window.cancelAnimationFrame(image)
  }, [ouvert, cible])

  function changerOuverture(valeur: boolean) {
    setOuvert(valeur)
    // Fermé : on retire le paramètre, pour qu'une réouverture ne rejoue pas l'action ciblée.
    // Retrait du paramètre : seul l'historique change, sans requête (utilisable hors ligne).
    if (!valeur && cible) window.history.replaceState(null, "", chemin)
  }

  return (
    <Sheet open={ouvert} onOpenChange={changerOuverture}>
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
