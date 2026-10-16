// Génère les icônes de l'application : fond rouge de la team, initiales « ER » dessinées en pixels.
// Aucune dépendance : un PNG est écrit à la main (zlib pour la compression, CRC-32 pour les blocs).
// Usage : pnpm exec tsx scripts/generer-icones.ts   (écrit dans public/icones/)
//
// Trois fichiers : 192 et 512 (coins vifs), et 512 « masquable » (lettres dans la zone sûre, fond
// plein, pour les masques ronds ou carrés d'Android).

import { deflateSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROUGE: [number, number, number] = [0xd7, 0x14, 0x1a]
const BLANC: [number, number, number] = [0xff, 0xff, 0xff]

// Glyphes 5 × 7 : 1 = pixel plein.
const GLYPHES: Record<string, string[]> = {
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
}

const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(octets: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloc(type: string, donnees: Buffer): Buffer {
  const longueur = Buffer.alloc(4)
  longueur.writeUInt32BE(donnees.length)
  const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corps))
  return Buffer.concat([longueur, corps, crc])
}

// Image RGBA : un fond plein, et les deux lettres centrées dans une zone de largeur `echelle`.
function dessiner(taille: number, zone: number): Buffer {
  const pixels = Buffer.alloc(taille * taille * 4)
  for (let i = 0; i < taille * taille; i++) {
    pixels[i * 4] = ROUGE[0]
    pixels[i * 4 + 1] = ROUGE[1]
    pixels[i * 4 + 2] = ROUGE[2]
    pixels[i * 4 + 3] = 0xff
  }

  // Une lettre = 5 colonnes, 7 lignes. Deux lettres + un intervalle de 1 colonne.
  // Largeur du texte = zone × taille : on en déduit la taille d'un pixel.
  const colonnes = 5 * 2 + 1
  const pas = Math.max(1, Math.floor((taille * zone) / colonnes))
  const largeurTexte = colonnes * pas
  const hauteurTexte = 7 * pas
  const departX = Math.floor((taille - largeurTexte) / 2)
  const departY = Math.floor((taille - hauteurTexte) / 2)

  ;["E", "R"].forEach((lettre, index) => {
    const glyphe = GLYPHES[lettre]
    const decalageX = departX + index * 6 * pas
    glyphe.forEach((ligne, y) => {
      ligne.split("").forEach((pixel, x) => {
        if (pixel !== "1") return
        for (let dy = 0; dy < pas; dy++) {
          for (let dx = 0; dx < pas; dx++) {
            const px = decalageX + x * pas + dx
            const py = departY + y * pas + dy
            const i = (py * taille + px) * 4
            pixels[i] = BLANC[0]
            pixels[i + 1] = BLANC[1]
            pixels[i + 2] = BLANC[2]
          }
        }
      })
    })
  })

  // Chaque ligne commence par un octet de filtre (0 : aucun filtre).
  const lignes = Buffer.alloc((taille * 4 + 1) * taille)
  for (let y = 0; y < taille; y++) {
    lignes[y * (taille * 4 + 1)] = 0
    pixels.copy(lignes, y * (taille * 4 + 1) + 1, y * taille * 4, (y + 1) * taille * 4)
  }

  const entete = Buffer.alloc(13)
  entete.writeUInt32BE(taille, 0)
  entete.writeUInt32BE(taille, 4)
  entete[8] = 8 // profondeur : 8 bits par canal
  entete[9] = 6 // RGBA
  entete[10] = 0
  entete[11] = 0
  entete[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", entete),
    bloc("IDAT", deflateSync(lignes)),
    bloc("IEND", Buffer.alloc(0)),
  ])
}

const dossier = join(process.cwd(), "public", "icones")
mkdirSync(dossier, { recursive: true })
writeFileSync(join(dossier, "icone-192.png"), dessiner(192, 0.7))
writeFileSync(join(dossier, "icone-512.png"), dessiner(512, 0.7))
writeFileSync(join(dossier, "icone-512-masquable.png"), dessiner(512, 0.5))
console.log("Icônes écrites dans public/icones/ (192, 512, 512 masquable).")
