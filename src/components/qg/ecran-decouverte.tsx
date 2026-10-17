import { Sparkles } from "lucide-react"

import { marquerAppDecouverte } from "@/apps/settings/actions-personnelles"

// Première ouverture d'une app : trois lignes sur ce qu'elle fait, et un seul bouton pour
// commencer. Le bouton mémorise l'écran pour ce membre.
export function EcranDecouverte({ appCle, nom, lignes }: { appCle: string; nom: string; lignes: string[] }) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-start gap-6 py-12">
      <span className="flex h-14 w-14 items-center justify-center rounded-md bg-surface text-marque">
        <Sparkles className="h-7 w-7" aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">{nom}</h1>
      </div>
      <ul className="flex flex-col gap-2 text-lg">
        {lignes.map((ligne) => (
          <li key={ligne}>{ligne}</li>
        ))}
      </ul>
      <form action={marquerAppDecouverte}>
        <input type="hidden" name="appCle" value={appCle} />
        <button type="submit" className="cible-tactile rounded-md bg-marque px-5 py-3 font-medium text-marque-texte hover:opacity-90">
          Commencer
        </button>
      </form>
    </section>
  )
}
