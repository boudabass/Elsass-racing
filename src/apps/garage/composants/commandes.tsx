// Écran des commandes (tâche 4.3, brief §5) : les livraisons attendues en tête, avec leur barre et leur retard en mots,
// puis les commandes reçues. Rendu côté serveur ; les boutons d'expédition et de réception sont des tiroirs client.
// Écriture seulement : la page refuse tout autre niveau (l'assistance n'a pas de commande).

import Link from "next/link"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { formatEuros } from "@/lib/euros"
import { BOUTON } from "@/lib/classes-formulaire"

import { ChoixVehicule } from "./atelier"
import { expedierCommandeAction, recevoirCommandeAction } from "../actions"
import { avancementLivraison, comparerLivraisons, LIBELLE_STATUT_COMMANDE, libelleRetard, receptionPossible } from "../commandes"
import type { CommandeAtelier, VehiculeChoisi } from "../lectures-serveur"
import { LIBELLE_QUALITE } from "../libelles"

export interface CommandesEcranProps {
  vehicules: VehiculeChoisi[]
  choisi: VehiculeChoisi
  commandes: CommandeAtelier[]
  // Date de Paris, « AAAA-MM-JJ » : la référence de la barre et du retard.
  aujourdhui: string
}

// « 2026-10-11 » -> « 11/10/2026 » (lecture seule : pas de fuseau, c'est une date civile).
function dateFr(date: string): string {
  const [annee, mois, jour] = date.split("-")
  return `${jour}/${mois}/${annee}`
}

export function CommandesEcran({ vehicules, choisi, commandes, aujourdhui }: CommandesEcranProps) {
  const attendues = commandes.filter((c) => receptionPossible(c.statut)).sort((a, b) => comparerLivraisons(a.livraisonPrevueLe, b.livraisonPrevueLe))
  const recues = commandes
    .filter((c) => !receptionPossible(c.statut))
    .sort((a, b) => (b.recueLe ?? "").localeCompare(a.recueLe ?? ""))

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="titre-rallye text-3xl">Commandes</h1>
        {vehicules.length > 1 && <ChoixVehicule vehicules={vehicules} choisi={choisi.id} chemin="/apps/garage/commandes" />}
        <Link href={`/apps/garage/commandes/nouvelle?vehicule=${choisi.id}`} className={`${BOUTON} self-start`}>
          Nouvelle commande
        </Link>
      </header>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Livraisons attendues ({attendues.length})</h2>
        {attendues.length === 0 ? (
          <p className="text-texte-discret">Aucune commande en attente pour cette voiture.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {attendues.map((commande) => (
              <CarteCommande key={commande.id} commande={commande} aujourdhui={aujourdhui} />
            ))}
          </ul>
        )}
      </div>

      {recues.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Reçues ({recues.length})</h2>
          <ul className="flex flex-col gap-3">
            {recues.map((commande) => (
              <CarteCommande key={commande.id} commande={commande} aujourdhui={aujourdhui} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function CarteCommande({ commande, aujourdhui }: { commande: CommandeAtelier; aujourdhui: string }) {
  const attendue = receptionPossible(commande.statut)
  const barre = avancementLivraison(commande.commandeeLe, commande.livraisonPrevueLe, aujourdhui)
  const retard = attendue ? libelleRetard(commande.livraisonPrevueLe, aujourdhui) : null

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-bordure bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{commande.fournisseurNom}</h3>
        <span className="text-sm font-medium">{LIBELLE_STATUT_COMMANDE[commande.statut]}</span>
      </div>

      <p className="text-sm text-texte-discret">
        Commandée le <span className="chiffre">{dateFr(commande.commandeeLe)}</span>
        {commande.livraisonPrevueLe ? (
          <>
            {" "}· livraison prévue le <span className="chiffre">{dateFr(commande.livraisonPrevueLe)}</span>
          </>
        ) : (
          " · pas de date de livraison"
        )}
        {commande.recueLe && (
          <>
            {" "}· reçue le <span className="chiffre">{dateFr(commande.recueLe)}</span>
          </>
        )}
      </p>

      {attendue && (
        <>
          <div
            role="progressbar"
            aria-label="Avancement de la livraison"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={barre}
            className="h-2 overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full bg-marque" style={{ width: `${barre}%` }} />
          </div>
          {retard && <p className="text-sm font-medium">{retard}</p>}
        </>
      )}

      <ul className="flex flex-col gap-1 text-sm">
        {commande.lignes.map((ligne) => (
          <li key={ligne.id}>
            <span className="chiffre">{ligne.quantite} ×</span> {ligne.designation}
            {ligne.organeNom && <span className="text-texte-discret"> ({ligne.organeNom}, {LIBELLE_QUALITE[ligne.qualite]})</span>}
            {ligne.reference && <span className="text-texte-discret"> · réf. {ligne.reference}</span>}
            <span className="chiffre"> · {formatEuros(ligne.prixUnitaireCents)}</span>
          </li>
        ))}
      </ul>
      <p className="chiffre text-sm font-semibold">Total {formatEuros(commande.totalCents)}</p>

      {attendue && (
        <div className="flex flex-wrap gap-2">
          {commande.statut === "commandee" && (
            <TiroirAction
              libelle="Marquer expédiée"
              titre="Commande expédiée"
              question="La commande est partie chez le fournisseur. Rien n'entre encore en stock."
              action={expedierCommandeAction}
              libelleBouton="Marquer expédiée"
              libelleEnCours="Enregistrement…"
            >
              <input type="hidden" name="id" value={commande.id} />
            </TiroirAction>
          )}
          <TiroirAction
            libelle="Recevoir"
            titre="Recevoir la commande"
            question="Une pièce par unité entre en stock, avec son prix et son fournisseur. Une commande reçue ne se reçoit plus."
            action={recevoirCommandeAction}
            libelleBouton="Recevoir la commande"
            libelleEnCours="Réception…"
          >
            <input type="hidden" name="id" value={commande.id} />
          </TiroirAction>
        </div>
      )}
    </li>
  )
}
