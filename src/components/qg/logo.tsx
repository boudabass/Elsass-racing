// Logo de la team. Pas encore de fichier logo (core_file arrive plus tard) : les initiales
// du nom, dans un carré à la couleur d'accent de la team.

export function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  const lettres = mots.slice(0, 2).map((mot) => mot[0]?.toUpperCase() ?? "")
  return lettres.join("") || "ER"
}

export function Logo({ nom, taille = "md" }: { nom: string; taille?: "md" | "lg" }) {
  const dimension = taille === "lg" ? "h-14 w-14 text-2xl" : "h-10 w-10 text-lg"
  return (
    <span
      aria-hidden
      className={`titre-rallye flex shrink-0 items-center justify-center rounded-md bg-marque font-bold text-white ${dimension}`}
    >
      {initiales(nom)}
    </span>
  )
}
