"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import { MoteurSynchro, type EtatSynchro } from "./moteur"
import { nomBase, type LigneLocale, type TableLocale } from "./base"

// Un moteur par compte et par team, pour tout l'onglet (les écrans partagent la même file).
const moteurs = new Map<string, MoteurSynchro>()

function moteurPour(userId: string, teamId: string): MoteurSynchro {
  const cle = nomBase(userId, teamId)
  let moteur = moteurs.get(cle)
  if (!moteur) {
    moteur = new MoteurSynchro(userId, teamId)
    moteurs.set(cle, moteur)
  }
  return moteur
}

const ContexteSynchro = createContext<MoteurSynchro | null>(null)

export function SynchroProvider({ userId, teamId, children }: { userId: string; teamId: string; children: ReactNode }) {
  const moteur = useMemo(() => moteurPour(userId, teamId), [userId, teamId])
  const router = useRouter()
  const chemin = usePathname()
  // Vrai de la demande de rafraîchissement jusqu'à l'arrivée du rendu serveur (nouveaux enfants).
  const perime = useRef(false)
  const cheminPrecedent = useRef(chemin)

  useEffect(() => {
    void moteur.demarrer()
    return () => moteur.arreter()
  }, [moteur])

  // Quand le serveur a appliqué des opérations (une dépense d'engagement crée une action dans la boîte),
  // l'espace connecté, rendu côté serveur, se relit : boîte, compteur et solde sont à jour sans rechargement.
  useEffect(
    () =>
      moteur.abonnerAuServeur(() => {
        perime.current = true
        router.refresh()
      }),
    [moteur, router],
  )

  // Une navigation pendant un rafraîchissement l'annule : le drapeau reste posé, on le refait sur la nouvelle page.
  // Sans navigation, l'arrivée du rendu serveur (enfants renouvelés) lève le drapeau.
  useEffect(() => {
    if (cheminPrecedent.current !== chemin) {
      cheminPrecedent.current = chemin
      if (perime.current) router.refresh()
      return
    }
    perime.current = false
  }, [chemin, children, router])

  return <ContexteSynchro.Provider value={moteur}>{children}</ContexteSynchro.Provider>
}

export function useMoteurSynchro(): MoteurSynchro {
  const moteur = useContext(ContexteSynchro)
  if (!moteur) throw new Error("SynchroProvider manquant : la synchro n'est disponible que dans l'espace connecté.")
  return moteur
}

// État de la synchro (en ligne, nombre de modifications en attente, dernière synchro).
export function useEtatSynchro(): EtatSynchro {
  const moteur = useMoteurSynchro()
  const abonner = useCallback((ecouteur: () => void) => moteur.abonner(ecouteur), [moteur])
  return useSyncExternalStore(abonner, () => moteur.lireEtat(), () => moteur.lireEtat())
}

// Lignes d'une table de la base locale, qui se rafraîchissent à chaque changement. Sans les supprimées.
export function useTable(table: TableLocale): LigneLocale[] {
  const moteur = useMoteurSynchro()
  const [lignes, setLignes] = useState<LigneLocale[]>([])

  useEffect(() => {
    let actif = true
    const charger = async () => {
      const liste = await moteur.lireTable(table)
      if (actif) setLignes(liste)
    }
    void charger()
    const retirer = moteur.abonner(() => void charger())
    return () => {
      actif = false
      retirer()
    }
  }, [moteur, table])

  return lignes
}
