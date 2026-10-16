import Link from "next/link"

// Page servie par le service worker quand une page n'est pas en cache et qu'il n'y a pas de réseau.
// Publique (hors espace connecté) : elle ne lit aucune donnée.
export default function PageHorsLigne() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-fond px-6 text-center text-texte">
      <h1 className="titre-rallye text-3xl">Pas de réseau</h1>
      <p className="max-w-sm text-lg text-texte-discret">Les données déjà synchronisées restent disponibles dans le QG.</p>
      <Link href="/qg" className="cible-tactile rounded-md bg-marque px-5 py-2 font-medium text-white hover:opacity-90">
        Retour au QG
      </Link>
    </main>
  )
}
