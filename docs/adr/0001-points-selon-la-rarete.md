# Les points d'une décision juste dépendent de sa rareté parmi les joueurs

Une décision juste (qualifié / recalé) vaut `100^p` points, où `p` est la part des **autres** joueurs ayant fait le choix inverse sur ce candidat : 1 point si tout le monde était d'accord, 10 à 50 %, 100 si le joueur était seul contre tous ; une décision fausse vaut 0. Un barème plat (1 point par décision juste) récompensait autant les évidences que les intuitions rares, et rendait payante la stratégie « tout recalé » ; on veut au contraire que la prise de risque paie.

## Consequences

- `p` est calculé par candidat, sur le dernier pronostic validé de chaque joueur à l'e-mail vérifié ayant tranché ce candidat (le joueur lui-même exclu). Sans autre joueur, une décision juste vaut 1 point.
- Les points sont calculés à la lecture et sommés en valeurs exactes ; seul le total est arrondi. Une suppression de compte après la publication modifie donc les points des autres : accepté.
- Le barème est manipulable par des comptes fantômes ; la vérification d'e-mail et la limite d'inscriptions sont jugées suffisantes pour un jeu entre amis.
- Connaître les choix des autres devient un avantage stratégique : aucune tendance n'est visible avant la clôture des pronostics.
- Le barème doit être expliqué aux joueurs avant qu'ils jouent (sur `/predict` et dans l'onboarding).
