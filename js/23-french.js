'use strict';
// FRENCH — Settings → Display → Language. "Automatic" follows the phone's language.
// Instead of touching every file, this layer swaps the app's English text for French as it appears on
// screen (text, placeholders, button labels, toasts, the buddy's lines). Game titles and notes are left alone.
// FR: whole phrases. A phrase is looked up as-is, then without its emoji/punctuation around it ("🏆 Today!").
// FR_TPL: phrases with a changing part; {1}, {2}… stand for the changing parts (they're translated too).

set.lang ||= 'auto';
const french = set.lang === 'fr' || (set.lang === 'auto' && /^fr/i.test(navigator.language));

const FR = {
  // statuses, sections, sort, walls
  Playing: 'En cours',
  'On & off': 'De temps en temps',
  'On hold': 'En pause',
  Backlog: 'À faire',
  Finished: 'Terminé',
  'Played enough': 'Assez joué',
  Dropped: 'Abandonné',
  Wishlist: 'Envies',
  All: 'Tous',
  Other: 'Autre',
  Unknown: 'Inconnu',
  'All platforms': 'Toutes les plateformes',
  Newest: 'Récents',
  'A–Z': 'A–Z',
  Rating: 'Note',
  Hours: 'Heures',
  Sort: 'Trier',
  Platform: 'Plateforme',
  'Find a game': 'Chercher un jeu',
  Room: 'Chambre',
  Stats: 'Stats',
  Goals: 'Objectifs',
  Achievements: 'Succès',
  STATS: 'STATS',
  GOALS: 'OBJECTIFS',
  ACHIEVEMENTS: 'SUCCÈS',
  'Now playing': 'En cours',
  'NOW PLAYING': 'EN COURS',
  'PICK A GAME': 'CHOISIS UN JEU',
  'PRESS + TO START': 'APPUIE SUR + POUR JOUER',
  'Nothing here': 'Rien ici',
  'No game matches': 'Aucun jeu trouvé',
  'Your rack is empty': 'Ton étagère est vide',
  Tap: 'Touche',
  'to add your first game': 'pour ajouter ton premier jeu',
  'Your buddy': 'Ton compagnon',
  'Food bowl: call your buddy': 'Gamelle : appeler ton compagnon',
  'Window: tap to close or open the blinds': 'Fenêtre : touche pour fermer ou ouvrir les stores',
  'Update now': 'Mettre à jour',
  'Add a game': 'Ajouter un jeu',
  Close: 'Fermer',
  Customize: 'Personnaliser',
  Settings: 'Réglages',

  // adding and editing
  'Game search uses the free RAWG database': 'La recherche utilise la base gratuite RAWG',
  'Get a free key': 'Obtiens une clé gratuite',
  'then paste it here once': 'puis colle-la ici une fois',
  'RAWG API key': 'Clé API RAWG',
  Save: 'Enregistrer',
  'Scan the game case': 'Scanner la boîte du jeu',
  'Search a game': 'Chercher un jeu',
  'Add it by hand': 'L’ajouter à la main',
  'Game info and pictures from': 'Infos et images de',
  and: 'et',
  'Game info from': 'Infos de',
  Game: 'Jeu',
  'New game': 'Nouveau jeu',
  'Edit game': 'Modifier le jeu',
  Edit: 'Modifier',
  'Find cover art': 'Trouver une jaquette',
  'From my photos': 'Depuis mes photos',
  'Remove picture': 'Retirer l’image',
  'Use this picture': 'Utiliser cette image',
  'Finding pictures': 'Recherche d’images',
  'No pictures found. Check the title, or use one of your photos':
    'Aucune image trouvée. Vérifie le titre, ou utilise une de tes photos',
  Title: 'Titre',
  Status: 'Statut',
  'Hours played': 'Heures jouées',
  'Release year': 'Année de sortie',
  Started: 'Commencé',
  Genres: 'Genres',
  Notes: 'Notes',
  'Action, RPG': 'Action, RPG',
  'What did you think': 'Qu’en as-tu pensé',
  Delete: 'Supprimer',
  Deleted: 'Supprimé',
  Saved: 'Enregistré',
  'On the rack': 'Sur l’étagère',
  Change: 'Modifier',
  'Never-ending game (battle royale, MMO…): no "Finished"':
    'Jeu sans fin (battle royale, MMO…) : pas de « Terminé »',
  'When did you finish it': 'Quand l’as-tu terminé',
  Today: 'Aujourd’hui',
  'A day in the past': 'Un jour passé',
  'Use this date': 'Utiliser cette date',
  'A long time ago (I don’t remember)': 'Il y a longtemps (je ne sais plus)',
  'Pick the day first': 'Choisis d’abord le jour',
  'To finish': 'À finir',
  Played: 'Joué',
  Endless: 'Sans fin',
  'Start playing': 'Commencer à jouer',

  // scanning
  'Point at the barcode on the back, or the title on the front':
    'Vise le code-barres au dos, ou le titre sur la face avant',
  'Read the front cover now': 'Lire la face avant maintenant',
  'Barcode found. Looking it up': 'Code-barres trouvé. Recherche',
  'Getting the cover reader ready': 'Préparation du lecteur de jaquette',
  'Reading the cover': 'Lecture de la jaquette',
  'Found it! Tap the right game': 'Trouvé ! Touche le bon jeu',
  'Still looking… hold the case steady, with the barcode or the front cover in the frame':
    'Je cherche encore… tiens la boîte immobile, avec le code-barres ou la face avant dans le cadre',
  'Couldn’t read a title. Get closer, with the front cover flat and well lit':
    'Titre illisible. Rapproche-toi, avec la face avant à plat et bien éclairée',
  'Couldn’t tell which game this is. Try the front cover, or search by name':
    'Impossible de savoir quel jeu c’est. Essaie la face avant, ou cherche par nom',
  'That barcode isn’t in the database. Show the front cover instead':
    'Ce code-barres n’est pas dans la base. Montre plutôt la face avant',
  'The camera isn’t available. Allow camera access, or search by name':
    'La caméra n’est pas disponible. Autorise l’accès, ou cherche par nom',
  'The cover reader couldn’t load. Check your connection':
    'Le lecteur de jaquette n’a pas chargé. Vérifie ta connexion',
  'Already looking': 'Recherche déjà en cours',
  "Game search isn't answering right now. Try again in a moment, or add the game by hand":
    'La recherche ne répond pas. Réessaie dans un instant, ou ajoute le jeu à la main',
  "The search key doesn't work. Check it in Settings, or add the game by hand":
    'La clé de recherche ne marche pas. Vérifie-la dans les Réglages, ou ajoute le jeu à la main',
  'Game search is full for this month. Add your own free RAWG key in Settings, or add the game by hand':
    'La recherche est pleine ce mois-ci. Ajoute ta propre clé RAWG gratuite dans les Réglages, ou ajoute le jeu à la main',
  'No connection right now': 'Pas de connexion pour le moment',
  'No connection. Try again later': 'Pas de connexion. Réessaie plus tard',

  // stats and goals
  'Top rated': 'Mieux notés',
  'Most played': 'Plus joués',
  Platforms: 'Plateformes',
  'Finished per year': 'Terminés par an',
  'Average rating': 'Note moyenne',
  Games: 'Jeux',
  Ratings: 'Notes',
  'Rate a game to see it here': 'Note un jeu pour le voir ici',
  'Log some hours to see it here': 'Ajoute des heures pour le voir ici',
  'Nothing yet': 'Rien pour l’instant',
  'One trophy per finished game': 'Un trophée par jeu terminé',
  'Finish a game to win a trophy': 'Termine un jeu pour gagner un trophée',
  Goal: 'Objectif',
  'Lower goal': 'Baisser l’objectif',
  'Raise goal': 'Monter l’objectif',
  'games finished': 'jeux terminés',
  'Right on pace': 'Pile dans les temps',
  'Goal beaten': 'Objectif atteint',
  'Beaten this year': 'Terminés cette année',
  'Backlog roulette': 'Roulette des jeux à faire',
  'Pick my next game': 'Choisis mon prochain jeu',
  'Your backlog is empty. Nice': 'Rien à faire en attente. Bravo',

  // customize
  'Neon sign': 'Néon',
  'On the desk': 'Sur le bureau',
  'Your buddy': 'Ton compagnon',
  On: 'Oui',
  Off: 'Non',
  Animal: 'Animal',
  Name: 'Nom',
  Colour: 'Couleur',
  Hat: 'Chapeau',
  'Second buddy': 'Deuxième compagnon',
  'Reset to default': 'Réinitialiser',
  Natural: 'Naturelle',
  'Same as LED': 'Comme les LED',
  'Any colour': 'Toute couleur',
  'LED colour': 'Couleur des LED',
  Wall: 'Mur',
  Shelves: 'Étagères',
  'Window scene': 'Vue de la fenêtre',
  'On the window': 'À la fenêtre',
  'Curtain colour': 'Couleur des rideaux',
  'Time & weather': 'Heure et météo',
  'Time of day': 'Moment de la journée',
  Weather: 'Météo',
  'Weather data by': 'Météo fournie par',
  'or type a city': 'ou tape une ville',
  Live: 'En direct',
  Choose: 'Choisir',
  Dawn: 'Aube',
  Day: 'Jour',
  Sunset: 'Coucher de soleil',
  Night: 'Nuit',
  Midnight: 'Minuit',
  Charcoal: 'Anthracite',
  Synthwave: 'Synthwave',
  Forest: 'Forêt',
  Wood: 'Bois',
  Metal: 'Métal',
  City: 'Ville',
  Mountains: 'Montagnes',
  Beach: 'Plage',
  Space: 'Espace',
  Clear: 'Dégagé',
  Cloudy: 'Nuageux',
  Rain: 'Pluie',
  Snow: 'Neige',
  Storm: 'Orage',
  clear: 'ciel dégagé',
  cloudy: 'nuageux',
  rain: 'pluie',
  snow: 'neige',
  storm: 'orage',
  Blinds: 'Stores',
  Curtains: 'Rideaux',
  Nothing: 'Rien',
  Blob: 'Blob',
  Cat: 'Chat',
  Dog: 'Chien',
  Fox: 'Renard',
  Bunny: 'Lapin',
  Frog: 'Grenouille',
  Penguin: 'Pingouin',
  None: 'Aucun',
  Crown: 'Couronne',
  Headset: 'Casque',
  Cap: 'Casquette',
  Bow: 'Nœud',
  'Top hat': 'Haut-de-forme',
  Mug: 'Tasse',
  Plant: 'Plante',
  Controller: 'Manette',
  Console: 'Console',
  'A second buddy': 'Un deuxième compagnon',
  'Feed your buddy 10 times (the “Best Friends” medal) to get a second buddy':
    'Nourris ton compagnon 10 fois (la médaille « Meilleurs amis ») pour avoir un deuxième compagnon',
  'Add where you are to get your real weather. Without it, only the time of day follows the clock':
    'Indique où tu es pour avoir ta vraie météo. Sinon, seul le moment de la journée suit l’horloge',
  'Finding you': 'Je te localise',
  'City not found. Check the spelling': 'Ville introuvable. Vérifie l’orthographe',
  'Location not allowed. Type your city instead': 'Localisation refusée. Tape plutôt ta ville',
  'Your browser can’t share your location. Type your city':
    'Ton navigateur ne peut pas donner ta position. Tape ta ville',

  // achievements
  'Player One': 'Joueur 1',
  'Add your first game': 'Ajoute ton premier jeu',
  Collector: 'Collectionneur',
  'Have 10 games on your rack': 'Avoir 10 jeux sur ton étagère',
  Archivist: 'Archiviste',
  'Have 50 games on your rack': 'Avoir 50 jeux sur ton étagère',
  'Finish a game': 'Terminer un jeu',
  Completionist: 'Complétionniste',
  'Finish 10 games': 'Terminer 10 jeux',
  'Goal Getter': 'Objectif atteint',
  'Reach this year’s challenge': 'Réussir le défi de l’année',
  Critic: 'Critique',
  'Rate 10 games': 'Noter 10 jeux',
  Dedicated: 'Assidu',
  'Play 100 hours in total': 'Jouer 100 heures au total',
  'No-Lifer': 'No-life',
  'Play 1,000 hours in total': 'Jouer 1 000 heures au total',
  'Multi-platform': 'Multiplateforme',
  'Games on 3 different platforms': 'Des jeux sur 3 plateformes',
  Connected: 'Connecté',
  'Sync with Steam, PlayStation or Xbox': 'Synchroniser avec Steam, PlayStation ou Xbox',
  'Night Owl': 'Oiseau de nuit',
  'Visit your room after midnight': 'Visiter ta chambre après minuit',
  'Good Buddy': 'Bon copain',
  'Pet your buddy 50 times': 'Caresser ton compagnon 50 fois',
  'Best Friends': 'Meilleurs amis',
  'Feed your buddy 10 times': 'Nourrir ton compagnon 10 fois',

  // the buddies
  'Ready, player one': 'Prêt, joueur 1',
  'One more game': 'Encore une partie',
  'Hydrate, gamer': 'Hydrate-toi, gamer',
  'This rack looks lonely': 'Cette étagère a l’air bien seule',
  'Tap + to add your first game': 'Touche + pour ajouter ton premier jeu',
  'Put me down': 'Pose-moi',
  'I can fly': 'Je vole',
  'Where are we going': 'On va où',
  Coming: 'J’arrive',
  Food: 'À manger',
  'Best meal ever': 'Meilleur repas du monde',
  'That hit the spot': 'Ça fait du bien',
  '*burp*': '*rot*',
  'Hungry… tap my bowl': 'J’ai faim… touche ma gamelle',
  'Play with me': 'Joue avec moi',
  'COMBO x5': 'COMBO x5',
  '*yawn* Bedtime': '*bâille* Au lit',
  '*yawn* Hi': '*bâille* Salut',
  '*yawn*… hi': '*bâille*… salut',
  'Five more minutes': 'Encore cinq minutes',
  'Huh? I was napping': 'Hein ? Je faisais la sieste',
  'Good night': 'Bonne nuit',
  'Just one more level… then bed': 'Encore un niveau… et au lit',
  'Sweet dreams, player one': 'Fais de beaux rêves, joueur 1',

  // settings
  'Your own RAWG key (optional)': 'Ta propre clé RAWG (facultatif)',
  "Bring in the games you own on Steam, with their hours. Your Steam profile's “Game details” must be Public":
    'Importe tes jeux Steam avec leurs heures. Les « Détails des jeux » de ton profil Steam doivent être publics',
  'Steam profile (name, ID or link)': 'Profil Steam (nom, ID ou lien)',
  'Also add games I never played': 'Ajouter aussi les jeux jamais lancés',
  'Sync with Steam': 'Synchroniser avec Steam',
  'Brings in your PS4 and PS5 games with their hours. Unofficial (Sony has no public way), so it could stop working one day':
    'Importe tes jeux PS4 et PS5 avec leurs heures. Non officiel (Sony n’offre aucun moyen public), donc ça pourrait cesser de marcher un jour',
  'Sign in at': 'Connecte-toi sur',
  'in this browser': 'dans ce navigateur',
  'Then open': 'Puis ouvre',
  'this page': 'cette page',
  'it shows': 'elle affiche',
  'Copy the long code (or the whole line) and paste it here. It works for about 2 months':
    'Copie le long code (ou toute la ligne) et colle-le ici. Il marche environ 2 mois',
  'PlayStation token (npsso)': 'Jeton PlayStation (npsso)',
  'Sync with PlayStation': 'Synchroniser avec PlayStation',
  'Brings in your Xbox games, with hours when Xbox shares them. Uses OpenXBL, a free Xbox service':
    'Importe tes jeux Xbox, avec les heures quand Xbox les partage. Utilise OpenXBL, un service Xbox gratuit',
  'Go to': 'Va sur',
  'and sign in with your Microsoft (Xbox) account': 'et connecte-toi avec ton compte Microsoft (Xbox)',
  'On your profile there, copy your': 'Sur ton profil, copie ta',
  'API key': 'clé API',
  'and paste it here': 'et colle-la ici',
  'OpenXBL key': 'Clé OpenXBL',
  'Sync with Xbox': 'Synchroniser avec Xbox',
  'Your token and key stay on this phone and aren’t put in backups':
    'Ton jeton et ta clé restent sur ce téléphone et ne vont pas dans les sauvegardes',
  'Google Drive backup': 'Sauvegarde Google Drive',
  'Connect Google Drive': 'Connecter Google Drive',
  'Back up now': 'Sauvegarder maintenant',
  Disconnect: 'Déconnecter',
  'Not set up yet': 'Pas encore configuré',
  'Keeps a copy of your games in your Google Drive, automatically, and syncs your devices':
    'Garde automatiquement une copie de tes jeux dans ton Google Drive, et synchronise tes appareils',
  'Connected. First backup coming up': 'Connecté. Première sauvegarde en cours',
  'just now': 'à l’instant',
  Display: 'Affichage',
  'Calm mode: fewer animations (saves battery)': 'Mode calme : moins d’animations (économise la batterie)',
  Language: 'Langue',
  Automatic: 'Automatique',
  'Game info': 'Infos des jeux',
  'Find missing release years': 'Trouver les années de sortie manquantes',
  'Every game already has its year': 'Tous les jeux ont déjà leur année',
  Backup: 'Sauvegarde',
  'Your games live only on this phone. Save a backup now and then':
    'Tes jeux ne sont que sur ce téléphone. Fais une sauvegarde de temps en temps',
  'Save backup': 'Sauvegarder',
  'Load backup': 'Charger une sauvegarde',
  'Backup saved': 'Sauvegarde enregistrée',
  "That file isn't a Gameshelf backup": 'Ce fichier n’est pas une sauvegarde Gameshelf',
  'What’s new': 'Nouveautés',
  'Got it': 'Compris',
  'Install the app': 'Installer l’appli',
  Privacy: 'Confidentialité',
  Synced: 'Synchronisé',
  'Type your Steam profile name first': 'Tape d’abord ton nom de profil Steam',
  'Syncing with Steam': 'Synchro avec Steam',
  'Couldn’t reach Steam. Check your connection': 'Impossible de joindre Steam. Vérifie ta connexion',
  'Steam sync didn’t work. Try again later': 'La synchro Steam n’a pas marché. Réessaie plus tard',
  'Your Steam “Game details” are private. Set them to Public in your Steam privacy settings':
    'Tes « Détails des jeux » Steam sont privés. Mets-les en Public dans tes réglages de confidentialité Steam',
  'Steam profile not found. Check the name, or paste your profile link':
    'Profil Steam introuvable. Vérifie le nom, ou colle le lien de ton profil',
  'The helper is missing its Steam key (STEAM_KEY in Cloudflare)':
    'Il manque la clé Steam au helper (STEAM_KEY dans Cloudflare)',
  'That OpenXBL key doesn’t work. Copy it again from xbl.io and paste it':
    'Cette clé OpenXBL ne marche pas. Recopie-la depuis xbl.io et colle-la',
  'Your PlayStation token is wrong or expired. Get a new one (steps below) and paste it':
    'Ton jeton PlayStation est faux ou expiré. Prends-en un nouveau (étapes ci-dessous) et colle-le',
  'Google Drive backup isn’t set up yet': 'La sauvegarde Google Drive n’est pas encore configurée',
  'Couldn’t reach Google. Check your connection': 'Impossible de joindre Google. Vérifie ta connexion',
  'Google sign-in was cancelled': 'Connexion Google annulée',
  'Google sign-in didn’t work. Check the helper is up to date':
    'La connexion Google n’a pas marché. Vérifie que le helper est à jour',
  'Google Drive connected': 'Google Drive connecté',
  'Synced with your other device': 'Synchronisé avec ton autre appareil',
  'Backed up to Google Drive': 'Sauvegardé sur Google Drive',
  'Google Drive backup didn’t work. Try again later':
    'La sauvegarde Google Drive n’a pas marché. Réessaie plus tard',
  'Stop backing up to Google Drive on this device? Your copy in Drive stays':
    'Arrêter la sauvegarde Google Drive sur cet appareil ? Ta copie dans Drive reste',
  'Storage is full: save a backup and use smaller pictures':
    'Stockage plein : fais une sauvegarde et utilise des images plus petites',
  'Filter your rack by platform': 'Filtre ton étagère par plateforme',

  // what's new
  'Swipe round the room: Goals ← Room → Stats': 'Fais le tour de la chambre : Objectifs ← Chambre → Stats',
  'An “Update now” button shows up when a new version is ready':
    'Un bouton « Mettre à jour » apparaît quand une nouvelle version est prête',
  'Customize: LED colour, wall, shelves, poster, neon sign, desk items, the buddy’s colour and hat':
    'Personnaliser : couleur des LED, mur, étagères, poster, néon, objets du bureau, couleur et chapeau du compagnon',
  'Hats now fit the buddy’s head and turn with him':
    'Les chapeaux tiennent sur la tête du compagnon et tournent avec lui',
  'Scan a game case to add it: the barcode on the back, or the title on the front cover':
    'Scanne une boîte de jeu pour l’ajouter : le code-barres au dos, ou le titre sur la face avant',
  'Steam sync: bring in your Steam games and their hours (Settings → Steam)':
    'Synchro Steam : importe tes jeux Steam et leurs heures (Réglages → Steam)',
  'The room is a real bedroom now: a window, a floor, a trophy shelf on the Stats wall, a bed and a corkboard on the Goals wall':
    'La pièce est une vraie chambre : une fenêtre, un sol, une étagère à trophées sur le mur Stats, un lit et un tableau en liège sur le mur Objectifs',
  'Your buddy roams the whole bedroom: shelves, desk, monitor, bed, beanbag… and visits the other walls':
    'Ton compagnon parcourt toute la chambre : étagères, bureau, écran, lit, pouf… et visite les autres murs',
  'Tap a food bowl on the floor to call him for a snack': 'Touche une gamelle au sol pour l’appeler à manger',
  'Drag him to put him anywhere': 'Fais-le glisser pour le poser n’importe où',
  'Carry your buddy to another wall: hold him at the edge of the screen':
    'Emmène ton compagnon sur un autre mur : tiens-le au bord de l’écran',
  'At night he goes to bed and sleeps under the blanket': 'La nuit, il va au lit et dort sous la couverture',
  'A real window with a sill your buddy can sit on':
    'Une vraie fenêtre avec un rebord où ton compagnon peut s’asseoir',
  'Choose the view (real time, city night, stars, sunset, rain, sunny day) and blinds or curtains':
    'Choisis la vue (temps réel, ville la nuit, étoiles, coucher de soleil, pluie, soleil) et des stores ou des rideaux',
  'Pick the time of day and the weather, or go 🌍 Live: your real sunrise, sunset, weather and temperature':
    'Choisis le moment et la météo, ou passe en 🌍 Direct : ton vrai lever et coucher de soleil, ta météo et ta température',
  'New window scenes: city, mountains, beach, forest and space':
    'Nouvelles vues : ville, montagnes, plage, forêt et espace',
  'Put one of your games on the poster (Customize → Poster → My game). Tap it to open the game':
    'Mets un de tes jeux sur le poster (Personnaliser → Poster → Mon jeu). Touche-le pour ouvrir le jeu',
  'More cover art and poster pictures to choose from': 'Plus de jaquettes et d’images de poster au choix',
  'Find cover art when you edit a game: pick from its covers, artwork, screenshots and Steam art':
    'Trouve une jaquette en modifiant un jeu : choisis parmi ses jaquettes, illustrations, captures et images Steam',
  'Game search now uses IGDB: every console, with real box art':
    'La recherche utilise maintenant IGDB : toutes les consoles, avec les vraies jaquettes',
  'Barcode scanning now recognises most games':
    'Le scan du code-barres reconnaît maintenant la plupart des jeux',
  'Bigger close button on the game card that stays at the top':
    'Bouton de fermeture plus grand sur la fiche du jeu, qui reste en haut',
  'New status: On & off': 'Nouveau statut : De temps en temps',
  'Never-ending games (battle royale, MMO…) in the edit form':
    'Jeux sans fin (battle royale, MMO…) dans le formulaire',
  'The monitor shows a wide screenshot of what you’re playing':
    'L’écran montre une grande capture du jeu en cours',
  'New buddies: cat, dog, fox, bunny, frog and penguin (Customize → Your buddy → Animal)':
    'Nouveaux compagnons : chat, chien, renard, lapin, grenouille et pingouin (Personnaliser → Ton compagnon → Animal)',
  'The Goals wall matches the night room: a dark board with glowing pins':
    'Le mur Objectifs va avec la chambre de nuit : un tableau sombre aux punaises lumineuses',
  'Your rack is sorted into sections (Playing, Backlog, Finished…). Tap a section to fold it into one shelf you scroll sideways':
    'Ton étagère est rangée par sections (En cours, À faire, Terminé…). Touche une section pour la replier en une étagère qui défile',
  '“Played enough”: the finish line for never-ending games':
    '« Assez joué » : la ligne d’arrivée des jeux sans fin',
  'Finished an old game? Pick the day you finished it, or “a long time ago”':
    'Un vieux jeu terminé ? Choisis le jour, ou « il y a longtemps »',
  'New Achievements wall (left of Goals): earn medals to unlock hats, animals, walls and window scenes':
    'Nouveau mur Succès (à gauche des Objectifs) : gagne des médailles pour débloquer chapeaux, animaux, murs et vues',
  'Feed your buddy 10 times to get a second buddy':
    'Nourris ton compagnon 10 fois pour avoir un deuxième compagnon',
  'New status: On hold, for games you stopped but want to get back to':
    'Nouveau statut : En pause, pour les jeux arrêtés que tu veux reprendre',
  'Sync your PlayStation and Xbox games and hours (Settings)':
    'Synchronise tes jeux et heures PlayStation et Xbox (Réglages)',
  'Release years (and genres) now fill in by themselves for synced games':
    'Les années de sortie (et genres) se remplissent seules pour les jeux synchronisés',
  'Automatic Google Drive backup that also syncs your devices (Settings)':
    'Sauvegarde Google Drive automatique qui synchronise aussi tes appareils (Réglages)',
  'Calm mode in Settings: fewer animations, less battery':
    'Mode calme dans les Réglages : moins d’animations, moins de batterie',
  'Safer: sign-in tokens never travel in web addresses':
    'Plus sûr : les jetons de connexion ne passent plus dans les adresses web',
  'The app in French (Settings → Display → Language)': 'L’appli en français (Réglages → Affichage → Langue)',
};

