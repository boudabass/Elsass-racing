// Diagnostic de test (tâche 4.3, point 2 de la relecture) : journalise chaque router.refresh() du QG, avec son origine
// et le chemin courant, pour retrouver l'émetteur d'un rafraîchissement qui part pendant une navigation. Actif seulement
// dans le build de test (NEXT_PUBLIC_E2E=1, posé par playwright.config.ts) : ailleurs la condition est fausse et le code
// ne fait rien. Une fois la cause trouvée, ce fichier et ses appels partent.
export function journaliserRafraichissement(origine: string): void {
  if (process.env.NEXT_PUBLIC_E2E !== "1") return
  const pile = (new Error().stack ?? "").split("\n").slice(2, 4).map((ligne) => ligne.trim()).join(" <- ")
  console.log(`REFRESH_DIAG origine=${origine} chemin=${window.location.pathname} t=${Date.now()} pile=${pile}`)
}
