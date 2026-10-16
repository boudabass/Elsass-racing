"use client"

import { useActionState } from "react"

import { demanderLienAction, validerCodeAction } from "@/core/auth/actions"
import type { EtatConnexion } from "@/core/auth/etat-connexion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const messageLien = "Le lien n'est plus valable. Demande un nouveau lien ou saisis le code."

export function FormulaireConnexion({ erreurInitiale }: { erreurInitiale?: string }) {
  const [etatEmail, actionEmail, enCoursEmail] = useActionState<EtatConnexion, FormData>(
    demanderLienAction,
    { etape: "email", erreur: erreurInitiale === "lien" ? messageLien : undefined },
  )
  const [etatCode, actionCode, enCoursCode] = useActionState<EtatConnexion, FormData>(
    validerCodeAction,
    { etape: "code" },
  )

  if (etatEmail.etape === "email") {
    return (
      <form action={actionEmail} className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Adresse e-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        {etatEmail.erreur && (
          <p role="alert" className="text-sm text-destructive">
            {etatEmail.erreur}
          </p>
        )}
        <Button type="submit" disabled={enCoursEmail}>
          Recevoir mon lien
        </Button>
      </form>
    )
  }

  const email = etatCode.email ?? etatEmail.email ?? ""
  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-base">Regarde ta boîte mail. Tu y trouveras un lien et un code à 6 chiffres.</p>
      <form action={actionCode} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">Code à 6 chiffres</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
        </div>
        {etatCode.erreur && (
          <p role="alert" className="text-sm text-destructive">
            {etatCode.erreur}
          </p>
        )}
        <Button type="submit" disabled={enCoursCode}>
          Valider
        </Button>
      </form>
    </div>
  )
}
