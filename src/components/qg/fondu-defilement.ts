import { useEffect, useState, type CSSProperties, type RefObject } from "react"

// Bords cachés d'une rangée qui défile horizontalement : gauche, droite.
export interface EtatFondu {
  gauche: boolean
  droite: boolean
}

const AUCUN: EtatFondu = { gauche: false, droite: false }

// Mesure le défilement d'un conteneur : un bord est « cachant » s'il reste du contenu hors de la vue.
export function useFonduDefilement(ref: RefObject<HTMLElement | null>): EtatFondu {
  const [etat, setEtat] = useState<EtatFondu>(AUCUN)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    function mesurer() {
      const gauche = element!.scrollLeft > 1
      const droite = element!.scrollLeft + element!.clientWidth < element!.scrollWidth - 1
      setEtat((precedent) => (precedent.gauche === gauche && precedent.droite === droite ? precedent : { gauche, droite }))
    }
    mesurer()
    element.addEventListener("scroll", mesurer, { passive: true })
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(element)
    return () => {
      element.removeEventListener("scroll", mesurer)
      observateur.disconnect()
    }
  }, [ref])

  return etat
}

// Fondu (mask-image) sur le seul bord où du contenu est caché. Sans contenu caché : aucun style.
export function styleFondu({ gauche, droite }: EtatFondu): CSSProperties | undefined {
  if (!gauche && !droite) return undefined
  const debut = gauche ? "transparent, #000 2rem" : "#000 0"
  const fin = droite ? "#000 calc(100% - 2rem), transparent" : "#000 100%"
  const degrade = `linear-gradient(to right, ${debut}, ${fin})`
  return { maskImage: degrade, WebkitMaskImage: degrade }
}
