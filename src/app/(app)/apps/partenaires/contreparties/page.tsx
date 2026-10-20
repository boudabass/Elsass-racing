import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/partenaires/ecran"
import { couleurContrepartie, dateFrancaise, LIBELLES_STATUT_CONTREPARTIE, LIBELLES_TYPE_CONTREPARTIE } from "@/apps/partenaires/affichage"
import { listerContreparties, lireSaisons } from "@/apps/partenaires/lectures-serveur"
import { jourParis } from "@/apps/partenaires/regles"
import { EcranVide } from "@/components/qg/ecran-vide"
import { BOUTON_SECONDAIRE, LIEN } from "@/lib/classes-formulaire"

// Filtres en pastilles, gardés dans l'URL. « Toutes » est le filtre par défaut.
const FILTRES = [
  { cle: "toutes", libelle: "Toutes" },
  { cle: "retard", libelle: "En retard" },
  { cle: "a_faire", libelle: "À faire" },
  { cle: "tenues", libelle: "Faites" },
] as const

type CleFiltre = (typeof FILTRES)[number]["cle"]

function garderFiltre(filtre: string | undefined, contrepartie: { statut: string }): boolean {
  if (filtre === "retard") return contrepartie.statut === "en_retard"
  if (filtre === "a_faire") return contrepartie.statut === "a_faire"
  if (filtre === "tenues") return contrepartie.statut === "tenue"
  return true
}

// Vue globale des contreparties de la saison en cours, groupées par partenaire. Clic : la convention, à la contrepartie.
export default async function PageContreparties({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { filtre } = await searchParams
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const saisons = await lireSaisons()
  const saisonEnCours = saisons.find((s) => s.enCours) ?? null
  const contreparties = await listerContreparties({ saisonId: saisonEnCours?.id ?? null })
  const aujourdhui = jourParis(new Date())
  const cleFiltre: CleFiltre = FILTRES.find((f) => f.cle === filtre)?.cle ?? "toutes"
  const visibles = contreparties.filter((c) => garderFiltre(cleFiltre, c))

  // Groupées par partenaire, dans l'ordre alphabétique des entreprises.
  const groupes = new Map<string, typeof visibles>()
  for (const contrepartie of visibles) {
    const groupe = groupes.get(contrepartie.entreprise) ?? []
    groupe.push(contrepartie)
    groupes.set(contrepartie.entreprise, groupe)
  }
  const entreprises = Array.from(groupes.keys()).sort((a, b) => a.localeCompare(b, "fr"))

  return (
    <section className="flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="titre-rallye text-3xl">Contreparties</h1>
        <p className="text-texte-discret">{saisonEnCours ? saisonEnCours.nom : "Aucune saison en cours"}</p>
      </div>

      <nav aria-label="Filtrer les contreparties" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {FILTRES.map((choix) => (
          <Link
            key={choix.cle}
            href={choix.cle === "toutes" ? "/apps/partenaires/contreparties" : `/apps/partenaires/contreparties?filtre=${choix.cle}`}
            aria-current={cleFiltre === choix.cle ? "page" : undefined}
            className={`cible-tactile inline-flex shrink-0 items-center rounded-full border px-4 text-sm ${cleFiltre === choix.cle ? "border-marque bg-marque text-marque-texte" : "border-bordure"}`}
          >
            {choix.libelle}
          </Link>
        ))}
      </nav>

      {contreparties.length === 0 ? (
        <p className="text-texte-discret">Aucune contrepartie pour cette saison. Elles s&apos;ajoutent dans la fiche d&apos;une convention.</p>
      ) : visibles.length === 0 ? (
        <p className="text-texte-discret">Aucune contrepartie avec ce filtre.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {entreprises.map((entreprise) => {
            const lignes = groupes.get(entreprise) ?? []
            return (
              <section key={entreprise} aria-labelledby={`entreprise-${entreprise}`} className="flex flex-col gap-2">
                <h2 id={`entreprise-${entreprise}`} className="text-lg font-medium">
                  {entreprise}
                </h2>
                <ul className="flex flex-col gap-2">
                  {lignes.map((c) => (
                    <li key={c.id} className="flex flex-col gap-1 rounded-md border border-bordure bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex min-w-0 flex-col">
                        <Link href={`/apps/partenaires/conventions/${c.conventionId}#contrepartie-${c.id}`} className={`${LIEN} break-words`}>
                          {c.libelle}
                        </Link>
                        <span className="text-sm text-texte-discret">{LIBELLES_TYPE_CONTREPARTIE[c.type] ?? c.type}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span>
                          {c.quantiteTenue} sur {c.quantitePromise}
                        </span>
                        {c.echeance && <span className="text-texte-discret">Échéance {dateFrancaise(c.echeance)}</span>}
                        <span className={couleurContrepartie(c.statut, c.echeance, aujourdhui)}>{LIBELLES_STATUT_CONTREPARTIE[c.statut]}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <div>
        <Link href="/apps/partenaires" className={`${BOUTON_SECONDAIRE} inline-flex`}>
          Retour à la Prospection
        </Link>
      </div>
    </section>
  )
}
