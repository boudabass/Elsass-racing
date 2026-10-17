import { LIBELLE_STATUT_RESULTAT } from "@/apps/saison/libelles"
import { formatEuros } from "@/lib/euros"

// Écran de fin d'épreuve : construit uniquement avec des données validées et existantes.
// Garde-fous de l'article 953 : du positif seulement, rien de bloquant. Le coût n'apparaît pas
// tant que Budget n'existe pas (pas de zéro trompeur).

export function FinEpreuve({
  epreuve,
  statutFinal,
  classementGeneral,
  classementClasse,
  nbPartantsClasse,
  kmChronometres,
  kmSaison,
  aDebrief,
  peutDebriefer,
  sansPreuve,
  coutEpreuve,
}: {
  epreuve: string
  statutFinal: string
  classementGeneral: number | null
  classementClasse: number | null
  nbPartantsClasse: number | null
  kmChronometres: string | null
  kmSaison: number
  aDebrief: boolean
  peutDebriefer: boolean
  sansPreuve: boolean
  // Coût de l'épreuve (centimes), fourni par Budget ; null tant qu'aucune dépense ne la concerne.
  coutEpreuve: number | null
}) {
  return (
    <section aria-labelledby="fin-epreuve" className="flex flex-col gap-3 rounded-lg border border-etat-ok bg-surface p-4">
      <h2 id="fin-epreuve" className="font-titre text-xl uppercase">
        Débrief de l'épreuve
      </h2>
      <p className="text-sm text-texte-discret">{epreuve}</p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <dt className="text-texte-discret">Résultat officiel</dt>
        <dd className="font-medium">
          {LIBELLE_STATUT_RESULTAT[statutFinal as keyof typeof LIBELLE_STATUT_RESULTAT] ?? statutFinal}
          {sansPreuve ? " · sans preuve" : ""}
        </dd>
        <dt className="text-texte-discret">Classement général</dt>
        <dd className="tabular-nums">{classementGeneral ?? "—"}</dd>
        <dt className="text-texte-discret">Classement de classe</dt>
        <dd className="tabular-nums">
          {classementClasse ?? "—"}
          {classementClasse && nbPartantsClasse ? ` sur ${nbPartantsClasse}` : ""}
        </dd>
        <dt className="text-texte-discret">Km chronométrés</dt>
        <dd className="tabular-nums">{kmChronometres ? `${kmChronometres} km` : "—"}</dd>
        {coutEpreuve !== null && (
          <>
            <dt className="text-texte-discret">Coût de l'épreuve</dt>
            <dd className="tabular-nums">{formatEuros(coutEpreuve)}</dd>
          </>
        )}
        <dt className="text-texte-discret">Total de la saison</dt>
        <dd className="tabular-nums">{kmSaison.toFixed(1)} km chronométrés</dd>
      </dl>
      {peutDebriefer && !aDebrief && (
        <p className="text-sm">Saisis ton débrief ci-dessous : ton ressenti aide la team pour la suite.</p>
      )}
      {aDebrief && <p className="text-sm text-texte-discret">Ton débrief est enregistré.</p>}
    </section>
  )
}
