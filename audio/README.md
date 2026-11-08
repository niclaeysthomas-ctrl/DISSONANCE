# audio/ — les versions de référence

Un fichier par chanson : **la** version qui fait foi pour le groupe. Celle
qu'on écoute avant la répète pour se remettre le morceau en tête.

## Ajouter une référence

1. Dans l'app, ouvre la chanson, menu **⋯** de la piste →
   **Proposer comme référence du groupe**. Il te guide et te donne le bloc
   à coller.
2. Dépose le fichier audio ici, dans ce dossier.
3. Dans `repertoire.json`, ajoute à la chanson :

```json
"reference": {
  "fichier": "audio/mon-morceau.m4a",
  "nom": "Maquette d'octobre",
  "duree": 184
}
```

`duree` est en secondes, et sert juste à l'afficher avant lecture.

## À garder en tête

- **Le dépôt est public.** Ce qui est ici est écoutable par n'importe qui.
  Les brouillons restent sur les téléphones.
- Visez **léger** : un `.m4a` ou un `.mp3` à 128 kbit/s, pas un WAV de studio.
  Compter ~1 Mo la minute, et pas plus de quelques centaines de Mo en tout.
- Dans l'app, la référence se lit en ligne ; le bouton **⤓** la garde sur
  l'appareil pour la cave de répète.

Le fichier `exemple-grille-blues.m4a` n'est qu'une démonstration synthétisée —
à supprimer dès que vous déposez de la vraie musique.
