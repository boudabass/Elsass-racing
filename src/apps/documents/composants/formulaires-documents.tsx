"use client"

// Formulaires de Documents en tiroirs (brief 5.3, §5). Chaque tiroir envoie une action de ../actions.ts ; la garde
// (droits, visibilité) est dans le service. Un bouton refusé affiche sa raison, dans la page, jamais un bouton muet.

import { useState, type ReactNode } from "react"

import { ChampFichier } from "@/components/formulaire/champ-fichier"
import { TiroirAction } from "@/components/formulaire/tiroir"
import { CHAMP } from "@/lib/classes-formulaire"

import {
  ajouterVersionAction,
  archiverDocumentAction,
  creerDocumentAction,
  deplacerDocumentAction,
  modifierDocumentAction,
  partagerDocumentAction,
  remettreEnServiceAction,
  retirerAccesAction,
} from "../actions"
import { LIBELLE_NIVEAU_ACCES, LIBELLE_TYPE_DOCUMENT, LIBELLE_VISIBILITE } from "../libelles"
import type { FicheDocument, AccesLigne } from "../lectures-serveur"
import { NIVEAUX_ACCES_INTERNE, TYPES_DOCUMENT, VISIBILITES } from "../regles"

function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{libelle}</span>
      {children}
    </label>
  )
}

export type ValeursDocument = Pick<FicheDocument, "titre" | "typeDocument" | "reference" | "dateEmission" | "dateValidite" | "notes" | "visibilite">

function ChampsDocument({ valeurs, rangement, dossierDefaut }: { valeurs?: ValeursDocument; rangement?: Array<{ param: string; nom: string }>; dossierDefaut?: string }) {
  const [fichier, setFichier] = useState<string | null>(null)
  return (
    <>
      <Champ libelle="Titre">
        <input name="titre" required maxLength={160} defaultValue={valeurs?.titre ?? ""} className={CHAMP} />
      </Champ>
      <Champ libelle="Type de document">
        <select name="typeDocument" aria-label="Type de document" required defaultValue={valeurs?.typeDocument ?? ""} className={CHAMP}>
          {!valeurs && (
            <option value="" disabled>
              Choisir un type
            </option>
          )}
          {TYPES_DOCUMENT.map((type) => (
            <option key={type} value={type}>
              {LIBELLE_TYPE_DOCUMENT[type]}
            </option>
          ))}
        </select>
      </Champ>
      {rangement && (
        <Champ libelle="Dossier">
          <select name="dossier" aria-label="Dossier" required defaultValue={dossierDefaut ?? ""} className={CHAMP}>
            {!dossierDefaut && (
              <option value="" disabled>
                Choisir un dossier
              </option>
            )}
            {rangement.map((dossier) => (
              <option key={dossier.param} value={dossier.param}>
                {dossier.nom}
              </option>
            ))}
          </select>
        </Champ>
      )}
      <Champ libelle="Référence (facultative)">
        <input name="reference" maxLength={120} defaultValue={valeurs?.reference ?? ""} className={CHAMP} />
      </Champ>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Champ libelle="Date d'émission">
          <input type="date" name="dateEmission" defaultValue={valeurs?.dateEmission ?? ""} className={CHAMP} />
        </Champ>
        <Champ libelle="Date de validité">
          <input type="date" name="dateValidite" defaultValue={valeurs?.dateValidite ?? ""} className={CHAMP} />
        </Champ>
      </div>
      <Champ libelle="Qui peut voir">
        <select name="visibilite" aria-label="Qui peut voir" defaultValue={valeurs?.visibilite ?? "team"} className={CHAMP}>
          {VISIBILITES.map((visibilite) => (
            <option key={visibilite} value={visibilite}>
              {LIBELLE_VISIBILITE[visibilite]}
            </option>
          ))}
        </select>
      </Champ>
      <Champ libelle="Notes (facultatives)">
        <textarea name="notes" rows={3} maxLength={2000} defaultValue={valeurs?.notes ?? ""} className={CHAMP} />
      </Champ>
      {!valeurs && (
        <ChampFichier app="documents" libelle="Fichier (facultatif)" valeur={fichier} name="fichierId" onChange={(f) => setFichier(f?.id ?? null)} />
      )}
    </>
  )
}

export function NouveauDocument({ rangement, dossierDefaut, libelle = "Document" }: { rangement: Array<{ param: string; nom: string }>; dossierDefaut?: string; libelle?: string }) {
  return (
    <TiroirAction
      libelle={libelle}
      secondaire={false}
      titre="Nouveau document"
      sousTitre="Titre, type et dates se saisissent à la main. Sans fichier, le document se crée quand même : le fichier s'ajoute ensuite."
      action={creerDocumentAction}
      libelleBouton="Ajouter le document"
      libelleEnCours="Ajout…"
    >
      <ChampsDocument rangement={rangement} dossierDefaut={dossierDefaut} />
    </TiroirAction>
  )
}

