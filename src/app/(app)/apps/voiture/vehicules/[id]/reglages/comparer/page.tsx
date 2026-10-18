import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/voiture/ecran"
import { FiltreEcarts } from "@/apps/voiture/composants/filtre-ecarts"
import { lireChampsMasques, lireReglage } from "@/apps/voiture/lectures-serveur"
import { dateEnToutesLettres, ecartSigne, valeurEnTexte } from "@/apps/voiture/libelles"
import { comparer, type ValeursReglage } from "@/apps/voiture/regles"
import { EcranVide } from "@/components/qg/ecran-vide"

// Comparaison de deux fiches de réglage du même véhicule. L'écart est B moins A : « +0,2 bar » veut dire que B
// a 0,2 bar de plus que A. Une ligne différente est en gras et surlignée ; l'écart porte le signe.
export default async function PageComparaison({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ a?: string; b?: string; ecarts?: string }>
}) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour aux véhicules", href: "/apps/voiture" }} />
  }
  const { id } = await params
  const { a, b, ecarts } = await searchParams
  if (!a || !b || a === b) notFound()

  const [ficheA, ficheB] = await Promise.all([lireReglage(a), lireReglage(b)])
  if (!ficheA || !ficheB || ficheA.fiche.vehicleId !== id || ficheB.fiche.vehicleId !== id) notFound()

  const masques = await lireChampsMasques()
  const seulsEcarts = ecarts !== "0"
  const valeursDe = (champs: typeof ficheA.champs): ValeursReglage =>
    Object.fromEntries(champs.filter((c) => c.valeur !== null).map((c) => [c.cle, c.valeur as string | number]))
  const lignes = comparer(valeursDe(ficheA.champs), valeursDe(ficheB.champs))
    .filter((ligne) => !masques.includes(ligne.cle))
    .filter((ligne) => !seulsEcarts || ligne.different)

  const titreA = `${dateEnToutesLettres(ficheA.fiche.date)} · ${ficheA.epreuve ?? "Sans épreuve"}`
  const titreB = `${dateEnToutesLettres(ficheB.fiche.date)} · ${ficheB.epreuve ?? "Sans épreuve"}`

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <Link href={`/apps/voiture/vehicules/${id}?onglet=reglages`} className="cible-tactile inline-flex items-center text-sm text-texte-discret">
        ← Réglages
      </Link>
      <h1 className="titre-rallye text-3xl">Comparaison</h1>

      <FiltreEcarts a={a} b={b} seulsEcarts={seulsEcarts} />

      {lignes.length === 0 ? (
        <p className="text-texte-discret">Aucun écart entre ces deux fiches.</p>
      ) : (
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Comparaison des fiches de réglage A et B</caption>
          <thead>
            <tr className="border-b border-bordure text-left align-bottom">
              <th scope="col" className="w-[34%] py-2 pr-2 font-medium">
                Champ
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                Fiche A
                <span className="block font-normal text-texte-discret">{titreA}</span>
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                Fiche B
                <span className="block font-normal text-texte-discret">{titreB}</span>
              </th>
              <th scope="col" className="w-[22%] py-2 font-medium">
                Écart
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.cle} className={`border-b border-bordure align-top ${ligne.different ? "bg-surface-2" : ""}`}>
                <th scope="row" className={`break-words py-2 pr-2 text-left ${ligne.different ? "font-semibold" : "font-normal"}`}>
                  {ligne.libelle}
                </th>
                <td className="break-words py-2 pr-2 tabular-nums">{ligne.a === null ? "—" : `${valeurEnTexte(ligne.a)}${ligne.unite ? ` ${ligne.unite}` : ""}`}</td>
                <td className="break-words py-2 pr-2 tabular-nums">{ligne.b === null ? "—" : `${valeurEnTexte(ligne.b)}${ligne.unite ? ` ${ligne.unite}` : ""}`}</td>
                <td className={`py-2 tabular-nums ${ligne.different ? "font-semibold" : ""}`}>{ecartDe(ligne.a, ligne.b, ligne.unite, ligne.different)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

// Écart B − A pour deux nombres ; « Différent » pour un texte ; « — » quand une valeur manque ou qu'il n'y a pas d'écart.
function ecartDe(a: string | number | null, b: string | number | null, unite: string, different: boolean): string {
  if (!different) return "—"
  if (typeof a === "number" && typeof b === "number") return ecartSigne(Math.round((b - a) * 100) / 100, unite)
  if (a === null || b === null) return "—"
  return "Différent"
}
