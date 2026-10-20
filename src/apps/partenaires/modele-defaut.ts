// Modèle de convention fourni par défaut (version 2). Texte repris de docs/modele-convention.md, sans
// balisage : chaque team en reçoit une copie dans partenaires_template à sa première lecture, et peut la modifier.
// La version 2 (brief 3.7, point 0) retire le « Saison » répété du titre : une team qui a déjà une copie de la
// version 1 la garde telle quelle. Ce texte n'est pas un avis juridique ; une relecture par un juriste est conseillée
// avant la première signature.

export const MODELE_DEFAUT_V2 = {
  nom: "Convention de partenariat",
  sourceCle: "defaut_v2",
  version: 2,
  texte: `CONVENTION DE PARTENARIAT

Entre les soussignés

{{team.nom}}, {{team.forme_juridique}}, inscrite sous le numéro {{team.rna}}, dont le siège est situé {{team.adresse}}, représentée par {{team.representant}},
ci-après « la team »,

et

{{partenaire.entreprise}}, dont le siège est situé {{partenaire.adresse}}, représentée par {{partenaire.representant}},
ci-après « le partenaire ».

Article 1 : Objet

La présente convention fixe les conditions dans lesquelles le partenaire soutient les activités sportives automobiles de la team pendant la {{convention.saison}}, et les contreparties de visibilité que la team s'engage à lui offrir en retour.

Article 2 : Apport du partenaire

Le partenaire apporte à la team :
- un apport financier de {{convention.apport_financier}} ;
- un apport en nature : {{convention.apport_nature}}.

Les versements suivent l'échéancier suivant : {{convention.echeancier}}.

La team remet au partenaire un justificatif pour chaque versement reçu.

Article 3 : Contreparties

En contrepartie, la team s'engage à :

{{contreparties}}

L'avancement de chaque contrepartie et les preuves de sa réalisation (photos, liens de publication) sont consultables par le partenaire sur sa page personnelle, à l'adresse que la team lui communique.

Article 4 : Logo et éléments fournis

Le partenaire fournit à la team son logo, de préférence en format vectoriel, et indique ses règles d'utilisation, le cas échéant.

Le partenaire autorise la team à reproduire son nom et son logo, pendant la durée de la convention, uniquement pour réaliser les contreparties prévues à l'article 3.

Sauf mention contraire à l'article 3, la fabrication et la pose des adhésifs sur la voiture sont à la charge de la team.

Article 5 : Durée

La convention prend effet le {{convention.date_debut}} et prend fin le {{convention.date_fin}}.

Elle ne se renouvelle pas automatiquement. Un renouvellement fait l'objet d'une nouvelle convention.

Toute modification en cours de convention fait l'objet d'un avenant écrit, numéroté et signé par les deux parties.

Article 6 : Aléas sportifs

Le sport automobile comporte des aléas. Un abandon, une sortie de route, une casse mécanique, une exclusion, une absence ou l'annulation d'une épreuve par son organisateur ne constituent pas un manquement de la team à ses engagements.

Si une épreuve prévue n'a pas lieu ou n'est pas courue par la team, les contreparties liées à cette épreuve sont, dans la mesure du possible, reportées sur une autre épreuve ou un autre événement de la saison, en accord avec le partenaire.

Les résultats sportifs ne sont pas garantis et ne conditionnent pas l'apport du partenaire.

Article 7 : Droit à l'image

Chaque partie autorise l'autre à faire état du partenariat, à citer son nom et à reproduire son logo dans sa propre communication, pendant la durée de la convention.

Le partenaire peut utiliser les photos de la voiture portant son logo, que la team lui remet, pour sa communication. Le nom du photographe est alors indiqué lorsqu'il est connu.

L'utilisation de l'image des membres de la team dans une publicité du partenaire nécessite leur accord écrit préalable.

Article 8 : Responsabilité et assurances

La team pratique le sport automobile sous sa seule responsabilité, dans le respect des règlements sportifs, et dispose des licences et assurances exigées pour chaque épreuve.

La responsabilité du partenaire ne peut être engagée pour un dommage survenu à l'occasion des activités sportives de la team.

Le partenaire garantit que son activité et son logo peuvent légalement être affichés sur une voiture de course, notamment au regard de la réglementation sur la publicité pour l'alcool et le tabac.

Article 9 : Résiliation

En cas de manquement grave de l'une des parties à ses obligations, l'autre partie peut résilier la convention si ce manquement n'a pas été corrigé dans les trente jours suivant une mise en demeure écrite.

La convention peut aussi être résiliée à tout moment d'un commun accord écrit.

En cas de résiliation, les sommes déjà versées restent acquises à la team pour la part correspondant aux contreparties réalisées. Le solde éventuel est réglé d'un commun accord.

Article 10 : Régime fiscal

La présente convention est une convention de partenariat, aussi appelée sponsoring : l'apport du partenaire rémunère une prestation de visibilité. Elle n'ouvre pas droit, à elle seule, à la réduction d'impôt prévue pour le mécénat.

Un soutien sous forme de mécénat, sans contrepartie publicitaire, fait l'objet d'un document distinct, si la team remplit les conditions légales pour recevoir des dons.

Article 11 : Litiges

Les parties s'efforcent de régler à l'amiable tout différend lié à la présente convention. À défaut d'accord, le litige est porté devant le tribunal compétent du siège de la team.

Fait à {{lieu}}, le {{date}}, en deux exemplaires originaux.

Pour la team : {{team.representant}}
Signature

Pour le partenaire : {{partenaire.representant}}
Signature et cachet`,
} as const
