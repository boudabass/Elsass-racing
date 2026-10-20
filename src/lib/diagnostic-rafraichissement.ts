// Diagnostic de test (tâche 4.3, point 2 de la relecture) : journalise les rafraîchissements du QG pour retrouver leur
// émetteur. Actif seulement dans le build de test (NEXT_PUBLIC_E2E=1, posé par playwright.config.ts) : ailleurs la
// condition est fausse et le code ne fait rien. Une fois la cause trouvée, ce fichier et ses appels partent.

export function journaliserRafraichissement(origine: string): void {
  if (process.env.NEXT_PUBLIC_E2E !== "1") return
  const pile = (new Error().stack ?? "").split("\n").slice(2, 4).map((ligne) => ligne.trim()).join(" <- ")
  console.log(`REFRESH_DIAG origine=${origine} chemin=${window.location.pathname} t=${Date.now()} pile=${pile}`)
}

// Chaque requête RSC (`_rsc=`) ou action serveur (`Next-Action`) part avec son URL, son chemin et sa pile d'appel.
let reseauInstalle = false

export function journaliserRequetesReseau(): void {
  if (process.env.NEXT_PUBLIC_E2E !== "1" || reseauInstalle) return
  reseauInstalle = true
  const fetchOriginal = window.fetch.bind(window)
  window.fetch = (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url
    const enTetes = new Headers(init?.headers ?? (entree instanceof Request ? entree.headers : undefined))
    const action = enTetes.get("next-action")
    if (url.includes("_rsc=") || action) {
      const pile = (new Error().stack ?? "").split("\n").slice(2, 5).map((ligne) => ligne.trim()).join(" <- ")
      const methode = init?.method ?? (entree instanceof Request ? entree.method : "GET")
      console.log(
        `REFRESH_DIAG reseau methode=${methode} url=${url.replace(window.location.origin, "")} action=${action ? "oui" : "non"} chemin=${window.location.pathname} t=${Date.now()} pile=${pile}`,
      )
    }
    return fetchOriginal(entree, init)
  }
}
