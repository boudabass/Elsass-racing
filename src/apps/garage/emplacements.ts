// Emplacements des organes par défaut (brief 4.3e, section 2.1). Un organe par emplacement : moteur, boîte et embrayage
// en ont un ; les transmissions, les freins et les amortisseurs en ont deux ou quatre ; les pneus sont un train (quatre
// roues dessinées, une seule pièce d'origine, voir la décision 3 du brief). La position est enregistrée dans
// garage_vehicle_component.position. Gauche = haut du dessin de dessus, nez à droite.

export const POSITION_UNIQUE = "unique"
export const POSITION_TRAIN = "train"

export type Emplacement = { position: string; libelle: string }

const QUATRE_ROUES: Emplacement[] = [
  { position: "avant_gauche", libelle: "avant gauche" },
  { position: "avant_droit", libelle: "avant droit" },
  { position: "arriere_gauche", libelle: "arrière gauche" },
  { position: "arriere_droit", libelle: "arrière droit" },
]

const UNIQUE: Emplacement[] = [{ position: POSITION_UNIQUE, libelle: "" }]

export const EMPLACEMENTS_PAR_TYPE: Record<string, Emplacement[]> = {
  moteur: UNIQUE,
  boite: UNIQUE,
  embrayage: UNIQUE,
  transmissions: [
    { position: "gauche", libelle: "gauche" },
    { position: "droite", libelle: "droite" },
  ],
  freins: QUATRE_ROUES,
  amortisseurs: QUATRE_ROUES,
  pneus: [{ position: POSITION_TRAIN, libelle: "" }],
}

// Emplacements d'un type par défaut. Un type ajouté par la team n'en a pas : son organe reste sans position.
export function emplacementsDuType(cle: string | null): Emplacement[] {
  if (!cle) return []
  return EMPLACEMENTS_PAR_TYPE[cle] ?? []
}

// Position lisible à l'écran : le libellé de l'emplacement (« avant gauche »), le texte saisi par la team pour un organe
// ajouté, et rien pour une position sans nom (« unique », « train »). Jamais la clé technique.
export function libellePosition(position: string | null): string | null {
  if (!position || position === POSITION_UNIQUE || position === POSITION_TRAIN) return null
  const emplacement = Object.values(EMPLACEMENTS_PAR_TYPE)
    .flat()
    .find((e) => e.position === position)
  return emplacement ? emplacement.libelle : position
}

// Nom d'un organe avec sa position lisible : « Freins · avant gauche ». Sans position nommée, le nom seul.
export function nomAvecPosition(nom: string, position: string | null): string {
  const libelle = libellePosition(position)
  return libelle ? `${nom} · ${libelle}` : nom
}

// Nombre total d'emplacements sur une voiture équipée des organes par défaut.
export function nombreEmplacementsParDefaut(): number {
  return Object.values(EMPLACEMENTS_PAR_TYPE).reduce((total, liste) => total + liste.length, 0)
}
