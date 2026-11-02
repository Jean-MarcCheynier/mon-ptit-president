# Une seule table de pronostics pour toutes les phases, séparées à la lecture par des vues

Les trois phases du jeu (qualifiés, 1er tour, 2nd tour) partagent le même cycle brouillon / validé, la même clôture et le même historique. On les écrit donc toutes dans `Ballot` (avec une colonne `phase`) et `BallotEntry`, qui porte soit `isCandidate` (qualifiés), soit `score` (tours), exactement l'un des deux (contrainte en base). Une entité « pronostic de scores » séparée aurait été plus pure, mais elle aurait dupliqué le cycle brouillon / validé et sa gestion de la concurrence (verrous de ligne, index partiel « un brouillon »), qui est la partie la plus délicate du code.

## Consequences

- Le 2nd tour est un pronostic du même type que le 1er : deux lignes (finalistes A et B) dont la somme vaut 100, même si l'UI n'en fait saisir qu'une.
- Les scores sont stockés en entiers de dixièmes de point (23,4 % → 234) ; un pronostic de tour valide si la somme vaut exactement 1000.
- Les lectures et statistiques passent par une vue par sorte de pronostic (`qualifier_decisions`, `round_scores`), aux colonnes typées et non nulles, filtrées sur le dernier pronostic validé ; index `(election_id, phase, status)` sur `ballots`. Si le volume l'exige : vue matérialisée rafraîchie à la clôture, puis partitionnement de `ballot_entries` par phase, sans changer le code d'écriture.
- Ouverture et clôture sont définies par phase ; l'actuel `predictionsLockAt` devient la clôture de la phase des qualifiés.
