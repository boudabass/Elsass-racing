import { expect, test } from "@playwright/test"

// Routes de déploiement : santé, et redirections sur une adresse absolue (jamais une origine
// vue par Next comme 0.0.0.0). Ici, en développement : l'origine de la requête est le port 3100.
test("api/sante répond 200 et ok quand la base répond", async ({ request }) => {
  const reponse = await request.get("/api/sante")
  expect(reponse.status()).toBe(200)
  expect(await reponse.json()).toEqual({ ok: true })
})

// En développement, Next peut ramener la redirection du middleware à un chemin relatif : on la
// résout donc sur l'origine publique. En production, elle est absolue (vérifié à part, en 3200).
test("sans session, /qg redirige vers /connexion sur l'origine publique", async ({ request }) => {
  const reponse = await request.get("/qg", { maxRedirects: 0 })
  expect(reponse.status()).toBe(307)
  expect(new URL(reponse.headers()["location"], "http://localhost:3100").toString()).toBe("http://localhost:3100/connexion")
})

test("un lien de connexion invalide renvoie vers /connexion, en adresse absolue", async ({ request }) => {
  const reponse = await request.get("/connexion/lien?t=invalide", { maxRedirects: 0 })
  expect(reponse.status()).toBe(303)
  expect(reponse.headers()["location"]).toBe("http://localhost:3100/connexion?erreur=lien")
})
