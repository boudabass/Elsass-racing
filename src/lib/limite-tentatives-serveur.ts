// Limite de tentatives en mémoire, par clé (ex. "ip|email"). Fenêtre fixe : elle
// démarre à la première tentative, et au bout de `fenetreMs` le compteur repart à zéro.
// En mémoire : un redémarrage du serveur remet les compteurs à zéro. Suffisant pour
// freiner les essais répétés sur une instance ; pas une garantie multi-instances.

interface Etat {
  debut: number
  nombre: number
}

export class LimiteTentatives {
  private readonly etats = new Map<string, Etat>()

  constructor(
    private readonly max: number,
    private readonly fenetreMs: number,
  ) {}

  // Consomme une tentative. Renvoie false, sans rien compter, si la limite est atteinte.
  tenter(cle: string, maintenant = Date.now()): boolean {
    const etat = this.etatCourant(cle, maintenant)
    if (etat && etat.nombre >= this.max) return false
    if (etat) etat.nombre += 1
    else this.etats.set(cle, { debut: maintenant, nombre: 1 })
    return true
  }

  // Compte un échec (ex. code faux), sans refuser la tentative en cours.
  echec(cle: string, maintenant = Date.now()): void {
    const etat = this.etatCourant(cle, maintenant)
    if (etat) etat.nombre += 1
    else this.etats.set(cle, { debut: maintenant, nombre: 1 })
  }

  estBloquee(cle: string, maintenant = Date.now()): boolean {
    const etat = this.etatCourant(cle, maintenant)
    return etat !== undefined && etat.nombre >= this.max
  }

  reinitialiser(cle: string): void {
    this.etats.delete(cle)
  }

  private etatCourant(cle: string, maintenant: number): Etat | undefined {
    const etat = this.etats.get(cle)
    if (!etat) return undefined
    if (maintenant - etat.debut >= this.fenetreMs) {
      this.etats.delete(cle)
      return undefined
    }
    return etat
  }
}
