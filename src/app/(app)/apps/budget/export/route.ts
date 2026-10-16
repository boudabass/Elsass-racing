import { NextResponse } from "next/server"

import { accesEcran } from "@/apps/budget/ecran"
import { csvMouvements } from "@/apps/budget/csv"
import { listerMouvements } from "@/apps/budget/lectures-serveur"
import { libelle } from "@/apps/budget/libelles"

// Export tableur des mouvements filtrés : même filtres que l'écran (URL), CSV à point-virgule en UTF-8
// avec BOM. Le PDF de bilan attend le lot 3. La contribution n'exporte que ses propres dépenses.

export async function GET(requete: Request): Promise<Response> {
  const acces = await accesEcran("contribution")
  if (!acces.ok) return new NextResponse("Accès refusé.", { status: 403 })

  const parametres = new URL(requete.url).searchParams
  const { mouvements } = await listerMouvements({
    saisonId: parametres.get("saison") || null,
    eventId: parametres.get("epreuve") || null,
    categorieId: parametres.get("categorie") || null,
    personneId: parametres.get("membre") || null,
  })

  const csv = csvMouvements(
    mouvements.map((mouvement) => ({
      date: mouvement.date,
      sens: libelle("BudgetSens", mouvement.type === "depense" ? "depense" : "recette"),
      libelle: mouvement.libelle,
      categorie: mouvement.categorieNom,
      payeur: mouvement.payeurNom ?? "",
      montantCentimes: mouvement.montantCentimes,
      statut:
        mouvement.type === "depense"
          ? mouvement.statut === "confirmee"
            ? "Confirmée"
            : "À confirmer"
          : libelle("BudgetStatutRecette", mouvement.statut),
    })),
  )

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="budget-mouvements.csv"',
    },
  })
}
