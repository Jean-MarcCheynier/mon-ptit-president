# Une seule table de pronostics pour toutes les phases, séparées à la lecture par des vues

Les trois phases du jeu (qualifiés, 1er tour, 2nd tour) partagent le même cycle brouillon / validé, la même clôture et le même historique. On les écrit donc toutes dans `Ballot` (avec une colonne `phase`) et `BallotEntry`, qui porte soit `isCandidate` (qualifiés), soit `score` (tours), exactement l'un des deux (contrainte en base). Une entité « pronostic de scores » séparée aurait été plus pure, mais elle aurait dupliqué le cycle brouillon / validé et sa gestion de la concurrence (verrous de ligne, index partiel « un brouillon »), qui est la partie la plus délicate du code.

## Consequences

- Le 2nd tour est un pronostic du même type que le 1er : deux lignes (finalistes A et B) dont la somme vaut 100, même si l'UI n'en fait saisir qu'une.
- Les scores sont stockés en entiers de dixièmes de point (23,4 % → 234), de 0 à 1000. Au 1er tour, la somme est libre : chaque qualifié démarre à 0 et le joueur peut valider même si la somme ne vaut pas 1000 (le « reste à répartir » n'est qu'indicatif). Forcer exactement 100 % rendait la saisie pénible avec une dizaine de qualifiés ou plus.
- Les lectures et statistiques passent par une vue par sorte de pronostic (`qualifier_decisions`, `round_scores`), aux colonnes typées et non nulles, filtrées sur le dernier pronostic validé ; index `(election_id, phase, status)` sur `ballots`. Si le volume l'exige : vue matérialisée rafraîchie à la clôture, puis partitionnement de `ballot_entries` par phase, sans changer le code d'écriture.
- Ouverture et clôture sont définies par phase ; l'actuel `predictionsLockAt` devient la clôture de la phase des qualifiés.
- Le 1er tour ouvre dès la création de l'élection, pour récolter des pronostics au plus tôt. Avant la liste officielle, le joueur score les candidats retenus dans son pronostic des qualifiés validé (tout le pool actif s'il n'en a pas) ; après, les qualifiés. Un pronostic validé avant la liste reste valable : ses lignes sur des non-qualifiés sont ignorées par les lectures (points, tendances).
