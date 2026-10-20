// Polices du PDF : Barlow (texte) et Barlow Condensed (titres), les polices de l'app (brief 3.1b, section 2).
// Enregistrées une seule fois, au chargement du module. Le chemin part de process.cwd() : `public/` est
// lisible par `next start` et copié dans l'image Docker.
import path from "node:path"

import { Font } from "@react-pdf/renderer"

const DOSSIER = path.join(process.cwd(), "public", "polices-pdf")

Font.register({
  family: "Barlow",
  fonts: [
    { src: path.join(DOSSIER, "Barlow-Regular.ttf"), fontWeight: 400 },
    { src: path.join(DOSSIER, "Barlow-SemiBold.ttf"), fontWeight: 600 },
  ],
})

Font.register({
  family: "Barlow Condensed",
  fonts: [{ src: path.join(DOSSIER, "BarlowCondensed-Bold.ttf"), fontWeight: 700 }],
})

// Pas de coupure de mot au milieu : les tableaux restent lisibles.
Font.registerHyphenationCallback((mot) => [mot])
