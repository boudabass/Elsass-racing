import { describe, expect, it, vi } from "vitest"

import { avertirAvantSortie, type EvenementAvantSortie } from "./avertissement-sortie"

function evenementFactice(): EvenementAvantSortie & { preventDefault: ReturnType<typeof vi.fn> } {
  return { preventDefault: vi.fn(), returnValue: undefined }
}

describe("avertissement de sortie pendant un envoi (brief 4.7)", () => {
  it("demande confirmation tant qu'un envoi est en cours", () => {
    const evenement = evenementFactice()
    avertirAvantSortie(evenement, true)
    expect(evenement.preventDefault).toHaveBeenCalledOnce()
    expect(evenement.returnValue).toBe("Un envoi est en cours.")
  })

  it("ne fait rien hors envoi : la page se quitte sans question", () => {
    const evenement = evenementFactice()
    avertirAvantSortie(evenement, false)
    expect(evenement.preventDefault).not.toHaveBeenCalled()
    expect(evenement.returnValue).toBeUndefined()
  })
})
