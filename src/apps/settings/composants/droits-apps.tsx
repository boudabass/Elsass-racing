import { APPS } from "@/core/catalogue"
import { NIVEAUX, niveauEffectif, type Niveau } from "@/core/droits/niveaux"
import { contexteQg } from "@/core/qg/donnees"
import { prisma, prismaPourTeam } from "@/lib/prisma"
import { ActionDirecte } from "@/components/formulaire/action-directe"
import { TiroirAction } from "@/components/formulaire/tiroir"
import { Label } from "@/components/ui/label"
import { CHAMP } from "@/lib/classes-formulaire"

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

// Droits par membre : une carte par membre, avec le niveau effectif de chaque app. Une exception au rôle
// est écrite (« exception »), pas seulement surlignée. « Modifier les droits » ouvre un tiroir à sélecteurs.
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
        const niveaux = APPS.map((app) => {
          const effectif = niveauEffectif({ role: m.role, appCle: app.cle, acces: exceptions, defauts })
          const defaut = defauts.find((d) => d.role === m.role && d.appCle === app.cle)?.niveau ?? "aucun"
          return { app, effectif, defaut, different: effectif !== defaut }
        })
        return (
          <section key={m.id} className="rounded-lg border border-bordure bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">{nom}</h3>
              <span className="text-sm text-texte-discret">{m.role}</span>
            </div>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {niveaux.map(({ app, effectif, different }) => (
                <div key={app.cle} className="flex justify-between gap-3">
                  <dt className="text-sm text-texte-discret">{app.nom}</dt>
                  <dd className="text-sm">
                    {LIBELLES_NIVEAU[effectif]}
                    {different && " · exception"}
                  </dd>
                </div>
              ))}
            </dl>
            {peutModifier ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <TiroirAction libelle="Modifier les droits" titre={`Droits de ${nom}`} action={sauverDroitsMembre} libelleBouton="Enregistrer les droits">
                  <input type="hidden" name="membershipId" value={m.id} />
                  {niveaux.map(({ app, effectif, defaut }) => (
                    <div key={app.cle} className="flex flex-col gap-1">
                      <Label htmlFor={`${m.id}-${app.cle}`} className="text-sm">{app.nom}</Label>
                      <select id={`${m.id}-${app.cle}`} name={`niveau_${app.cle}`} defaultValue={effectif} className={CHAMP}>
                        {NIVEAUX.map((n) => (
                          <option key={n} value={n}>{LIBELLES_NIVEAU[n]}{n === defaut ? " (rôle)" : ""}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </TiroirAction>
                {exceptions.length > 0 && (
                  <ActionDirecte
                    libelle="Revenir aux droits du rôle"
                    action={revenirAuxDroitsDuRole}
                    champs={{ membershipId: m.id }}
                    ok="Droits du rôle rétablis."
                  />
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-texte-discret">{raison}</p>
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
              <div className="flex flex-wrap items-start gap-2">
                <ActionDirecte
                  libelle="Monter"
                  action={deplacerApp}
                  champs={{ appCle: app.cle, sens: "monter" }}
                  desactive={index === 0}
                  ok="Ordre mis à jour."
                />
                <ActionDirecte
                  libelle="Descendre"
                  action={deplacerApp}
                  champs={{ appCle: app.cle, sens: "descendre" }}
                  desactive={index === lignes.length - 1}
                  ok="Ordre mis à jour."
                />
                <ActionDirecte
                  libelle={ligne.activee ? "Désactiver" : "Activer"}
                  action={basculerApp}
                  champs={{ appCle: app.cle, activer: ligne.activee ? "0" : "1" }}
                  variante={ligne.activee ? "secondaire" : "principale"}
                  desactive={bloquee}
                  ok={ligne.activee ? "App désactivée." : "App activée."}
                />
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
      <p>Proposer le mode terrain le jour d'une épreuve : {propose ? "oui" : "non"}</p>
      {peutModifier ? (
        <TiroirAction libelle="Modifier le jour d'épreuve" titre="Jour d'épreuve" action={sauverJourEpreuve} libelleBouton="Enregistrer">
          <label className="flex items-center gap-3">
            <input type="checkbox" name="terrainProposeJourEpreuve" value="1" defaultChecked={propose} className="h-5 w-5" />
            <span>Proposer le mode terrain le jour d'une épreuve</span>
          </label>
        </TiroirAction>
      ) : (
        <p className="text-sm text-texte-discret">{raison}</p>
      )}
    </section>
  )
}
