import { describe, expect, it } from "vitest"

import { decoderCurseur, encoderCurseur } from "./curseur"

describe("curseur de synchro", () => {
  const position = { date: "2026-10-16T10:00:00.000Z", id: "0196f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f" }

  it("relit ce qu'il a écrit", () => {
    expect(decoderCurseur(encoderCurseur(position))).toEqual(position)
  })

  it("est opaque : pas de date lisible dans la valeur", () => {
    expect(encoderCurseur(position)).not.toContain("2026")
  })

  it("repart du début pour un curseur absent ou illisible", () => {
    expect(decoderCurseur(null)).toBeNull()
    expect(decoderCurseur("")).toBeNull()
    expect(decoderCurseur("pas-un-curseur")).toBeNull()
    expect(decoderCurseur(Buffer.from('{"d":"pas une date","i":"x"}').toString("base64url"))).toBeNull()
  })
})
