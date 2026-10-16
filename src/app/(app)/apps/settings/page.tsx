import { redirect } from "next/navigation"

// Réglages s'ouvre sur l'identité de la team.
export default function PageReglages() {
  redirect("/apps/settings/identite")
}
