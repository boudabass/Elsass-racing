// Logo de la team. Pas encore de fichier logo (core_file arrive plus tard) : les initiales
// du nom, dans un carré à la couleur d'accent de la team.

import { initialesTeam } from "@/core/theme/initiales"

export function Logo({ nom, taille = "md" }: { nom: string; taille?: "md" | "lg" }) {
  const dimension = taille === "lg" ? "h-14 w-14 text-2xl" : "h-10 w-10 text-lg"
  return (
    <span
      aria-hidden
      className={`titre-rallye flex shrink-0 items-center justify-center rounded-md bg-marque font-bold text-marque-texte ${dimension}`}
    >
      {initialesTeam(nom)}
    </span>
  )
}
