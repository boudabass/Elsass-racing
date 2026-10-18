// Bilan de partenariat (brief 3.7, §5) : la mise en forme des données du bilan. Fonction pure : ni base, ni PDF.
// Elle ne garde que ce qui peut figurer dans un bilan, même si l'appelant lui a passé autre chose : une preuve
// masquée, ou hors de la période, n'entre jamais dans le document.

export type StatutBilanContrepartie = "a_faire" | "en_cours" | "tenue" | "reportee" | "en_retard"

export interface ContrepartieBilan {
  libelle: string
  quantitePromise: number
  quantiteTenue: number
  statut: StatutBilanContrepartie
  echeance: string | null
}

export interface PreuveBilan {
  id: string
  // Jour civil, AAAA-MM-JJ.
  date: string
  type: string
  epreuve: string | null
  visiblePartenaire: boolean
  // JPEG ou PNG : une vignette dans le bilan. Les autres fichiers sont cités par leur date.
  estImage: boolean
  fileId: string | null
  lien: string | null
  commentaire: string | null
}

export interface ResultatBilan {
  epreuve: string
  date: string
  statut: string
  classementGeneral: number | null
  nbClasses: number | null
  classementClasse: number | null
  nbPartantsClasse: number | null
}

export interface EntreesBilan {
  debut: string
  fin: string
  contreparties: ContrepartieBilan[]
  preuves: PreuveBilan[]
  resultats: ResultatBilan[]
  // Épreuves terminées pendant la période, dans les saisons des conventions du bilan.
  epreuvesCourues: number
}

export interface BilanPartenaire {
  periode: { debut: string; fin: string }
  chiffres: { contrepartiesTenues: number; contrepartiesTotal: number; preuves: number; epreuvesCourues: number }
  contreparties: ContrepartieBilan[]
  // Preuves visibles par le partenaire et datées dans la période, de la plus ancienne à la plus récente.
  preuves: PreuveBilan[]
  // Résultats validés et publics, datés dans la période.
  resultats: ResultatBilan[]
}

export function construireBilan(entrees: EntreesBilan): BilanPartenaire {
  const dansLaPeriode = (jour: string) => jour >= entrees.debut && jour <= entrees.fin
  const preuves = entrees.preuves
    .filter((preuve) => preuve.visiblePartenaire && dansLaPeriode(preuve.date))
    .sort((a, b) => a.date.localeCompare(b.date))
  const resultats = entrees.resultats.filter((resultat) => dansLaPeriode(resultat.date))
  const contrepartiesTenues = entrees.contreparties.filter((contrepartie) => contrepartie.statut === "tenue").length

  return {
    periode: { debut: entrees.debut, fin: entrees.fin },
    chiffres: {
      contrepartiesTenues,
      contrepartiesTotal: entrees.contreparties.length,
      preuves: preuves.length,
      epreuvesCourues: entrees.epreuvesCourues,
    },
    contreparties: entrees.contreparties,
    preuves,
    resultats,
  }
}
