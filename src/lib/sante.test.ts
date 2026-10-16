import { describe, expect, it } from "vitest"

import { decider } from "./sante-decision"

describe("decider (santé)", () => {
  it("répond ok quand les trois étapes passent", () => {
    expect(decider({ base: true, droits: true, catalogue: true })).toEqual({ ok: true })
  })

  it("donne la raison de la première étape en échec", () => {
    expect(decider({ base: false, droits: false, catalogue: false })).toEqual({ ok: false, raison: "base injoignable" })
    expect(decider({ base: true, droits: false, catalogue: false })).toEqual({
      ok: false,
      raison: "droits du rôle de l'app incomplets",
    })
    expect(decider({ base: true, droits: true, catalogue: false })).toEqual({ ok: false, raison: "catalogue des apps absent" })
  })
})
