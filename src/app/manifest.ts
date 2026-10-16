import type { MetadataRoute } from "next"

// Manifeste de l'application installable (/manifest.webmanifest). Thème sombre, par défaut de l'app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elsass Racing",
    short_name: "Racing",
    description: "Plateforme de gestion de team",
    start_url: "/qg",
    display: "standalone",
    lang: "fr",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/icone-512-masquable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
