// PDF du bilan de saison de Budget (brief 3.1b, section 4.2). Construit avec DocumentTeam et les blocs communs.
import { ChiffresCles, Intertitre, Paragraphe, Tableau } from "@/core/pdf/composants"
import { DocumentTeam, type TeamPdf } from "@/core/pdf/document-team"
import { formatEuros } from "@/lib/euros"

import type { BilanSaison } from "../bilan"

const pourcent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 })
const dateLongue = (date: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(date)

// « 2026-05-10 » -> « 10/05/2026 »
const dateCourte = (aaaaMmJj: string) => {
  const [annee, mois, jour] = aaaaMmJj.split("-")
  return `${jour}/${mois}/${annee}`
}

// Écart signé : « +1 000,00 € » au-dessus du prévu, « -250,00 € » en dessous.
const ecartSigne = (centimes: number) => `${centimes > 0 ? "+" : ""}${formatEuros(centimes)}`

export interface BilanSaisonPdfProps {
  bilan: BilanSaison
  saisonNom: string
  team: TeamPdf
  date: Date
}

export function BilanSaisonPdf({ bilan, saisonNom, team, date }: BilanSaisonPdfProps) {
  const chiffres = [
    { libelle: "Dépenses confirmées", valeur: formatEuros(bilan.chiffres.depensesConfirmees) },
    { libelle: "Recettes encaissées", valeur: formatEuros(bilan.chiffres.recettesEncaissees) },
    { libelle: "Solde", valeur: formatEuros(bilan.chiffres.solde) },
    ...(bilan.chiffres.previsionDepenses !== null ? [{ libelle: "Prévisionnel des dépenses", valeur: formatEuros(bilan.chiffres.previsionDepenses) }] : []),
  ]

  return (
    <DocumentTeam titre={`Bilan de la saison ${saisonNom}`} sousTitre={`Arrêté au ${dateLongue(date)}`} team={team}>
      <ChiffresCles chiffres={chiffres} />

      {bilan.aucunMouvement ? (
        <Paragraphe>Aucun mouvement enregistré pour cette saison.</Paragraphe>
      ) : (
        <>
          <Intertitre>Dépenses par catégorie</Intertitre>
          {bilan.depensesParCategorie.length === 0 ? (
            <Paragraphe>Aucune dépense confirmée.</Paragraphe>
          ) : (
            <Tableau
              colonnes={[
                { titre: "Catégorie", largeur: 3 },
                { titre: "Montant", largeur: 1, alignDroite: true },
                { titre: "Part", largeur: 1, alignDroite: true },
                { titre: "Prévu", largeur: 1, alignDroite: true },
                { titre: "Écart au prévu", largeur: 1, alignDroite: true },
              ]}
              lignes={bilan.depensesParCategorie.map((ligne) => [
                ligne.nom,
                formatEuros(ligne.montant),
                pourcent.format(ligne.part / 100),
                ligne.prevu === null ? "–" : formatEuros(ligne.prevu),
                ligne.ecart === null ? "–" : ecartSigne(ligne.ecart),
              ])}
              total={["Total", formatEuros(bilan.chiffres.depensesConfirmees), pourcent.format(1), "", ""]}
            />
          )}

          <Intertitre>Coût par épreuve</Intertitre>
          {bilan.coutsParEpreuve.length === 0 ? (
            <Paragraphe>Aucune épreuve sur cette saison.</Paragraphe>
          ) : (
            <Tableau
              colonnes={[
                { titre: "Épreuve", largeur: 3 },
                { titre: "Date", largeur: 1 },
                { titre: "Coût", largeur: 1, alignDroite: true },
              ]}
              lignes={bilan.coutsParEpreuve.map((epreuve) => [epreuve.nom, dateCourte(epreuve.date), formatEuros(epreuve.total)])}
            />
          )}

          <Intertitre>Recettes</Intertitre>
          <Tableau
            colonnes={[
              { titre: "Recette", largeur: 3 },
              { titre: "Montant", largeur: 1, alignDroite: true },
            ]}
            lignes={[
              ...bilan.recettes.parCategorie.map((ligne) => [ligne.nom, formatEuros(ligne.montant)]),
              ...(bilan.recettes.aVenir > 0 ? [["À venir (prévues, non encaissées)", formatEuros(bilan.recettes.aVenir)]] : []),
            ]}
            total={["Total encaissé", formatEuros(bilan.chiffres.recettesEncaissees)]}
          />

          <Intertitre>Ce que la team doit à ses membres, à ce jour</Intertitre>
          {bilan.avancesMembres.length === 0 ? (
            <Paragraphe>Aucune avance enregistrée.</Paragraphe>
          ) : (
            <Tableau
              colonnes={[
                { titre: "Membre", largeur: 2 },
                { titre: "Avancé", largeur: 1, alignDroite: true },
                { titre: "Remboursé", largeur: 1, alignDroite: true },
                { titre: "Reste dû", largeur: 1, alignDroite: true },
              ]}
              lignes={bilan.avancesMembres.map((membre) => [
                membre.nom,
                formatEuros(membre.avance),
                formatEuros(membre.rembourse),
                membre.resteDu > 0 ? formatEuros(membre.resteDu) : membre.trop > 0 ? `Trop versé : ${formatEuros(membre.trop)}` : formatEuros(0),
              ])}
            />
          )}

          {bilan.propositions.nombre > 0 && (
            <Paragraphe>
              {`Dépenses à confirmer : ${bilan.propositions.nombre}, pour ${formatEuros(bilan.propositions.montant)}. Elles ne comptent dans aucun total.`}
            </Paragraphe>
          )}
        </>
      )}
    </DocumentTeam>
  )
}
