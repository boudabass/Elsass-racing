// Reconnaissances : position d'une sortie par rapport au créneau autorisé. Règle pure.
// Une sortie hors créneau reste enregistrée : c'est une information, jamais un blocage.

import { jourDeParis } from "./regles"

export type PositionCreneau = "dans" | "hors" | "non_defini"

// Jour civil « AAAA-MM-JJ » d'une sortie, comparé aux jours de Paris du début et de la fin du créneau.
export function positionCreneau(debutAutorise: Date | null, finAutorisee: Date | null, jour: string): PositionCreneau {
  if (!debutAutorise) return "non_defini"
  const debut = jourDeParis(debutAutorise)
  const fin = finAutorisee ? jourDeParis(finAutorisee) : debut
  return jour >= debut && jour <= fin ? "dans" : "hors"
}

// Valeur d'un champ datetime-local (« AAAA-MM-JJTHH:MM ») pour un instant, à l'heure de Paris.
export function champDateHeure(instant: Date | null): string {
  if (!instant) return ""
  const parties = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant)
  const valeur = (type: string) => parties.find((partie) => partie.type === type)?.value ?? ""
  return `${valeur("year")}-${valeur("month")}-${valeur("day")}T${valeur("hour")}:${valeur("minute")}`
}
