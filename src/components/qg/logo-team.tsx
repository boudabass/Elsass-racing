"use client"

import { useState } from "react"
import { House } from "lucide-react"

// Logo de la team (brief 3.1, section 3.1) : l'image, ou l'icône QG si elle ne charge pas (hors ligne, par
// exemple : /api/ n'est pas en cache). Sans logo, c'est toujours l'icône QG.
export function LogoTeam({ logoFileId, className = "h-8 w-8" }: { logoFileId: string | null; className?: string }) {
  // Mémorise l'échec pour un identifiant : un nouveau logo repart de l'image.
  const [echecPour, setEchecPour] = useState<string | null>(null)

  if (!logoFileId || echecPour === logoFileId) return <House className="h-5 w-5" aria-hidden />
  return (
    <img
      src={`/api/fichiers/${logoFileId}`}
      alt=""
      className={`${className} rounded object-contain`}
      onError={() => setEchecPour(logoFileId)}
    />
  )
}
