"use client"

import { useRouter } from "next/navigation"

// Option « Voir seulement les écarts » (cochée par défaut) : elle recharge la comparaison avec le paramètre `ecarts`.
export function FiltreEcarts({ a, b, seulsEcarts }: { a: string; b: string; seulsEcarts: boolean }) {
  const router = useRouter()
  return (
    <label className="cible-tactile flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        defaultChecked={seulsEcarts}
        onChange={(evenement) => router.push(`?a=${a}&b=${b}&ecarts=${evenement.target.checked ? "1" : "0"}`)}
        className="h-5 w-5"
      />
      Voir seulement les écarts
    </label>
  )
}
