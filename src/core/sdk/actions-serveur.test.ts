import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ErreurAcces } from "@/core/droits/erreurs"

import { ErreurMetier, executer, journaliserErreurInattendue } from "./actions-serveur"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const MESSAGE_GENERIQUE = "L'enregistrement n'a pas pu être fait. Réessaie."

describe("executer : erreurs inattendues", () => {
  let journal: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    journal = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    journal.mockRestore()
  })

  it("journalise une erreur inattendue avec le chemin et la pile, sans la montrer", async () => {
    const resultat = await executer("/apps/partenaires", async () => {
      throw new Error("détail interne : colonne absente")
    })

    expect(resultat).toEqual({ ok: false, message: MESSAGE_GENERIQUE })
    expect(journal).toHaveBeenCalledTimes(1)
    const [texte] = journal.mock.calls[0]
    expect(texte).toContain("/apps/partenaires")
    expect(texte).toContain("détail interne : colonne absente")
    expect(texte).toContain("Error:")
    expect(resultat.ok ? "" : resultat.message).not.toContain("colonne absente")
  })

  it("ne journalise pas un refus métier", async () => {
    const resultat = await executer("/apps/partenaires", async () => {
      throw new ErreurMetier("Ce lien n'existe plus.")
    })

    expect(resultat).toEqual({ ok: false, message: "Ce lien n'existe plus." })
    expect(journal).not.toHaveBeenCalled()
  })

  it("ne journalise pas un refus d'accès", async () => {
    const acces = new ErreurAcces("niveau_insuffisant", "aucun", "ecriture", "partenaires")
    const resultat = await executer("/apps/partenaires", async () => {
      throw acces
    })

    expect(resultat.ok).toBe(false)
    expect(journal).not.toHaveBeenCalled()
  })

  it("journalise aussi une valeur qui n'est pas une erreur", () => {
    journaliserErreurInattendue("/apps/budget", "échec sans objet")
    expect(journal).toHaveBeenCalledWith(expect.stringContaining("échec sans objet"))
  })
})
