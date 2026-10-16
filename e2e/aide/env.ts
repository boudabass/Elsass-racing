// Charge .env.local dans le processus des tests. Importé en premier par session.ts :
// les modules de l'app lisent DATABASE_URL à leur chargement.
import { config as chargerEnv } from "dotenv"

chargerEnv({ path: ".env.local" })
