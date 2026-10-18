// PDF de la convention de partenariat (brief 3.6, §5) : DocumentTeam (3.1b) et les blocs communs. Le texte est
// découpé par blocsDuTexte ; la signature est une zone à deux colonnes, « Lu et approuvé » sous chaque nom.
import { StyleSheet, Text, View } from "@react-pdf/renderer"

import { DocumentTeam, type TeamPdf } from "@/core/pdf/document-team"
import { Intertitre, Paragraphe } from "@/core/pdf/composants"
import { textePdf } from "@/core/pdf/texte"

import { blocsDuTexte, type BlocDocument } from "../document"

const styles = StyleSheet.create({
  puces: { marginBottom: 6, marginLeft: 6 },
  puce: { flexDirection: "row", marginBottom: 3 },
  puceSigne: { width: 12 },
  puceTexte: { flexGrow: 1, lineHeight: 1.4 },
  signatures: { flexDirection: "row", gap: 24, marginTop: 24 },
  signature: { flexGrow: 1, flexBasis: 0, borderTopWidth: 1, borderTopColor: "#888888", paddingTop: 6, minHeight: 90 },
  signatureLabel: { fontWeight: 600, marginBottom: 4 },
  signatureLigne: { marginBottom: 3 },
  mention: { marginTop: 8, color: "#555555" },
})

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
          <View style={styles.signature}>
            <Text style={styles.signatureLabel}>Pour l&apos;association</Text>
            <Text style={styles.signatureLigne}>{textePdf(bloc.team)}</Text>
            <Text style={styles.signatureLigne}>Date : ____________________</Text>
            <Text style={styles.mention}>Lu et approuvé</Text>
          </View>
          <View style={styles.signature}>
            <Text style={styles.signatureLabel}>Pour le partenaire</Text>
            <Text style={styles.signatureLigne}>{textePdf(bloc.partenaire)}</Text>
            <Text style={styles.signatureLigne}>Date : ____________________</Text>
            <Text style={styles.mention}>Lu et approuvé</Text>
          </View>
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
  return (
    <DocumentTeam titre="Convention de partenariat" sousTitre={sousTitre} team={team}>
      {blocsDuTexte(texte).map((bloc, index) => (
        <Bloc key={index} bloc={bloc} />
      ))}
    </DocumentTeam>
  )
}