const FR_TPL = [
  ['{1} behind pace', '{1} de retard'],
  ['{1} ahead of pace', '{1} d’avance'],
  [
    '{1} sync didn’t work. Check your helper code is the newest, or try later.',
    'La synchro {1} n’a pas marché. Vérifie que le code du helper est à jour, ou réessaie plus tard.',
  ],
  ['{1}: {2} games added, {3} hours updated', '{1} : {2} jeux ajoutés, {3} heures mises à jour'],
  ['{1} games in the backlog', '{1} jeux à faire'],
  ['{1} games beaten. Nice', '{1} jeux terminés. Bravo'],
  ['{1} games loaded', '{1} jeux chargés'],
  ['{1} is my best friend', '{1} est mon meilleur ami'],
  ['Couldn’t reach {1}. Try again later.', 'Impossible de joindre {1}. Réessaie plus tard.'],
  ['Found the year of {1} of {2} games', 'Année trouvée pour {1} jeux sur {2}'],
  ['Hey! {1} missed you.', 'Coucou ! {1} t’attendait.'],
  ["Hi, I'm {1}! Tap + to add a game.", 'Salut, moi c’est {1} ! Touche + pour ajouter un jeu.'],
  ['Looking up {1} games', 'Recherche de {1} jeux'],
  ['New game! {1}', 'Nouveau jeu ! {1}'],
  ['Paste your {1} first', 'Colle d’abord ton code {1}'],
  ['Ready to get back to {1}?', 'Prêt à retourner sur {1} ?'],
  ['Still playing {1}?', 'Toujours sur {1} ?'],
  ['Syncing with {1}', 'Synchro avec {1}'],
  ['To unlock: {1} (see Achievements)', 'Pour débloquer : {1} (voir Succès)'],
  ['Connected. Last backup: {1}.', 'Connecté. Dernière sauvegarde : {1}.'],
  ['{1} min ago', 'il y a {1} min'],
  ['{1} h ago', 'il y a {1} h'],
  ['How about {1}?', 'Et pourquoi pas {1} ?'],
  ['Now in {1}: {2}°C, {3}', 'En ce moment à {1} : {2} °C, {3}'],
  ['Now playing {1}', 'En cours : {1}'],
  ['You already have {1} achievements! Swipe to see them.', 'Tu as déjà {1} succès ! Glisse pour les voir.'],
  [
    '"{1}" is already on your rack. Add it again (another platform)?',
    '« {1} » est déjà sur ton étagère. L’ajouter encore (autre plateforme) ?',
  ],
  ["{1} games waiting. Can't choose? Let {2} pick.", '{1} jeux attendent. Tu hésites ? Laisse {2} choisir.'],
  ['Achievement: {1}! Unlocked {2}', 'Succès : {1} ! Débloqué : {2}'],
  ['{1} / {2} unlocked', '{1} / {2} débloqués'],
  ['{1} out of 10', '{1} sur 10'],
  ['{1} → {2}', '{1} → {2}'], // these split a phrase in two first
  ['{1} + {2}', '{1} + {2}'],
  ['{1} hat', 'Chapeau {1}'],
  ['{1} window', 'Vue {1}'],
  ['{1} wall', 'Mur {1}'],
]
  .map(([en, fr]) => [en.replace(/[.!?]$/, ''), fr.replace(/ ?[.!?]$/, '')]) // matched without end punctuation
  .map(([en, fr]) => [
    new RegExp('^' + en.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\d\}/g, '(.+?)') + '$'),
    fr,
  ]);

