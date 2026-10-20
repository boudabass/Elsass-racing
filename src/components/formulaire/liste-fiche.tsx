// Fiche en lecture : un titre, puis les libellés et leurs valeurs. C'est ce qu'on voit avant d'ouvrir le tiroir
// « Modifier » (brief 3.13b) : les champs n'apparaissent dans un formulaire que quand on les modifie.
export function ListeFiche({ titre, lignes }: { titre: string; lignes: Array<[string, string]> }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-titre text-lg uppercase">{titre}</h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {lignes.map(([libelle, valeur]) => (
          <div key={libelle} className="flex flex-col">
            <dt className="text-sm text-texte-discret">{libelle}</dt>
            <dd>{valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
