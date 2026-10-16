import nodemailer from "nodemailer"

// Envoi de mail. En production, SMTP_HOST est obligatoire : pas de repli console,
// l'erreur est explicite au premier envoi. Hors production sans SMTP_HOST, le mail
// est affiché dans la console du serveur, pour travailler sans serveur SMTP.

export interface MailSortant {
  a: string
  sujet: string
  texte: string
  html?: string
}

const expediteurParDefaut = "Elsass Racing <info@theelsassisch.com>"

let transport: nodemailer.Transporter | null = null

// En production, le transport est gardé en cache. Hors production, il est recréé à chaque
// envoi : une modification de .env.local est prise en compte sans redémarrer le serveur.
function transportSmtp(): nodemailer.Transporter {
  const enProduction = process.env.NODE_ENV === "production"
  if (enProduction && transport) return transport
  const port = Number(process.env.SMTP_PORT ?? 587)
  // Port 465 : TLS direct. Autres ports (587) : connexion en clair, puis STARTTLS imposé.
  const tlsDirect = port === 465
  const cree = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: tlsDirect,
    requireTLS: !tlsDirect,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  })
  if (enProduction) transport = cree
  return cree
}

export async function envoyerMail({ a, sujet, texte, html }: MailSortant): Promise<void> {
  const expediteur = process.env.MAIL_FROM ?? expediteurParDefaut

  if (!process.env.SMTP_HOST) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP_HOST absent en production : impossible d'envoyer le mail.")
    }
    console.log(`\n--- Mail (console, SMTP_HOST absent) ---\nDe : ${expediteur}\nÀ : ${a}\nSujet : ${sujet}\n\n${texte}\n---\n`)
    return
  }

  await transportSmtp().sendMail({ from: expediteur, to: a, subject: sujet, text: texte, html })
}
