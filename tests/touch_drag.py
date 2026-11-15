"""Hold a game with a finger, drag it onto another section, let go: its status must change.
Uses real touch events (a phone), not a mouse. Needs a local server on port 8765."""
from playwright.sync_api import sync_playwright
import json

G = [{'id': 'a', 'title': 'Hades', 'platform': 'PC', 'status': 'backlog', 'hours': 1, 'added': 1},
     {'id': 'b', 'title': 'Celeste', 'platform': 'PC', 'status': 'playing', 'hours': 1, 'added': 2}]
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(service_workers='block', viewport={'width': 400, 'height': 800}, has_touch=True, is_mobile=True)
    pg = c.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(f"localStorage.setItem('gr.games',{json.dumps(json.dumps(G))});localStorage.setItem('gr.set',JSON.stringify({{toured:true,seen:VERSION_PLACEHOLDER}}))".replace('VERSION_PLACEHOLDER', "'9'"))
    pg.goto('http://localhost:8765/')
    pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
    cdp = c.new_cdp_session(pg)
    case = pg.locator('#rack .case[data-id=a]').bounding_box()
    target = pg.locator('#rack .grp-h[data-g=playing]').bounding_box()
    x, y = case['x'] + case['width'] / 2, case['y'] + case['height'] / 2
    tx, ty = target['x'] + 40, target['y'] + target['height'] / 2
    touch = lambda kind, px, py: cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [] if kind == 'touchEnd' else [{'x': px, 'y': py}]})
    touch('touchStart', x, y)
    pg.wait_for_timeout(650)  # hold
    started = pg.evaluate('!!drag')
    for i in range(1, 11):
        touch('touchMove', x + (tx - x) * i / 10, y + (ty - y) * i / 10)
        pg.wait_for_timeout(30)
    swiped = pg.evaluate('view')
    touch('touchEnd', tx, ty)
    pg.wait_for_timeout(400)
    status = pg.evaluate("byId('a').status")
    opened = pg.evaluate("$('#dlgGame').open")
    print('drag started', started, '| wall still room', swiped == 'room', '| status', status, '| card opened by mistake', opened, '| errors', errs)
    assert started and status == 'playing' and not opened and not errs
    print('OK')
