// Mise en blocs du texte d'une convention, pour le PDF (brief 3.6, §5). Fonction pure : elle ne sait rien du
// PDF. Le texte vient de genererDocument (modèle déjà rempli) : les titres d'articles commencent par « Article n : »,
// les puces par « - », et le bloc de signature par « Pour la team : ».

export type BlocDocument =
  | { type: "titre"; texte: string }
  | { type: "intertitre"; texte: string }
  | { type: "paragraphe"; texte: string }
  | { type: "puces"; elements: string[] }
  | { type: "signature"; team: string; partenaire: string }

const ARTICLE = /^Article \d+ ?:/
const PUCE = /^- /
const SIGNATURE_TEAM = /^Pour la team\s*:/
const SIGNATURE_PARTENAIRE = /^Pour le partenaire\s*:/
const SIGNATURE_SEULE = /^Signature( et cachet)?$/

export function blocsDuTexte(texte: string): BlocDocument[] {
  const lignes = texte.split("\n").map((ligne) => ligne.trim())
  const blocs: BlocDocument[] = []
  let paragraphe: string[] = []
  let puces: string[] = []
  let titreVu = false

  const viderParagraphe = () => {
    if (paragraphe.length > 0) blocs.push({ type: "paragraphe", texte: paragraphe.join(" ") })
    paragraphe = []
  }
  const viderPuces = () => {
    if (puces.length > 0) blocs.push({ type: "puces", elements: puces })
    puces = []
  }
  const viderTout = () => {
    viderParagraphe()
    viderPuces()
  }

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i]
    if (ligne === "") {
      viderTout()
      continue
    }
    // La première ligne est le titre du document : DocumentTeam l'affiche déjà, on ne la répète pas.
    if (!titreVu) {
      titreVu = true
      blocs.push({ type: "titre", texte: ligne })
      continue
    }
    if (SIGNATURE_TEAM.test(ligne)) {
      viderTout()
      // La ligne du partenaire vient après « Signature » : on la cherche, puis on saute jusqu'à elle.
      let j = i + 1
      while (j < lignes.length && !SIGNATURE_PARTENAIRE.test(lignes[j])) j++
      const partenaire = j < lignes.length ? lignes[j].replace(SIGNATURE_PARTENAIRE, "").trim() : ""
      blocs.push({ type: "signature", team: ligne.replace(SIGNATURE_TEAM, "").trim(), partenaire })
      // « Signature et cachet », sous la ligne du partenaire, appartient au même bloc.
      let k = j + 1
      while (k < lignes.length && lignes[k] === "") k++
      if (k < lignes.length && SIGNATURE_SEULE.test(lignes[k])) j = k
      i = j
      continue
    }
    if (PUCE.test(ligne)) {
      viderParagraphe()
      puces.push(ligne.replace(PUCE, ""))
      continue
    }
    if (ARTICLE.test(ligne)) {
      viderTout()
      blocs.push({ type: "intertitre", texte: ligne })
      continue
    }
    viderPuces()
    paragraphe.push(ligne)
  }
  viderTout()
  return blocs
}
