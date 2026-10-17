"use client"

import { useState } from "react"
import { House } from "lucide-react"

import { variablesDeTeam } from "@/core/theme/variables"

// Deux sélecteurs de couleur et un aperçu en direct : une barre haute et une tuile, calculées
// avec le contraste de la team (variablesDeTeam). Les sélecteurs restent dans le formulaire.
export function ApercuCouleurs({
  couleurPrincipale,
  couleurSecondaire,
  nomTeam,
  disabled,
}: {
  couleurPrincipale: string
  couleurSecondaire: string
  nomTeam: string
  disabled: boolean
}) {
  const [principale, setPrincipale] = useState(couleurPrincipale)
  const [secondaire, setSecondaire] = useState(couleurSecondaire)
  const variables = variablesDeTeam({ couleurPrincipale: principale, couleurSecondaire: secondaire })

  const styleSombre = { ...variables, "--marque": variables["--marque-sombre"] } as React.CSSProperties
  const styleClair = { ...variables, "--marque": variables["--marque-clair"] } as React.CSSProperties

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="couleurPrincipale" className="text-sm font-medium">Couleur principale</label>
          <input
            id="couleurPrincipale"
            name="couleurPrincipale"
            type="color"
            value={principale}
            onChange={(e) => setPrincipale(e.target.value)}
            disabled={disabled}
            className="cible-tactile h-11 w-full rounded-md border border-bordure bg-surface"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="couleurSecondaire" className="text-sm font-medium">Couleur secondaire</label>
          <input
            id="couleurSecondaire"
            name="couleurSecondaire"
            type="color"
            value={secondaire}
            onChange={(e) => setSecondaire(e.target.value)}
            disabled={disabled}
            className="cible-tactile h-11 w-full rounded-md border border-bordure bg-surface"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div style={styleSombre} className="rounded-lg bg-[#0B0B0C] p-3 text-[#F4F4F5]">
          <p className="mb-2 text-xs text-[#A1A1AA]">Thème sombre</p>
          <div className="flex items-center gap-2 rounded-md bg-[#151518] px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-marque-texte" style={{ background: "var(--marque)" }}>
              <House className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-sm">{nomTeam}</span>
          </div>
          <div className="mt-2 rounded-lg border border-[#2A2A30] bg-[#151518] p-3">
            <span className="block h-2 w-10 rounded-full" style={{ background: "var(--marque)" }} />
            <p className="mt-2 text-sm">Tuile d'exemple</p>
          </div>
        </div>
        <div style={styleClair} className="rounded-lg bg-white p-3 text-[#111113]">
          <p className="mb-2 text-xs text-[#52525B]">Thème clair</p>
          <div className="flex items-center gap-2 rounded-md bg-[#F4F4F5] px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-marque-texte" style={{ background: "var(--marque)" }}>
              <House className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-sm">{nomTeam}</span>
          </div>
          <div className="mt-2 rounded-lg border border-[#D4D4D8] bg-[#F4F4F5] p-3">
            <span className="block h-2 w-10 rounded-full" style={{ background: "var(--marque)" }} />
            <p className="mt-2 text-sm">Tuile d'exemple</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-texte-discret">
        Les couleurs sont ajustées automatiquement si elles sont trop proches du fond, pour rester lisibles.
      </p>
    </div>
  )
}
