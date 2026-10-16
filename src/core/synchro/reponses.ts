// Réponses des routes de synchro : jamais en cache, erreurs d'accès en 401 ou 403 avec une raison claire.

import { NextResponse } from "next/server"

import { ErreurAcces, libelleErreurAcces } from "@/core/droits/erreurs"

import { ErreurAppareilRevoque } from "./erreurs"

const ENTETES = { "Cache-Control": "no-store" }

export function reponseJson(corps: unknown, statut = 200): NextResponse {
  return NextResponse.json(corps, { status: statut, headers: ENTETES })
}

export function reponseErreurAcces(erreur: unknown): NextResponse {
  // Appareil déconnecté pendant la synchro : ce n'est pas une panne, pas de journal d'erreur.
  if (erreur instanceof ErreurAppareilRevoque) return reponseJson({ erreur: erreur.message }, 401)
  if (erreur instanceof ErreurAcces) {
    if (erreur.raison === "non_connecte") return reponseJson({ erreur: "Tu n'es pas connecté." }, 401)
    if (erreur.raison === "aucune_team") return reponseJson({ erreur: "Aucune team n'est ouverte." }, 403)
    return reponseJson({ erreur: libelleErreurAcces(erreur) }, 403)
  }
  console.error("[synchro] erreur :", erreur)
  return reponseJson({ erreur: "La synchronisation a échoué. Réessaie." }, 500)
}

export function reponseRequeteInvalide(): NextResponse {
  return reponseJson({ erreur: "Requête invalide." }, 400)
}
