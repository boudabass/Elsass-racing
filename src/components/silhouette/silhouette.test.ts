import { describe, expect, it } from "vitest"

import { elementsDessines, estFilet } from "./silhouette"
import type { ElementDessin } from "./types"

const filet: ElementDessin = { type: "line", role: "detail", attributs: { x1: 90, y1: 84, x2: 256, y2: 84, "stroke-width": 4 } }
const detailFin: ElementDessin = { type: "line", role: "detail", attributs: { x1: 110, y1: 66, x2: 260, y2: 66, "stroke-width": 1.5 } }
const caisse: ElementDessin = { type: "path", role: "caisse", attributs: { d: "M0 0 L10 10", "stroke-width": 4 } }

describe("filet rouge de la silhouette", () => {
  it("un trait « detail » d'épaisseur 4 ou plus est le filet", () => {
    expect(estFilet(filet)).toBe(true)
  })

  it("un détail fin, et un trait épais d'un autre rôle, ne sont pas le filet", () => {
    expect(estFilet(detailFin)).toBe(false)
    expect(estFilet(caisse)).toBe(false)
  })

  it("le filet n'est pas dessiné : les autres traits le sont, dans le même ordre", () => {
    expect(elementsDessines([detailFin, filet, caisse])).toEqual([detailFin, caisse])
  })

  it("une liste sans filet passe telle quelle", () => {
    expect(elementsDessines([caisse, detailFin])).toEqual([caisse, detailFin])
  })
})
