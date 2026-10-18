// PDF du bilan de partenariat (brief 3.7, §5) : DocumentTeam (3.1b) et les blocs communs. Les données viennent de
// construireBilan, qui a déjà retiré les preuves masquées et celles hors de la période. Les photos JPEG ou PNG sont
// des vignettes, quatre par ligne au plus ; les autres preuves sont citées par leur date.
import { Image, StyleSheet, Text, View } from "@react-pdf/renderer"

import { ChiffresCles, Intertitre, Paragraphe, Tableau } from "@/core/pdf/composants"
import { DocumentTeam, type LogoPdf, type TeamPdf } from "@/core/pdf/document-team"
import { textePdf } from "@/core/pdf/texte"

import type { BilanPartenaire } from "../bilan"
import { LIBELLES_STATUT_CONTREPARTIE } from "../affichage"

const styles = StyleSheet.create({
  grille: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  vignette: { width: 118, flexDirection: "column" },
  image: { width: 118, height: 118, objectFit: "cover", borderRadius: 4 },
  legende: { fontSize: 8, color: "#555555", marginTop: 2 },
  preuve: { marginBottom: 6, lineHeight: 1.4 },
  lien: { color: "#333333" },
})

// « 2026-06-10 » -> « 10/06/2026 »
function dateCourte(jour: string): string {
  const [annee, mois, date] = jour.split("-")
  return `${date}/${mois}/${annee}`
}

export interface BilanPartenairePdfProps {
  bilan: BilanPartenaire
  entreprise: string
  team: TeamPdf
  // Photos de la période, par identifiant de fichier. Une photo absente de la carte devient une ligne de texte.
  images: Map<string, LogoPdf>
}

export function BilanPartenairePdf({ bilan, entreprise, team, images }: BilanPartenairePdfProps) {
  const periode = `du ${dateCourte(bilan.periode.debut)} au ${dateCourte(bilan.periode.fin)}`
  const photos = bilan.preuves.flatMap((preuve) => {
    const image = preuve.fileId && preuve.estImage ? images.get(preuve.fileId) : undefined
    return image ? [{ preuve, image }] : []
  })
  const autres = bilan.preuves.filter((preuve) => !photos.some((photo) => photo.preuve === preuve))

  return (
    <DocumentTeam titre="Bilan de partenariat" sousTitre={textePdf(`${entreprise} · ${periode}`)} team={team}>
      <ChiffresCles
        chiffres={[
          { libelle: "Contreparties tenues sur promises", valeur: `${bilan.chiffres.contrepartiesTenues} sur ${bilan.chiffres.contrepartiesTotal}` },
          { libelle: "Preuves de la période", valeur: String(bilan.chiffres.preuves) },
          { libelle: "Épreuves courues sur la période", valeur: String(bilan.chiffres.epreuvesCourues) },
        ]}
      />

      <Intertitre>Contreparties et avancement</Intertitre>
      {bilan.contreparties.length === 0 ? (
        <Paragraphe>Aucune contrepartie pour ce partenaire.</Paragraphe>
      ) : (
        <Tableau
          colonnes={[
            { titre: "Contrepartie", largeur: 3 },
            { titre: "Tenu sur promis", largeur: 1, alignDroite: true },
            { titre: "Statut", largeur: 2 },
          ]}
          lignes={bilan.contreparties.map((c) => [
            c.libelle,
            `${c.quantiteTenue} sur ${c.quantitePromise}`,
            LIBELLES_STATUT_CONTREPARTIE[c.statut] ?? c.statut,
          ])}
        />
      )}

      <Intertitre>Preuves de la période</Intertitre>
      {bilan.preuves.length === 0 ? (
        <Paragraphe>Aucune preuve sur la période.</Paragraphe>
      ) : (
        <>
          {photos.length > 0 && (
            <View style={styles.grille}>
              {photos.map(({ preuve, image }) => (
                <View key={preuve.id} style={styles.vignette} wrap={false}>
                  <Image src={image} style={styles.image} />
                  <Text style={styles.legende}>{textePdf(`${dateCourte(preuve.date)}${preuve.epreuve ? ` · ${preuve.epreuve}` : ""}`)}</Text>
                </View>
              ))}
            </View>
          )}
          {autres.map((preuve) => (
            <View key={preuve.id} style={styles.preuve} wrap={false}>
              <Text>{textePdf(`${dateCourte(preuve.date)} · ${preuve.type}${preuve.epreuve ? ` · ${preuve.epreuve}` : ""}`)}</Text>
              {preuve.commentaire && <Text>{textePdf(preuve.commentaire)}</Text>}
              {preuve.lien && <Text style={styles.lien}>{textePdf(`Lien : ${preuve.lien}`)}</Text>}
            </View>
          ))}
        </>
      )}

      <Intertitre>Résultats validés et publics</Intertitre>
      {bilan.resultats.length === 0 ? (
        <Paragraphe>Aucun résultat publié sur la période.</Paragraphe>
      ) : (
        <Tableau
          colonnes={[
            { titre: "Épreuve", largeur: 3 },
            { titre: "Date", largeur: 1 },
            { titre: "Statut", largeur: 1 },
            { titre: "Classement", largeur: 2 },
          ]}
          lignes={bilan.resultats.map((r) => [
            r.epreuve,
            dateCourte(r.date),
            r.statut,
            [
              r.classementGeneral !== null ? `${r.classementGeneral}e au général${r.nbClasses ? ` sur ${r.nbClasses}` : ""}` : null,
              r.classementClasse !== null ? `${r.classementClasse}e en classe${r.nbPartantsClasse ? ` sur ${r.nbPartantsClasse}` : ""}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—",
          ])}
        />
      )}

      <Paragraphe>Merci pour votre soutien.</Paragraphe>
    </DocumentTeam>
  )
}
