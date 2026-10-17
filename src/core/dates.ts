// Dates partagées par les apps (tâche 2.8, petites dettes). « Aujourd'hui » se lit ici, à Paris, jamais en UTC.

// Jour civil de Paris pour un instant donné, au format « AAAA-MM-JJ ».
export function jourDeParis(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant)
}
