# My Gameshelf
A gamer-bedroom app to keep track of your video games. Plain HTML, CSS and JavaScript — no build step.
Live at https://spendrax.github.io/My-Gameshelf/

## Where things are
| File | What's in it |
|---|---|
| `index.html` | The page: the room, the walls and every pop-up window |
| `css/style.css` | All the styling (LED colour is `--led`) |
| `js/01-core.js` | Saving games, helpers, game search (RAWG), the add/edit form, the game card, settings and backups |
| `js/02-room.js` | Filter chips, the wall rack of cases, the monitor's "Now playing", the tabs |
| `js/03-pet.js` | The buddy on the desk: wandering, blinking, naps, chatter, cheering, confetti |
| `js/04-walls.js` | The stats wall and the goals wall (yearly challenge, backlog roulette) |
| `js/05-install.js` | Offline copy and the Install button |
| `sw.js` | Offline copy (bump `V` on every release) |
| `privacy.html` | Privacy policy |

Game search uses the free [RAWG](https://rawg.io/apidocs) API; each person pastes their own key in the app.
