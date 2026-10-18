// Petits blocs réutilisables des PDF (brief 3.1b, section 3). Tout texte passe par textePdf().
import { StyleSheet, Text, View } from "@react-pdf/renderer"

import "./polices"
import { textePdf } from "./texte"

const styles = StyleSheet.create({
  titre: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 16, marginTop: 14, marginBottom: 6 },
  intertitre: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 12, marginTop: 12, marginBottom: 4 },
  paragraphe: { fontSize: 10, lineHeight: 1.4, marginBottom: 6 },
  chiffres: { flexDirection: "row", gap: 8, marginTop: 6, marginBottom: 8 },
  chiffre: { flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: "#dddddd", borderRadius: 4, padding: 8 },
  chiffreValeur: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 16 },
  chiffreLibelle: { fontSize: 8, color: "#555555", marginTop: 2 },
  ligne: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 4 },
  ligneZebree: { backgroundColor: "#f4f4f4" },
  ligneTotal: { borderTopWidth: 1, borderTopColor: "#888888" },
  entete: { borderBottomWidth: 1, borderBottomColor: "#888888" },
  cellule: { paddingRight: 6 },
  celluleDroite: { textAlign: "right" },
  gras: { fontWeight: 600 },
})

export function Titre({ children }: { children: string }) {
  return <Text style={styles.titre}>{textePdf(children)}</Text>
}

export function Intertitre({ children }: { children: string }) {
  return <Text style={styles.intertitre}>{textePdf(children)}</Text>
}

export function Paragraphe({ children }: { children: string }) {
  return <Text style={styles.paragraphe}>{textePdf(children)}</Text>
}

export interface ChiffreCle {
  libelle: string
  valeur: string
}

// Rangée de 2 à 4 chiffres clés, chacun avec son libellé.
export function ChiffresCles({ chiffres }: { chiffres: ChiffreCle[] }) {
  return (
    <View style={styles.chiffres}>
      {chiffres.map((chiffre) => (
        <View key={chiffre.libelle} style={styles.chiffre} wrap={false}>
          <Text style={styles.chiffreValeur}>{textePdf(chiffre.valeur)}</Text>
          <Text style={styles.chiffreLibelle}>{textePdf(chiffre.libelle)}</Text>
        </View>
      ))}
    </View>
  )
}

export interface ColonneTableau {
  titre: string
  // Part de la largeur (flex) : 3 pour une colonne large, 1 pour un montant.
  largeur: number
  alignDroite?: boolean
}

export interface TableauProps {
  colonnes: ColonneTableau[]
  lignes: string[][]
  // Ligne de total, en gras, séparée par un filet.
  total?: string[]
}

// Tableau : lignes zébrées très légères, montants à droite, une ligne jamais coupée entre deux pages.
export function Tableau({ colonnes, lignes, total }: TableauProps) {
  const cellule = (colonne: ColonneTableau, texte: string, gras = false) => (
    <View key={colonne.titre} style={{ flex: colonne.largeur }}>
      <Text style={[styles.cellule, colonne.alignDroite ? styles.celluleDroite : {}, gras ? styles.gras : {}]}>{textePdf(texte)}</Text>
    </View>
  )
  return (
    <View>
      <View style={[styles.ligne, styles.entete]} wrap={false}>
        {colonnes.map((colonne) => cellule(colonne, colonne.titre, true))}
      </View>
      {lignes.map((valeurs, index) => (
        <View key={index} style={[styles.ligne, index % 2 === 1 ? styles.ligneZebree : {}]} wrap={false}>
          {colonnes.map((colonne, i) => cellule(colonne, valeurs[i] ?? ""))}
        </View>
      ))}
      {total && (
        <View style={[styles.ligne, styles.ligneTotal]} wrap={false}>
          {colonnes.map((colonne, i) => cellule(colonne, total[i] ?? "", true))}
        </View>
      )}
    </View>
  )
}
