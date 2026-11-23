# Grilling : faire de l'app une PWA

Session de questions en cours, pas encore une décision. À reprendre avec la compétence
`grilling` : relire ce fichier, puis poser le tour suivant à partir des réponses du tour 1.

## Question de départ

Comment faire une PWA à partir de ce code ? Qu'est-ce que ça apporterait ? Est-ce que ça
fonctionnerait sur iOS ?

## Ce que ça apporterait

1. **Notifications push** pour les échéances des phases (« Le 1er tour ouvre ! », « Clôture des
   qualifiés demain »). C'est le vrai gain : le jeu vit de ses échéances, et l'accueil dit déjà
   « Rendez-vous le {date} ».
2. **Installation** : une icône sur l'écran d'accueil, et l'app s'ouvre en plein écran, sans
   barre d'adresse. La barre d'onglets mobile ressemble alors vraiment à une app.
3. **Démarrage rapide** : l'interface reste en cache, et une page hors ligne propre remplace
   l'erreur du navigateur.
4. Bonus : une **pastille sur l'icône** (« 1 phase à faire »).

## iOS : ça marche, avec des limites

- **Installation** : pas de bouton « Installer » automatique. Il faut passer par Partager →
  « Sur l'écran d'accueil », donc l'expliquer au joueur.
- **Notifications push** : depuis iOS 16.4, **uniquement si l'app est installée**, et après un tap
  du joueur pour les autoriser.
- **Session séparée** : l'app installée ne partage pas les cookies de Safari. Le joueur devra se
  reconnecter une fois dans l'app.
- **Liens des emails** : les liens de vérification et de réinitialisation du mot de passe
  s'ouvrent dans Safari, pas dans l'app.
- **Connexion Google** : en mode installé, la redirection OAuth peut s'ouvrir dans une fenêtre
  Safari dont la session ne revient pas toujours dans l'app. **À vérifier sur un vrai iPhone.**

## Où en est le code (relevé le 23 novembre 2026)

- **Déjà là** :
  - `apps/web/index.html` contient `apple-touch-icon`, `viewport-fit=cover` et `theme-color`
    (clair et sombre).
  - Le CSS gère les zones de sécurité (`env(safe-area-inset-*)`) et une variante `mobile`.
  - En production, Caddy sert l'app en HTTPS sur une même origine, `/api` compris : c'est ce
    qu'exige un service worker.
- **Manque** :
  - le manifeste ;
  - les icônes 192 et 512 px, et une version « maskable » ;
  - le service worker (piste : `vite-plugin-pwa`) ;
  - tout le backend du push : clés VAPID, table des abonnements, tâche planifiée.

## Tour 1 : questions posées, réponses en attente

**Q1 — Objectif principal.**
- (a) installation et plein écran seulement ;
- (b) (a) plus les notifications push pour les échéances des phases ;
- (c) (b) plus un vrai mode hors ligne.

➡️ Recommandé : (b). Le push justifie l'effort, et il ouvre les questions du backend d'envoi.

**Q2 — Hors ligne.** On se limite à garder l'interface en cache, avec un message « Tu es hors
ligne », sans pronostic possible sans réseau ?

➡️ Recommandé : oui. Valider hors ligne puis synchroniser poserait des problèmes de clôture
(pronostic fait avant la date limite, mais envoyé après).

**Q3 — iOS, cible de premier rang.** iPhone et Android à égalité, avec des tests sur de vrais
iPhones ?

➡️ Recommandé : oui. Ça impose d'expliquer l'installation sur iOS et de faire marcher la connexion
Google en mode installé.

**Q4 — Mises à jour.** Afficher « Nouvelle version disponible — Recharger » plutôt que recharger
d'office ?

➡️ Recommandé : oui. Un rechargement automatique couperait un swipe en cours. Une ancienne
version gardée en cache trop longtemps pourrait appeler une route d'API modifiée entre-temps.

**Q5 — Inviter à installer.** Une carte qu'on peut fermer sur l'accueil (bouton natif sur
Android, étapes Partager → Écran d'accueil sur iOS), plus une entrée permanente dans Paramètres ?

➡️ Recommandé : oui. Même motif que la carte « nouvelle version de la présentation ».

## Questions des tours suivants (selon les réponses)

- **Si push (Q1 b ou c)** :
  - Quels événements notifier (ouverture d'une phase, veille de clôture, résultats publiés) ?
  - Comment le joueur s'abonne et se désabonne ?
  - Où vit la tâche planifiée (cron dans l'API, autre conteneur) ?
  - Où stocker les clés VAPID ?
  - Faut-il un email de secours pour les joueurs qui n'ont pas installé l'app ?
- **Outil** : `vite-plugin-pwa` en mode `generateSW`, ou `injectManifest` pour gérer le push dans
  le service worker.
- **Icônes** : à partir du logo (le fauteuil au bicorne, #66).
- **Connexion Google sur iOS installé** : un fait à vérifier avant toute décision.
