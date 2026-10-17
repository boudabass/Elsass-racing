import { basculerTerrainAction, refuserBandeauTerrainAction } from "@/core/actions/formulaires"

// Proposition de passer en mode terrain le jour d'une épreuve. Refusable pour la journée.
// Affiché seulement si une épreuve de la team est en cours aujourd'hui, et pas déjà refusée.
export function BandeauTerrain({ epreuve }: { epreuve: string }) {
  return (
    <aside
      role="region"
      aria-label="Mode terrain"
      className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-xl flex-col gap-3 rounded-lg border border-marque bg-surface px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between md:bottom-6"
    >
      <p className="text-sm">
        <span className="font-semibold">Jour d'épreuve</span> : {epreuve}. Passer en mode terrain ?
      </p>
      <div className="flex gap-2">
        <form action={basculerTerrainAction}>
          <input type="hidden" name="actif" value="1" />
          <button type="submit" className="cible-tactile rounded-md bg-marque px-4 py-2 text-sm font-medium text-marque-texte hover:opacity-90">
            Passer en mode terrain
          </button>
        </form>
        <form action={refuserBandeauTerrainAction}>
          <button type="submit" className="cible-tactile rounded-md border border-bordure px-4 py-2 text-sm hover:bg-surface-2">
            Plus tard
          </button>
        </form>
      </div>
    </aside>
  )
}
