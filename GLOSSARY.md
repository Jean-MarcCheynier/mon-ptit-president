# Mon p'tit président

Jeu de pronostics entre amis autour de l'élection présidentielle : phase après phase, les joueurs devinent quels candidats seront sur la ligne de départ, qui sera élu et avec quels scores, et marquent d'autant plus de points que leur intuition était audacieuse.

## Language

### Candidats

**Pool** :
Les candidats encore en lice pour une élection (tous sauf les désistés), sur lesquels les joueurs se prononcent.
_Avoid_ : vivier, liste des candidats

**Désisté** :
Candidat sorti du pool après y être entré ; il ne sera pas sur la ligne de départ.
_Avoid_ : retiré, supprimé

**Liste officielle** :
La liste des candidats qualifiés publiée par le Conseil constitutionnel, après la clôture des pronostics.
_Avoid_ : liste définitive, résultats

**Qualifié** / **Recalé** :
Un candidat est qualifié s'il figure sur la liste officielle ; tout autre candidat, désisté compris, est recalé.
_Avoid_ : non qualifié, éliminé

### Pronostics

**Joueur** :
Personne inscrite, à l'adresse e-mail vérifiée, qui pronostique.
_Avoid_ : utilisateur, parieur

**Phase** :
Une étape du parcours du joueur, dans l'ordre : _présentation_, _qualifiés_, _vainqueur_, _1er tour_, _2nd tour_. Le joueur n'accède à une phase qu'après avoir validé la précédente, et peut revenir modifier une phase tant qu'elle n'est pas close. Une phase close sans pronostic validé est _sautée_ : elle ne bloque plus la suite et ne rapporte aucun point.
_Avoid_ : manche, niveau

**Vainqueur** :
Le candidat élu président à l'issue du 2nd tour. Le joueur le pronostique juste après les qualifiés, en choisissant un favori ou « autre candidat ».
_Avoid_ : gagnant, élu, président

**Favori** :
Un des candidats proposés, la même liste pour tous, au pronostic du vainqueur, chacun avec sa cote ; « autre candidat » couvre tous les autres.
_Avoid_ : outsider, choix

**Cote** :
Les points, fixés d'avance et identiques pour tous, que rapporte un favori (ou « autre candidat ») s'il est élu ; d'autant plus élevée que le choix est improbable.
_Avoid_ : côte, prime, mise

**Pronostic** :
Ce qu'un joueur prédit pour une phase d'une élection, en brouillon ou validé ; seul le dernier pronostic validé compte. On dit _pronostic des qualifiés_, _du vainqueur_, _du 1er tour_, _du 2nd tour_.
_Avoid_ : pari, bulletin, ballot

**Décision** :
Le choix « qualifié » ou « recalé » d'un joueur pour un candidat du pool.
_Avoid_ : vote, choix, entrée

**Clôture** :
L'instant à partir duquel les pronostics d'une phase ne peuvent plus être modifiés.
_Avoid_ : verrouillage, date limite, deadline

**Jamais tranché** :
Candidat ajouté au pool après la dernière validation d'un joueur ; le pronostic ne contient aucune décision à son sujet.

**Score** :
La part des suffrages exprimés obtenue par un candidat à un tour, prédite ou réelle.
_Avoid_ : pourcentage, résultat

**Écart** :
La différence absolue, en points de pourcentage, entre le score prédit et le score réel d'un candidat.
_Avoid_ : erreur, marge

**Finalistes** :
Les deux candidats qualifiés pour le 2nd tour. Le pronostic du 2nd tour porte sur les finalistes réels, une fois le 1er tour joué.
_Avoid_ : qualifiés (réservé à la liste officielle)

### Résultats

**Résultat** :
Le nombre de décisions justes d'un pronostic validé face à la liste officielle, rapporté au nombre de ses décisions (X / N).
_Avoid_ : score

**Points** :
Ce que rapporte un pronostic. Pour les qualifiés, une décision juste vaut de 1 (tout le monde d'accord) à 100 (seul contre tous) selon la rareté du choix ; pour le vainqueur, la cote du choix s'il est élu ; pour les tours, chaque score vaut d'autant plus que l'écart est faible, plus des bonus pour les bons finalistes (1er tour) et le bon gagnant du duel (2nd tour).
_Avoid_ : score

**Classement** :
La liste des joueurs participant au classement, ordonnée par points décroissants, visible après la publication de la liste officielle.
_Avoid_ : leaderboard, palmarès

**Rang** :
La position d'un joueur dans le classement ; des joueurs à égalité de points partagent le même rang (1, 1, 3).
_Avoid_ : place, position

**Tendance** :
La répartition des pronostics validés des joueurs pour une phase close (part des joueurs par choix, score prédit par candidat).
_Avoid_ : sondage, stats, statistiques
