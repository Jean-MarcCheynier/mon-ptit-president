# Le vainqueur se joue à cotes fixes

Le pronostic du vainqueur ne suit pas la règle de rareté de l'ADR 0001 : le joueur choisit parmi une liste de favoris identique pour tous, chacun avec une cote fixée d'avance (90 pour le plus probable, jusqu'à 1000 pour « autre candidat »), sur le modèle des jeux à cotes comme Mon Petit Gazon. On veut un enjeu lisible dès le choix (« Le Pen rapporte 90, Glucksmann 9999 »), alors que des points de rareté ne se connaissent qu'après la clôture. Les cotes sont figées à l'ouverture de la phase et ne bougent plus, même si les rapports de force évoluent : une cote prise au moment de la validation aurait été plus juste, mais plus complexe et moins lisible.

## Consequences

- La liste des favoris et leurs cotes sont des données de l'élection, fixées par nous à partir des sondages et des marchés de prédiction ; « autre candidat » rapporte sa cote si l'élu n'est aucun des favoris.
- Une cote peut être volontairement disproportionnée (Glucksmann à 9999) : un seul bon pari peut alors peser plus que toutes les autres phases dans le classement. C'est assumé.
