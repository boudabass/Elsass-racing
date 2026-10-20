// Contexte système (brief 3.8, point 0.3) : fabrication, garde d'utilisateur, et livraison aux seuls gestionnaires
// qui l'acceptent. Pur : la base est testée par les scripts de vérification et par l'e2e.
import { describe, expect, it } from "vitest"

import { contexteSysteme, ORIGINES_SYSTEME } from "../contexte-systeme-serveur"
import { estContexteTeam, type ContexteTeam } from "../contexte"

import { enregistrerGestionnaire, enregistrerGestionnaireTousContextes, trouverEnregistrement, trouverGestionnaire } from "./gestionnaires"

const ctxTeam: ContexteTeam = { teamId: "t-1", userId: "u-1", membership: { id: "m-1", role: "responsable" } }

describe("contexteSysteme", () => {
  it("ne fabrique un contexte que pour une origine connue, sans utilisateur ni adhésion", () => {
    const ctx = contexteSysteme("t-1", "page_partenaire")
    expect(ctx).toEqual({ teamId: "t-1", origine: "page_partenaire", systeme: true })
    expect("userId" in ctx).toBe(false)
    expect("membership" in ctx).toBe(false)
  })

  it("refuse une origine inconnue", () => {
    expect(() => contexteSysteme("t-1", "autre" as never)).toThrow("Origine système inconnue")
    expect(ORIGINES_SYSTEME).toEqual(["page_partenaire"])
  })
})

describe("estContexteTeam", () => {
  it("reconnaît un contexte d'utilisateur, et distingue le contexte système", () => {
    expect(estContexteTeam(ctxTeam)).toBe(true)
    expect(estContexteTeam(contexteSysteme("t-1", "page_partenaire"))).toBe(false)
  })
})

describe("registre des gestionnaires : contextes acceptés", () => {
  const fn = async () => {}

  it("un gestionnaire d'utilisateur n'est pas livré à un contexte système", () => {
    enregistrerGestionnaire("app-test", "app-test.utilisateur", fn)
    const enregistrement = trouverEnregistrement("app-test", "app-test.utilisateur")
    expect(enregistrement?.tousContextes).toBe(false)
  })

  it("un gestionnaire « tous contextes » est livré aux deux", () => {
    enregistrerGestionnaireTousContextes("app-test", "app-test.partout", fn)
    const enregistrement = trouverEnregistrement("app-test", "app-test.partout")
    expect(enregistrement?.tousContextes).toBe(true)
    expect(trouverGestionnaire("app-test", "app-test.partout")).toBe(fn)
  })
})
