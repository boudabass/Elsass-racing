// Point unique d'enregistrement des gestionnaires d'événements (brief 2.6, section 0). Chaque module
// enregistre ses gestionnaires à l'import : ce fichier les importe tous. Il est importé par
// traitement-serveur.ts, donc tout traitement voit tous les gestionnaires, quel que soit le point d'entrée
// (page, Server Action, route /api/synchro/pousser). Sans cela, un événement émis hors d'une page
// trouvait « aucun gestionnaire » et était marqué traité sans effet.
//
// Ajouter une app qui écoute un événement : importer son module de services ici.

import "@/core/actions/gestionnaires-serveur"
import "@/apps/saison/services-serveur"
import "@/apps/budget/services-serveur"
