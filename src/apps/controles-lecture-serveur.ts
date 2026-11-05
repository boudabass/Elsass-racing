// Enregistrement des contrôles de lecture des fichiers (tâche 5.8, §3.1). Chaque app déclare ici le contrôle de ses fiches
// rattachées. La route de lecture et « Tous les fichiers » importent ce module : c'est lui qui remplit le registre du socle.
import { enregistrerControleLecture } from "@/core/fichiers/controles-lecture"

import { controleLectureBudget } from "./budget/controle-lecture"
import { controleLectureChecklist } from "./checklist/controle-lecture"
import { controlesLectureEquipe } from "./equipe/controle-lecture"
import { controleLectureDocuments } from "./documents/controle-lecture"
import { controleLectureGarage } from "./garage/controle-lecture"

for (const controle of [controleLectureDocuments, controleLectureBudget, controleLectureChecklist, controleLectureGarage, ...controlesLectureEquipe]) {
  enregistrerControleLecture(controle)
}
