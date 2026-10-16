// Charge .env.local dans un script. À importer en PREMIER : les modules de l'app lisent
// DATABASE_URL à leur chargement, et les imports sont évalués dans l'ordre.
import { config as chargerEnv } from "dotenv"

chargerEnv({ path: ".env.local" })
chargerEnv()
