import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { signerSession, signerTeam, verifierSession, verifierTeam } from "./session"

const SECRET_VALIDE = "un-secret-de-test-d-au-moins-trente-deux-caracteres"

describe("jetons de session", () => {
  let secretAvant: string | undefined

  beforeEach(() => {
    secretAvant = process.env.SESSION_SECRET
    process.env.SESSION_SECRET = SECRET_VALIDE
  })

  afterEach(() => {
    if (secretAvant === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = secretAvant
  })

  it("relit le contenu d'une session signée", async () => {
    const jeton = await signerSession({ userId: "u1", deviceId: "d1" })
    expect(await verifierSession(jeton)).toEqual({ userId: "u1", deviceId: "d1" })
  })

  it("refuse une session signée avec un autre secret", async () => {
    const jeton = await signerSession({ userId: "u1", deviceId: "d1" })
    process.env.SESSION_SECRET = "un-autre-secret-de-test-aussi-long-que-le-premier"
    expect(await verifierSession(jeton)).toBeNull()
  })

  it("refuse un jeton de team présenté comme session, et inversement", async () => {
    const jetonTeam = await signerTeam("team-1")
    const jetonSession = await signerSession({ userId: "u1", deviceId: "d1" })
    expect(await verifierSession(jetonTeam)).toBeNull()
    expect(await verifierTeam(jetonSession)).toBeNull()
  })

  it("relit la team d'un jeton de team", async () => {
    expect(await verifierTeam(await signerTeam("team-1"))).toBe("team-1")
  })

  it("refuse de signer si le secret est absent", async () => {
    delete process.env.SESSION_SECRET
    await expect(signerSession({ userId: "u1", deviceId: "d1" })).rejects.toThrow(/SESSION_SECRET/)
  })

  it("refuse un secret de moins de 32 caractères", async () => {
    process.env.SESSION_SECRET = "trop-court"
    await expect(signerSession({ userId: "u1", deviceId: "d1" })).rejects.toThrow(/32 caractères/)
  })

  it("renvoie null pour un jeton altéré", async () => {
    const jeton = await signerSession({ userId: "u1", deviceId: "d1" })
    expect(await verifierSession(jeton.slice(0, -2) + "xx")).toBeNull()
  })
})
