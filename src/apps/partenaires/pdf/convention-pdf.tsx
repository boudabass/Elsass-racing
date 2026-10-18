// PDF de la convention de partenariat (brief 3.6, §5 ; retouches 3.7, point 0) : DocumentTeam (3.1b) et les blocs
// communs. Le texte est découpé par blocsDuTexte ; la signature est une zone à deux colonnes : titre, nom, qualité,
// date, « Signature » au-dessus d'un espace de 2,5 cm, puis « Lu et approuvé ».
import { type ReactNode } from "react"
import { StyleSheet, Text, View } from "@react-pdf/renderer"

import { DocumentTeam, type TeamPdf } from "@/core/pdf/document-team"
import { Intertitre, Paragraphe } from "@/core/pdf/composants"
import { textePdf } from "@/core/pdf/texte"

import { blocsDuTexte, type BlocDocument } from "../document"

// 2,5 cm en points PDF (1 cm = 28,35 pt) : l'espace où chacun signe.
const HAUTEUR_SIGNATURE = 71

const FAIT_A = /^Fait à/
const BLANC = "________"

const styles = StyleSheet.create({
  puces: { marginBottom: 6, marginLeft: 6 },
  // Même interligne que les lignes d'un paragraphe, sans écart entre deux puces. Le signe doit avoir sa propre
  // taille : sans elle, react-pdf le compose en 18 pt, et chaque puce prend une ligne vide de plus (25,2 pt au lieu de 14).
  puce: { flexDirection: "row" },
  puceSigne: { width: 12, fontSize: 10, lineHeight: 1.4 },
  puceTexte: { flexGrow: 1, fontSize: 10, lineHeight: 1.4 },
  signatures: { flexDirection: "row", gap: 24, marginTop: 16 },
  signature: { flexGrow: 1, flexBasis: 0 },
  signatureTitre: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 11, marginBottom: 6 },
  signatureLigne: { marginBottom: 3, lineHeight: 1.4 },
  signatureEspace: { height: HAUTEUR_SIGNATURE, borderBottomWidth: 1, borderBottomColor: "#888888", marginTop: 4 },
  signatureSigne: { fontSize: 8, color: "#555555", marginTop: 2 },
  mention: { marginTop: 4, color: "#555555" },
})

// « Prénom Nom, président » → nom et qualité. Sans virgule, tout le texte est le nom.
export function nomEtQualite(valeur: string): { nom: string; qualite: string } {
  const virgule = valeur.indexOf(",")
  if (virgule < 0) return { nom: valeur.trim() || BLANC, qualite: BLANC }
  return { nom: valeur.slice(0, virgule).trim() || BLANC, qualite: valeur.slice(virgule + 1).trim() || BLANC }
}

function Signature({ titre, valeur }: { titre: string; valeur: string }) {
  const { nom, qualite } = nomEtQualite(valeur)
  return (
    <View style={styles.signature}>
      <Text style={styles.signatureTitre}>{titre}</Text>
      <Text style={styles.signatureLigne}>{textePdf(`Nom : ${nom}`)}</Text>
      <Text style={styles.signatureLigne}>{textePdf(`Qualité : ${qualite}`)}</Text>
      <Text style={styles.signatureLigne}>Date : ____________________</Text>
      <Text style={styles.signatureSigne}>Signature</Text>
      <View style={styles.signatureEspace} />
      <Text style={styles.mention}>Lu et approuvé</Text>
    </View>
  )
}

function Bloc({ bloc }: { bloc: BlocDocument }) {
  switch (bloc.type) {
    case "titre":
      return null
    case "intertitre":
      return <Intertitre>{textePdf(bloc.texte)}</Intertitre>
    case "paragraphe":
      return <Paragraphe>{textePdf(bloc.texte)}</Paragraphe>
    case "puces":
      return (
        <View style={styles.puces}>
          {bloc.elements.map((element, index) => (
            <View key={index} style={styles.puce}>
              <Text style={styles.puceSigne}>•</Text>
              <Text style={styles.puceTexte}>{textePdf(element)}</Text>
            </View>
          ))}
        </View>
      )
    case "signature":
      return (
        <View style={styles.signatures} wrap={false}>
          <Signature titre="Pour l'association" valeur={bloc.team} />
          <Signature titre="Pour le partenaire" valeur={bloc.partenaire} />
        </View>
      )
  }
}

export interface ConventionPdfProps {
  texte: string
  sousTitre: string
  team: TeamPdf
}

export function ConventionPdf({ texte, sousTitre, team }: ConventionPdfProps) {
  const blocs = blocsDuTexte(texte)
  const rendus: ReactNode[] = []
  for (let i = 0; i < blocs.length; i++) {
    const bloc = blocs[i]
    const suivant = blocs[i + 1]
    // « Fait à … » reste sur la même page que le bloc de signature.
    if (bloc.type === "paragraphe" && FAIT_A.test(bloc.texte) && suivant?.type === "signature") {
      rendus.push(
        <View key={i} wrap={false}>
          <Bloc bloc={bloc} />
          <Bloc bloc={suivant} />
        </View>,
      )
      i++
    } else {
      rendus.push(<Bloc key={i} bloc={bloc} />)
    }
  }
  return (
    <DocumentTeam titre="Convention de partenariat" sousTitre={sousTitre} team={team}>
      {rendus}
    </DocumentTeam>
  )
}
