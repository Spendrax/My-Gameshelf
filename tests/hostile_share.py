"""A shared room full of attack attempts must open without running any of them.
Run from the repo folder with a local server: python3 -m http.server 8765 & python3 tests/hostile_share.py"""
from playwright.sync_api import sync_playwright
import json

BAD = '"><img src=x onerror="window.PWNED=1">\'`<script>window.PWNED=2</script>'
game = {k: BAD for k in ['id', 'title', 'platform', 'status', 'rating', 'hours', 'year', 'started', 'finished', 'added', 'format']}
game.update({
    'cover': "https://x.com/a.jpg\" onload=\"window.PWNED=3",
    'genres': [BAD], 'tags': [BAD], 'beatenOn': [BAD],
    'facts': {'beat': BAD, 'full': BAD, 'release': BAD},
    'tro': [BAD, BAD, BAD], 'merged': [{'platform': BAD, 'hours': BAD}],
})
data = {
    'gr.games': [game, dict(game, id='b', status='finished')],
    'gr.set': {'pet': BAD, 'owner': BAD, 'led': 'red;background:url(x)', 'goal': BAD,
               'look': {'kind': BAD, 'sign': BAD, 'fname': BAD, 'wall': BAD, 'loc': {'lat': 45.5, 'lon': -73.6, 'name': 'Montréal'}, 'hide': [BAD]},
               'rackOpen': {BAD: True, 'backlog': True}, 'ach': {'done': [BAD], 'keep': [BAD], 'pets': BAD},
               'log': {BAD: 5, '2026-11-01': BAD}},
}
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(service_workers='block', viewport={'width': 400, 'height': 800})
    c.route('**/shelf?*', lambda r: r.fulfill(json={'data': data}))
    pg = c.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/shelf.html?id=evil')
    pg.wait_for_timeout(2500)
    for w in ['room', 'stats', 'goals', 'ach']:
        pg.evaluate(f"go(WALLS.{w}, true)")
        pg.wait_for_timeout(300)
    pg.evaluate("openGame(games[0].id)")
    pg.wait_for_timeout(400)
    r = pg.evaluate("""[window.PWNED || 0, document.querySelectorAll('script:not([src])').length,
      [...document.querySelectorAll('img')].filter(i => i.getAttribute('onerror') || i.getAttribute('onload')).length,
      JSON.stringify(set.look.loc || null), games.length, games[0].status, set.led]""")
    print('pwned', r[0], 'inline scripts', r[1], 'handlers', r[2], 'loc', r[3], 'games', r[4], 'status', r[5], 'led', r[6])
    print('errors', errs)
    assert r[0] == 0 and r[2] == 0 and r[3] == 'null', 'UNSAFE'
    print('SAFE')
