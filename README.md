# My Gameshelf
A gamer-bedroom app to keep track of your video games. Plain HTML, CSS and JavaScript — no build step, no libraries.
Live at https://spendrax.github.io/My-Gameshelf/

## How it fits together
- `index.html` holds the page: the three walls (Goals, Room, Stats) and every pop-up sheet.
- The scripts load in number order. `01-core.js` comes first and everything else uses it.
- Files talk through small events: after any change to the games, `save()` sends `emit('change')`,
  and the room, the walls and the buddy redraw themselves with `on('change', …)`.
- Games and settings are kept on the phone in `localStorage` (`gr.games`, `gr.set`).

## Where things are
| File | What's in it |
|---|---|
| `index.html` | The page: the room, the walls and every pop-up sheet |
| `css/base.css` | Colours (the LED colour is `--led`), fonts, top bar, form fields |
| `css/room.css` | LED strip, window, neon sign, game cases on the rack, desk and monitor, Customize's room choices |
| `css/buddy.css` | The buddy: body, moods, speech bubble, hearts, confetti, hats |
| `css/walls.css` | Turning the walls, the + button, wall dots, Update button, Stats and Goals walls |
| `css/sheets.css` | Pop-up sheets: add, edit form, game card, Customize, Settings; buttons; toast |
| `js/01-core.js` | Saving games and settings, events, helpers, drawing a game case |
| `js/02-search.js` | The + sheet: searching RAWG (built-in key `RAWG_KEY`) or adding by hand |
| `js/03-edit-form.js` | The add/edit form and shrinking a chosen picture |
| `js/04-game-card.js` | The card shown when you tap a game, with quick buttons |
| `js/05-room.js` | Filter chips, search and sort, the rack, the monitor's "Now playing" |
| `js/06-turning-walls.js` | Swiping round the hexagon: Goals ← Room → Stats |
| `js/07-buddy.js` | The buddy's life: wandering, naps, chatter, cheering, confetti |
| `js/08-stats-goals.js` | The Stats wall and the Goals wall (yearly challenge, backlog roulette) |
| `js/09-customize.js` | The 🎨 sheet: LED, wall, shelves, window, sign, desk items, buddy name/colour/hat |
| `js/10-settings-backup.js` | Settings: your own RAWG key, saving and loading backups |
| `js/11-install-update.js` | Offline copy, "Update now" button, Install button |
| `js/12-whats-new.js` | The "What's new" card: add an entry to `NEWS` for each important update |
| `js/13-scan.js` | Scanning a game case: barcode on the back, or reading the title on the front cover |
| `js/14-steam-sync.js` | Steam sync: adds your Steam games and keeps their hours up to date |
| `tools/cloudflare-helper.js` | The Cloudflare Worker (`HELPER` in 01-core.js): barcode lookups, Steam sync, and backup game search (IGDB, Steam store); holds the Steam and Twitch keys as secrets |
| `js/15-buddy-moves.js` | How the buddy moves: walkable surfaces, walking and jumping, going to other walls, dragging, food bowls |
| `js/16-window-weather.js` | The window view: scenes, time of day, weather, and Live mode (real weather from Open-Meteo) |
| `js/17-achievements.js` | The Achievements wall: medals, what they unlock, the locks in Customize |
| `js/18-friend.js` | The second buddy (unlocked by the Best Friends medal): wanders and naps on the room floor |
| `js/19-console-sync.js` | PlayStation and Xbox sync (through the helper's /psn and /xbox) |
| `js/20-fill-info.js` | Looks up missing release years and genres in the background |
| `sw.js` | Offline copy (bump `V` on every release) |
| `privacy.html` | Privacy policy |

Game info and pictures come from [RAWG](https://rawg.io/apidocs); keep a RAWG link wherever its data shows.
