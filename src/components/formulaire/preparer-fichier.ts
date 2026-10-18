// Préparation d'un fichier avant l'envoi (brief 3.1, section 2). Une photo trop lourde ou trop grande est
// redessinée à 2 000 px au plus sur le grand côté, puis exportée en JPEG à 0,85. Les PDF et les SVG partent tels quels.
// Ce fichier ne sert que dans le navigateur (canvas).

const SEUIL_OCTETS = 1.5 * 1024 * 1024
const COTE_MAX = 2000
const QUALITE_JPEG = 0.85
const TYPES_PHOTO = ["image/jpeg", "image/png", "image/webp"]

export async function preparerFichier(fichier: File): Promise<File> {
  if (!TYPES_PHOTO.includes(fichier.type)) return fichier

  let image: ImageBitmap
  try {
    image = await createImageBitmap(fichier)
  } catch {
    return fichier
  }

  const { width, height } = image
  if (fichier.size <= SEUIL_OCTETS && Math.max(width, height) <= COTE_MAX) {
    image.close()
    return fichier
  }

  const echelle = Math.min(1, COTE_MAX / Math.max(width, height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(width * echelle)
  canvas.height = Math.round(height * echelle)
  const contexte = canvas.getContext("2d")
  if (!contexte) {
    image.close()
    return fichier
  }
  // Fond blanc : un PNG transparent devient un JPEG lisible.
  contexte.fillStyle = "#ffffff"
  contexte.fillRect(0, 0, canvas.width, canvas.height)
  contexte.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITE_JPEG))
  if (!blob) return fichier
  const nom = `${fichier.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`
  return new File([blob], nom, { type: "image/jpeg" })
}
