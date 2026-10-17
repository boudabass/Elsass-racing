import Link from "next/link"
import type { LucideIcon } from "lucide-react"

// Écran générique pour une page sans contenu : une icône, un titre, trois lignes au plus,
// un seul bouton.
export function EcranVide({
  icone: Icone,
  titre,
  lignes,
  action,
}: {
  icone: LucideIcon
  titre: string
  lignes: string[]
  action?: { libelle: string; href: string }
}) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-marque">
        <Icone className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="titre-rallye text-3xl">{titre}</h1>
      <div className="flex flex-col gap-1 text-texte-discret">
        {lignes.slice(0, 3).map((ligne) => (
          <p key={ligne}>{ligne}</p>
        ))}
      </div>
      {action && (
        <Link
          href={action.href}
          className="cible-tactile mt-2 inline-flex items-center rounded-md bg-marque px-5 py-2 font-medium text-marque-texte hover:opacity-90"
        >
          {action.libelle}
        </Link>
      )}
    </section>
  )
}