export function ModifierDocument({ fiche }: { fiche: FicheDocument }) {
  return (
    <TiroirAction libelle="Modifier" titre="Modifier le document" action={modifierDocumentAction} libelleBouton="Enregistrer" libelleEnCours="Enregistrement…" desactive={!fiche.gestes.modifier.permis} >
      <input type="hidden" name="id" value={fiche.id} />
      <ChampsDocument valeurs={fiche} />
    </TiroirAction>
  )
}

export function AjouterVersion({ fiche, libelle }: { fiche: FicheDocument; libelle: string }) {
  const [fichier, setFichier] = useState<string | null>(null)
  return (
    <TiroirAction
      libelle={libelle}
      titre={libelle}
      sousTitre="Le nouveau fichier devient la version en cours. L'ancien reste consultable dans l'historique."
      action={ajouterVersionAction}
      libelleBouton="Enregistrer le fichier"
      libelleEnCours="Envoi…"
      desactive={!fiche.gestes.remplacer.permis || fichier === null}
    >
      <input type="hidden" name="id" value={fiche.id} />
      <ChampFichier app="documents" libelle="Nouveau fichier" valeur={fichier} name="fichierId" onChange={(f) => setFichier(f?.id ?? null)} />
      <Champ libelle="Commentaire (facultatif)">
        <input name="commentaire" maxLength={300} className={CHAMP} />
      </Champ>
    </TiroirAction>
  )
}

export function DeplacerDocument({ fiche, rangement }: { fiche: FicheDocument; rangement: Array<{ param: string; nom: string }> }) {
  return (
    <TiroirAction libelle="Déplacer" titre="Déplacer le document" action={deplacerDocumentAction} libelleBouton="Déplacer" libelleEnCours="Déplacement…" desactive={!fiche.gestes.deplacer.permis}>
      <input type="hidden" name="id" value={fiche.id} />
      <Champ libelle="Nouveau dossier">
        <select name="dossier" aria-label="Nouveau dossier" required defaultValue={fiche.dossierParam} className={CHAMP}>
          {rangement.map((dossier) => (
            <option key={dossier.param} value={dossier.param}>
              {dossier.nom}
            </option>
          ))}
        </select>
      </Champ>
    </TiroirAction>
  )
}

export function ArchiverOuRemettre({ fiche }: { fiche: FicheDocument }) {
  const archive = fiche.statut === "archive"
  // Remettre en service se contrôle comme une modification (services-serveur.ts, changerStatut).
  const geste = archive ? fiche.gestes.modifier : fiche.gestes.archiver
  return (
    <TiroirAction
      libelle={archive ? "Remettre en service" : "Archiver"}
      titre={archive ? "Remettre en service" : "Archiver le document"}
      question={
        archive
          ? "Le document reviendra dans les cartes, les compteurs et la jauge du dossier."
          : "Le document sortira des cartes, des compteurs et de la jauge. Tu le retrouveras dans « Archivés », et tu pourras le remettre en service."
      }
      action={archive ? remettreEnServiceAction : archiverDocumentAction}
      libelleBouton={archive ? "Remettre en service" : "Archiver"}
      libelleEnCours="Enregistrement…"
      desactive={!geste.permis}
      secondaire
    >
      <input type="hidden" name="id" value={fiche.id} />
    </TiroirAction>
  )
}

export function PartagerDocument({ fiche, personnes }: { fiche: FicheDocument; personnes: Array<{ id: string; nom: string }> }) {
  return (
    <TiroirAction
      libelle="Partager avec un membre"
      titre="Partager avec un membre"
      sousTitre="Seules les personnes qui ont un compte dans la team apparaissent. Le partage se retire à tout moment."
      action={partagerDocumentAction}
      libelleBouton="Partager"
      libelleEnCours="Partage…"
      desactive={!fiche.gestes.partager.permis || personnes.length === 0}
    >
      <input type="hidden" name="id" value={fiche.id} />
      <Champ libelle="Membre">
        <select name="personneId" aria-label="Membre" required className={CHAMP} defaultValue="">
          <option value="" disabled>
            Choisir un membre
          </option>
          {personnes.map((personne) => (
            <option key={personne.id} value={personne.id}>
              {personne.nom}
            </option>
          ))}
        </select>
      </Champ>
      <Champ libelle="Ce qu'il peut faire">
        <select name="niveau" aria-label="Ce qu'il peut faire" required defaultValue="lecture" className={CHAMP}>
          {NIVEAUX_ACCES_INTERNE.map((niveau) => (
            <option key={niveau} value={niveau}>
              {LIBELLE_NIVEAU_ACCES[niveau]}
            </option>
          ))}
        </select>
      </Champ>
    </TiroirAction>
  )
}

export function RetirerPartage({ acces }: { acces: AccesLigne }) {
  return (
    <TiroirAction
      libelle="Retirer"
      titre="Retirer le partage"
      question={`${acces.nom} ne verra plus ce document. Tu peux le partager de nouveau à tout moment.`}
      action={retirerAccesAction}
      libelleBouton="Retirer le partage"
      libelleEnCours="Retrait…"
      danger
    >
      <input type="hidden" name="id" value={acces.id} />
    </TiroirAction>
  )
}
