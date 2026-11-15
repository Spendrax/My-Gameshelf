"""Visiting someone's shared room must not delete YOUR cover photos (kept in the 'gs-photos' storage).
Needs a local server on port 8765, with the offline helper (service worker) allowed."""
from playwright.sync_api import sync_playwright
import json

MINE = [{'id': 'm', 'title': 'My game', 'platform': 'PC', 'status': 'backlog', 'hours': 1, 'added': 1, 'cover': 'photos/m-1.jpg'}]
SHARED = {'gr.games': [{'id': 'x', 'title': 'Their game', 'status': 'playing'}], 'gr.set': {'pet': 'Bo'}}
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 400, 'height': 800})
    c.route('**/shelf?*', lambda r: r.fulfill(json={'data': SHARED}))
    pg = c.new_page()
    pg.add_init_script(f"if(!localStorage.getItem('gr.games')){{localStorage.setItem('gr.games',{json.dumps(json.dumps(MINE))});localStorage.setItem('gr.set',JSON.stringify({{toured:true}}))}}")
    pg.goto('http://localhost:8765/')
    pg.wait_for_function("navigator.serviceWorker.controller", timeout=20000)
    pg.wait_for_timeout(1000)
    pg.evaluate("caches.open('gs-photos').then(c => c.put('photos/m-1.jpg', new Response('pic')))")
    v = c.new_page()
    v.goto('http://localhost:8765/shelf.html?id=friend')
    v.wait_for_timeout(4000)  # keepPhotos runs 2 s after start
    v.evaluate("emit('change')")
    v.wait_for_timeout(1500)
    left = pg.evaluate("caches.open('gs-photos').then(c => c.keys()).then(k => k.length)")
    print('controlled', v.evaluate("!!navigator.serviceWorker.controller"), '| your photos left:', left)
    assert left == 1, 'a visit deleted your photos'
    print('OK')
