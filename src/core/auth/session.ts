// Jetons de session signés (JWT HS256), sans accès base : utilisable par le
// middleware (runtime edge). La révocation, elle, se vérifie côté serveur
// (cf. session-serveur.ts) en regardant si l'appareil existe encore.

// Sous-modules et non le point d'entrée « jose » : le point d'entrée tire le
// déchiffrement JWE, qui utilise une API Node absente du runtime edge du middleware.
import { SignJWT } from "jose/jwt/sign"
import { jwtVerify } from "jose/jwt/verify"

export const COOKIE_SESSION = "er_session"
export const COOKIE_TEAM = "er_team"
export const DUREE_SESSION_SECONDES = 30 * 24 * 60 * 60

export interface ContenuSession {
  userId: string
  deviceId: string
}

// Refuse de signer ou de vérifier sans secret solide : une clé vide ou courte ouvrirait
// la porte à quiconque sait deviner le secret.
function cleSecrete(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET absente ou trop courte (32 caractères minimum).")
  }
  return new TextEncoder().encode(secret)
}

export async function signerSession(contenu: ContenuSession): Promise<string> {
  return new SignJWT({ ...contenu, typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUREE_SESSION_SECONDES}s`)
    .sign(cleSecrete())
}

// Renvoie le contenu si la signature et le type sont bons, null sinon.
export async function verifierSession(jeton: string): Promise<ContenuSession | null> {
  try {
    const { payload } = await jwtVerify(jeton, cleSecrete(), { algorithms: ["HS256"] })
    if (payload.typ !== "session") return null
    if (typeof payload.userId !== "string" || typeof payload.deviceId !== "string") return null
    return { userId: payload.userId, deviceId: payload.deviceId }
  } catch {
    return null
  }
}

export async function signerTeam(teamId: string): Promise<string> {
  return new SignJWT({ teamId, typ: "team" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUREE_SESSION_SECONDES}s`)
    .sign(cleSecrete())
}

export async function verifierTeam(jeton: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(jeton, cleSecrete(), { algorithms: ["HS256"] })
    if (payload.typ !== "team" || typeof payload.teamId !== "string") return null
    return payload.teamId
  } catch {
    return null
  }
}
