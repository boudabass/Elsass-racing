"use client"

// Désaccord volontaire : le serveur ne rend pas le paragraphe, le client le rend. Sert à vérifier que la capture des
// messages d'hydratation reçoit bien un cas connu (voir docs/tests.md, section 418).
export function Controle() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-medium">Contrôle d'hydratation</h1>
      {typeof window !== "undefined" && <p>Élément présent seulement côté client</p>}
    </div>
  )
}
