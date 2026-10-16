// Choix du mode de navigation de l'app. En ligne : navigation client de Next (rapide). Hors ligne :
// navigation de page, que le service worker sert depuis le cache. Une navigation client demande une
// requête RSC en arrière-plan : hors ligne, elle échoue, et la page plante.

export type ModeNavigation = "client" | "page"

export function modeNavigation(enLigne: boolean): ModeNavigation {
  return enLigne ? "client" : "page"
}