// Emoji, spaces and end punctuation around a phrase ("🏆 Today", "Change…", "Nice!") are kept as they are
const EDGES =
  /^([\s\p{Extended_Pictographic}️‍…!?.:,·⟳∞✕✋▶—-]*)(.*?)([\s\p{Extended_Pictographic}️‍…!?.:,·⟳∞✕✋▶—-]*)$/su;
const frCache = new Map();

function tr(text) {
  if (!text || !/[A-Za-z]/.test(text)) return text;
  if (frCache.has(text)) return frCache.get(text);
  const [, pre, core, post] = text.match(EDGES);
  let out = FR[text] ?? (FR[core] != null ? pre + FR[core] + post : null);
  for (const s of out == null ? [core, text] : []) {
    const hit = FR_TPL.find(([re]) => re.test(s));
    if (!hit) continue;
    const m = s.match(hit[0]);
    out = hit[1].replace(/\{(\d)\}/g, (_, i) => tr(m[i]));
    if (s === core) out = pre + out + post;
    break;
  }
  out ??= text;
  frCache.set(text, out);
  return out;
}

// Game titles, notes and anything typed by you stay as they are
const MINE = '.fb, .notes, .lrow span, .pick h4, textarea, script, style, code';
const ATTRS = ['placeholder', 'aria-label', 'title'];

function translate(root) {
  if (root.nodeType === 3) {
    if (!root.parentElement?.closest(MINE)) {
      const t = tr(root.nodeValue);
      if (t !== root.nodeValue) root.nodeValue = t;
    }
    return;
  }
  if (root.nodeType !== 1 || root.closest(MINE)) return;
  for (const el of [root, ...root.querySelectorAll('[placeholder],[aria-label],[title]')])
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && tr(v) !== v) el.setAttribute(a, tr(v)); // only when it changes, or the observer would loop
    }
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) translate(n);
}

if (french) {
  document.documentElement.lang = 'fr';
  translate(document.body);
  new MutationObserver((list) => {
    for (const m of list)
      if (m.type === 'attributes') {
        const v = m.target.getAttribute(m.attributeName);
        if (v && tr(v) !== v && !m.target.closest(MINE)) m.target.setAttribute(m.attributeName, tr(v));
      } else m.addedNodes.forEach(translate);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
  const ask = window.confirm.bind(window);
  window.confirm = (msg) => ask(tr(msg));
}

/* ---------- Settings ---------- */

$('#sLang').value = set.lang;
$('#sLang').onchange = (e) => {
  set.lang = e.target.value;
  saveSet();
  location.reload();
};
