# Tests

Run from the repo folder. The browser tests need Python Playwright and a local server:

```
python3 -m http.server 8765 &
python3 tests/full_app.py        # every wall, dialog and button, in English and French
python3 tests/features.py        # timer, merge, sync, time to beat, sales, year in review, drag, treats
python3 tests/touch_drag.py      # dragging a game with a finger
python3 tests/hostile_share.py   # a shared room full of attack attempts runs none of them
node tests/files_exist.mjs       # the offline copy has every file it needs
node tests/helper_share.mjs      # helper: shared rooms (save, update, wrong key, stop)
node tests/helper_prices.mjs     # helper: library worth (Steam price first, console names)
node tests/helper_nintendo.mjs   # helper: Nintendo games and hours
```
