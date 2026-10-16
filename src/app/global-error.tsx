"use client"

import { useEffect, useState } from "react"

import { journaliserErreur } from "@/core/erreurs/client"

// Dernier filet : une erreur hors de l'espace connecté, ou dans la racine. Remplace la page entière,
// donc tout le style est en ligne, et le texte est en français.
export default function ErreurGlobale({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const [horsLigne, setHorsLigne] = useState(false)

  useEffect(() => {
    void journaliserErreur(error)
    setHorsLigne(!navigator.onLine)
  }, [error])

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          background: "#0b0b0c",
          color: "#f4f4f5",
          fontFamily: "sans-serif",
        }}
      >
        <h1 style={{ fontSize: 28, margin: 0 }}>Quelque chose s&apos;est mal passé.</h1>
        <p style={{ color: "#a1a1aa", margin: 0 }}>Réessaie. Si ça revient, préviens le responsable de la team.</p>
        {horsLigne && <p style={{ color: "#fb923c", margin: 0 }}>Tu es hors ligne : certaines pages ne sont pas disponibles sans réseau.</p>}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ background: "#d7141a", color: "#fff", border: 0, borderRadius: 6, padding: "10px 20px", fontSize: 16 }}
          >
            Recharger
          </button>
          <a href="/qg" style={{ color: "#f4f4f5", border: "1px solid #2a2a30", borderRadius: 6, padding: "10px 20px", textDecoration: "none" }}>
            Retour au QG
          </a>
        </div>
      </body>
    </html>
  )
}
