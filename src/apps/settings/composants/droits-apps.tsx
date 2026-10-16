import { APPS } from "@/core/catalogue"
import { NIVEAUX, niveauEffectif, type Niveau } from "@/core/droits/niveaux"
import { contexteQg } from "@/core/qg/donnees"
import { prisma, prismaPourTeam } from "@/lib/prisma"
import { Label } from "@/components/ui/label"

import { basculerApp, deplacerApp, revenirAuxDroitsDuRole, sauverDroitsMembre, sauverJourEpreuve } from "../actions"
import { peutDesactiver } from "../droits-regles"
import { terrainProposeJourEpreuve } from "../preferences-serveur"

type Contexte = Awaited<ReturnType<typeof contexteQg>>["contexte"]

const LIBELLES_NIVEAU: Record<Niveau, string> = {
  aucun: "Aucun",
  lecture: "Lecture",
  contribution: "Contribution",
  ecriture: "Écriture",
  gestion: "Gestion",
}

// Matrice membres × apps : une carte par membre, un sélecteur de niveau par app. Une case
// différente du défaut du rôle est surlignée. Revenir au rôle supprime les exceptions.
export async function Droits({ contexte, peutModifier, raison }: { contexte: Contexte; peutModifier: boolean; raison: string }) {
  const client = prismaPourTeam(contexte.teamId, contexte.userId)
  const [membres, acces, defauts] = await Promise.all([
    client.coreMembership.findMany({
      where: { teamId: contexte.teamId, statut: { not: "parti" } },
      include: { user: { select: { email: true } }, person: { select: { prenom: true, nom: true } } },
      orderBy: { createdAt: "asc" },
    }),
    client.coreAppAccess.findMany({ where: { teamId: contexte.teamId }, select: { membershipId: true, appCle: true, niveau: true } }),
    prisma.coreRoleDefault.findMany({ select: { role: true, appCle: true, niveau: true } }),
  ])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texte-discret">Un responsable garde toujours la gestion de Réglages.</p>
      {membres.map((m) => {
        const nom = m.person ? `${m.person.prenom} ${m.person.nom}` : m.user.email
        const exceptions = acces.filter((a) => a.membershipId === m.id)
        return (
          <section key={m.id} className="rounded-lg border border-bordure bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">{nom}</h3>
              <span className="text-sm text-texte-discret">{m.role}</span>
            </div>
            <form action={sauverDroitsMembre} className="flex flex-col gap-3">
              <input type="hidden" name="membershipId" value={m.id} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {APPS.map((app) => {
                  const effectif = niveauEffectif({ role: m.role, appCle: app.cle, acces: exceptions, defauts })
                  const defaut = defauts.find((d) => d.role === m.role && d.appCle === app.cle)?.niveau ?? "aucun"
                  const different = effectif !== defaut
                  return (
                    <div key={app.cle} className={`flex flex-col gap-1 rounded-md p-2 ${different ? "ring-1 ring-marque" : ""}`}>
                      <Label htmlFor={`${m.id}-${app.cle}`} className="text-sm">{app.nom}</Label>
                      {/* La clé inclut le niveau effectif : après un enregistrement ou un retour au rôle,
                          le sélecteur est remonté avec la nouvelle valeur (un select non contrôlé
                          garderait sinon l'ancienne valeur affichée). */}
                      <select
                        key={`${app.cle}-${effectif}`}
                        id={`${m.id}-${app.cle}`}
                        name={`niveau_${app.cle}`}
                        defaultValue={effectif}
                        disabled={!peutModifier}
                        className="cible-tactile rounded-md border border-bordure bg-fond px-2"
                      >
                        {NIVEAUX.map((n) => (
                          <option key={n} value={n}>{LIBELLES_NIVEAU[n]}{n === defaut ? " (rôle)" : ""}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
              {peutModifier ? (
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="cible-tactile rounded-md bg-marque px-4 py-2 font-medium text-white hover:opacity-90">Enregistrer</button>
                </div>
              ) : (
                <p className="text-sm text-texte-discret">{raison}</p>
              )}
            </form>
            {peutModifier && exceptions.length > 0 && (
              <form action={revenirAuxDroitsDuRole} className="mt-2">
                <input type="hidden" name="membershipId" value={m.id} />
                <button type="submit" className="cible-tactile rounded-md border border-bordure px-3 py-1 text-sm hover:bg-surface-2">Revenir aux droits du rôle</button>
              </form>
            )}
          </section>
        )
      })}
    </div>
  )
}

// Apps : activation, ordre (monter et descendre ; le glisser-déposer viendra plus tard),
// et refus de désactiver une app requise par une autre activée.
export async function Apps({ contexte, peutModifier, raison }: { contexte: Contexte; peutModifier: boolean; raison: string }) {
  const lignes = await prismaPourTeam(contexte.teamId, contexte.userId).coreTeamApp.findMany({
    where: { teamId: contexte.teamId, deletedAt: null },
    select: { appCle: true, activee: true, ordre: true },
    orderBy: { ordre: "asc" },
  })
  const activees = lignes.filter((l) => l.activee).map((l) => l.appCle)

  return (
    <ul className="flex flex-col gap-2">
      {lignes.map((ligne, index) => {
        const app = APPS.find((a) => a.cle === ligne.appCle)
        if (!app) return null
        const verdict = ligne.activee ? peutDesactiver(app.cle, activees) : { ok: true as const }
        const bloquee = ligne.activee && !verdict.ok
        return (
          <li key={app.cle} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bordure bg-surface p-3">
            <div className="flex flex-col">
              <span className="font-medium">{app.nom}</span>
              <span className="text-sm text-texte-discret">{ligne.activee ? "Activée" : "Désactivée"}</span>
              {bloquee && !verdict.ok && <span className="text-xs text-texte-discret">{verdict.raison}</span>}
            </div>
            {peutModifier ? (
              <div className="flex flex-wrap items-center gap-2">
                <form action={deplacerApp}>
                  <input type="hidden" name="appCle" value={app.cle} />
                  <input type="hidden" name="sens" value="monter" />
                  <button type="submit" disabled={index === 0} className="cible-tactile rounded-md border border-bordure px-3 hover:bg-surface-2 disabled:opacity-40">Monter</button>
                </form>
                <form action={deplacerApp}>
                  <input type="hidden" name="appCle" value={app.cle} />
                  <input type="hidden" name="sens" value="descendre" />
                  <button type="submit" disabled={index === lignes.length - 1} className="cible-tactile rounded-md border border-bordure px-3 hover:bg-surface-2 disabled:opacity-40">Descendre</button>
                </form>
                <form action={basculerApp}>
                  <input type="hidden" name="appCle" value={app.cle} />
                  <input type="hidden" name="activer" value={ligne.activee ? "0" : "1"} />
                  <button type="submit" disabled={bloquee} className="cible-tactile rounded-md bg-marque px-3 font-medium text-white hover:opacity-90 disabled:opacity-40">
                    {ligne.activee ? "Désactiver" : "Activer"}
                  </button>
                </form>
              </div>
            ) : (
              <span className="text-sm text-texte-discret">{raison}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// Interrupteur de la team : proposer le mode terrain le jour d'une épreuve (responsable).
export async function JourEpreuve({ contexte, peutModifier, raison }: { contexte: Contexte; peutModifier: boolean; raison: string }) {
  const propose = await terrainProposeJourEpreuve(contexte)
  return (
    <section className="flex max-w-xl flex-col gap-3 border-t border-bordure pt-6">
      <h3 className="titre-rallye text-xl">Jour d'épreuve</h3>
      <form action={sauverJourEpreuve} className="flex flex-col gap-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" name="terrainProposeJourEpreuve" value="1" defaultChecked={propose} disabled={!peutModifier} className="h-5 w-5" />
          <span>Proposer le mode terrain le jour d'une épreuve</span>
        </label>
        {peutModifier ? (
          <button type="submit" className="cible-tactile w-fit rounded-md bg-marque px-5 py-2 font-medium text-white hover:opacity-90">Enregistrer</button>
        ) : (
          <p className="text-sm text-texte-discret">{raison}</p>
        )}
      </form>
    </section>
  )
}
