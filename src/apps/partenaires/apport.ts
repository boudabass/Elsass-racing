// Apport du partenaire (brief 3.14, point 4, phase A) : ce qu'il nous doit, ce qui est reçu, ce qui reste, et l'état
// de chaque versement. Fonction pure : les versements viennent de Budget (recettes d'origine partenaires:<convention>:<rang>),
// lues par la liaison existante. Rien n'est écrit ici, et il n'y a ni alerte ni événement (décision de l'orchestrateur).

export interface VersementLu {
  id: string
  rang: number
  date: string // AAAA-MM-JJ, échéance du versement
  montantCentimes: number
  statut: "prevue" | "encaissee"
  encaisseeLe: string | null // AAAA-MM-JJ
}

export type EtatVersement = "encaisse" | "prevu" | "en_retard"

export interface VersementBilan extends VersementLu {
  etat: EtatVersement
}

export interface BilanApport {
  attenduCentimes: number
  recuCentimes: number
  resteCentimes: number
  // Trop perçu : ce qui dépasse l'attendu. Le reste reste à 0 dans ce cas.
  tropCentimes: number
  // Aucun versement prévu alors qu'un apport est attendu : le reste est alors l'apport entier.
  sansVersement: boolean
  versements: VersementBilan[]
}

// Un versement est en retard s'il est échu sans être encaissé. Une échéance du jour n'est pas en retard.
function etatDuVersement(versement: VersementLu, aujourdhui: string): EtatVersement {
  if (versement.statut === "encaissee") return "encaisse"
  return versement.date < aujourdhui ? "en_retard" : "prevu"
}

export function bilanApport({
  attenduCentimes,
  versements,
  aujourdhui,
}: {
  attenduCentimes: number
  versements: VersementLu[]
  aujourdhui: string // AAAA-MM-JJ, jour civil de Paris
}): BilanApport {
  const recuCentimes = versements.filter((versement) => versement.statut === "encaissee").reduce((total, versement) => total + versement.montantCentimes, 0)
  return {
    attenduCentimes,
    recuCentimes,
    resteCentimes: Math.max(0, attenduCentimes - recuCentimes),
    tropCentimes: Math.max(0, recuCentimes - attenduCentimes),
    sansVersement: versements.length === 0 && attenduCentimes > 0,
    versements: [...versements].sort((a, b) => a.rang - b.rang).map((versement) => ({ ...versement, etat: etatDuVersement(versement, aujourdhui) })),
  }
}

// Rang d'un versement, lu dans son origine : partenaires:<convention>:<rang>.
export function rangDepuisOrigine(origineRef: string | null): number {
  const rang = Number(origineRef?.split(":")[2])
  return Number.isInteger(rang) && rang > 0 ? rang : 0
}
