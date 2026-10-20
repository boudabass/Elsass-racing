// Document commun à tous les PDF de la team (brief 3.1b, section 3) : A4 portrait, en-tête au nom et au logo,
// filet à la couleur de la team, pied de page daté et paginé.
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import type { ReactNode } from "react"

import "./polices"
import { textePdf } from "./texte"

// Rouge de l'app par défaut (--marque, thème clair).
export const COULEUR_PAR_DEFAUT = "#b91c1c"

// Logo en JPEG ou PNG seulement : @react-pdf ne lit ni le WebP ni le SVG (voir logo-serveur.ts).
export interface LogoPdf {
  data: Buffer
  format: "jpg" | "png"
}

export interface TeamPdf {
  nom: string
  couleur: string | null
  logo: LogoPdf | null
}

export interface DocumentTeamProps {
  titre: string
  sousTitre: string
  team: TeamPdf
  children?: ReactNode
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Barlow",
    fontSize: 10,
    color: "#111111",
    // Pas de ligatures (« fi », « fl ») : le texte extrait du PDF garde les lettres (« financier », pas « fnancier »).
    fontFeatureSettings: { liga: false },
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
  },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 10,
    marginBottom: 16,
    borderBottomWidth: 2,
  },
  logo: { width: 40, height: 40, objectFit: "contain" },
  nomTeam: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 16 },
  titre: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 24, marginBottom: 4 },
  sousTitre: { fontSize: 10, color: "#555555", marginBottom: 14 },
  pied: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#666666",
  },
})

// Date du jour en français, au fuseau de la team (Strasbourg).
function dateDuJour(): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date())
}

export function DocumentTeam({ titre, sousTitre, team, children }: DocumentTeamProps) {
  const couleur = team.couleur ?? COULEUR_PAR_DEFAUT
  return (
    <Document title={textePdf(titre)} author="Elsass Racing" creator="Elsass Racing">
      <Page size="A4" style={styles.page}>
        <View style={[styles.entete, { borderBottomColor: couleur }]}>
          {team.logo && <Image src={team.logo} style={styles.logo} />}
          <Text style={styles.nomTeam}>{textePdf(team.nom)}</Text>
        </View>

        <Text style={styles.titre}>{textePdf(titre)}</Text>
        <Text style={styles.sousTitre}>{textePdf(sousTitre)}</Text>

        {children}

        <View style={styles.pied} fixed>
          <Text>{`Elsass Racing · ${dateDuJour()}`}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} sur ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
