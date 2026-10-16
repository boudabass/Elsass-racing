import Link from "next/link"

import { BOUTON, MONTANT } from "./classes"
import { lireDepensesEpreuve } from "../liaisons-serveur"
import { formatEuros } from "../libelles"

// Onglet « Dépenses » de la fiche épreuve de Saison (composant serveur de Budget). Saison ne lit pas les
// tables de Budget : elle affiche ce composant, qui appelle la fonction exposée par Budget. La contribution
// ne voit que ses propres dépenses.
export async function PanneauDepensesEpreuve({ eventId }: { eventId: string }) {
  const donnees = await lireDepensesEpreuve(eventId)
  return (
    <section className="flex flex-col gap-5" aria-label="Dépenses de l'épreuve">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-texte-discret">
          Total des dépenses confirmées :{" "}
          <span className={`${MONTANT} text-base text-texte`}>{formatEuros(donnees.totalCentimes)}</span>
          {donnees.prevuCentimes !== null && (
            <>
              {" · prévu "}
              <span className={MONTANT}>{formatEuros(donnees.prevuCentimes)}</span>
            </>
          )}
        </p>
        <Link href={`/apps/budget/nouvelle?epreuve=${eventId}`} className={BOUTON}>
          Ajouter une dépense
        </Link>
      </div>

      {donnees.parCategorie.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {donnees.parCategorie.map((ligne) => (
            <li key={ligne.nom} className="flex items-center justify-between gap-3">
              <span>{ligne.nom}</span>
              <span className={MONTANT}>{formatEuros(ligne.montantCentimes)}</span>
            </li>
          ))}
        </ul>
      )}

      {donnees.depenses.length === 0 ? (
        <p className="text-sm text-texte-discret">Aucune dépense pour cette épreuve.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-bordure rounded-lg border border-bordure bg-surface">
          {donnees.depenses.map((depense) => (
            <li key={depense.id}>
              <Link href={`/apps/budget/mouvement/${depense.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{depense.libelle}</span>
                  <span className="text-xs text-texte-discret">
                    {depense.date} · {depense.categorieNom}
                    {depense.payeurNom ? ` · ${depense.payeurNom}` : ""}
                  </span>
                </span>
                <span className={`${MONTANT} shrink-0`}>{formatEuros(depense.montantCentimes)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
