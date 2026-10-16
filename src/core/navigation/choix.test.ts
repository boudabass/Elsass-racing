import { describe, expect, it } from "vitest"

import { modeNavigation } from "./choix"

describe("mode de navigation", () => {
  it("navigue côté client quand le réseau est là", () => {
    expect(modeNavigation(true)).toBe("client")
  })

  it("navigue par page quand le réseau manque, pour que le service worker serve la copie", () => {
    expect(modeNavigation(false)).toBe("page")
  })
})
