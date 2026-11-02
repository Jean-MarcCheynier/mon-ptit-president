# Mon p'tit président

Jeu de pronostics entre amis autour de l'élection présidentielle : les joueurs devinent quels candidats seront sur la ligne de départ, et marquent d'autant plus de points que leur intuition était rare.

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

**Pronostic** :
L'ensemble des décisions d'un joueur pour une élection, en brouillon ou validé ; seul le dernier pronostic validé compte.
_Avoid_ : pari, bulletin, ballot

**Décision** :
Le choix « qualifié » ou « recalé » d'un joueur pour un candidat du pool.
_Avoid_ : vote, choix, entrée

**Clôture** :
L'instant à partir duquel les pronostics d'une élection ne peuvent plus être modifiés.
_Avoid_ : verrouillage, date limite, deadline

**Jamais tranché** :
Candidat ajouté au pool après la dernière validation d'un joueur ; le pronostic ne contient aucune décision à son sujet.

### Résultats

**Résultat** :
Le nombre de décisions justes d'un pronostic validé face à la liste officielle, rapporté au nombre de ses décisions (X / N).
_Avoid_ : score (réservé au pronostic des scores)

**Points** :
La valeur d'une décision juste, croissante avec la part des autres joueurs ayant fait le choix inverse : de 1 (tout le monde d'accord) à 100 (seul contre tous) ; une décision fausse vaut 0.
_Avoid_ : score

**Classement** :
La liste des joueurs participant au classement, ordonnée par points décroissants, visible après la publication de la liste officielle.
_Avoid_ : leaderboard, palmarès

**Rang** :
La position d'un joueur dans le classement ; des joueurs à égalité de points partagent le même rang (1, 1, 3).
_Avoid_ : place, position
