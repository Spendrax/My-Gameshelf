from playwright.sync_api import sync_playwright
import json
G=[{'id':'a','title':'Hades','platform':'PS5','status':'playing','rating':9,'hours':10,'genres':[],'notes':'','added':1,'psn':'P1'},
   {'id':'b','title':'Hades','platform':'Nintendo Switch','status':'backlog','rating':7,'hours':5,'genres':[],'notes':'','added':2,'ns':'N1'},
   {'id':'c','title':'Hollow Knight Silksong','platform':'PC','status':'wishlist','rating':0,'hours':0,'genres':[],'notes':'','added':3},
   {'id':'d','title':'Celeste','platform':'PC','status':'finished','finished':'2026-03-02','rating':10,'hours':8,'genres':[],'notes':'','added':4}]
with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(service_workers='block',viewport={'width':400,'height':800}); pg=c.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('**/facts',lambda r:r.fulfill(json={'facts':{'a':{'igdb':1,'beat':22,'full':40,'release':'2020-09-17'},'c':{'igdb':2,'beat':30,'release':'2027-02-01'}}}))
    pg.route('**/deals',lambda r:r.fulfill(json={'deals':{'c':{'cut':40,'price':17.99,'currency':'CAD','shop':'Steam','url':'https://store.steampowered.com'}}}))
    pg.add_init_script(f"if(!localStorage.getItem('gr.games'))localStorage.setItem('gr.games',{json.dumps(json.dumps(G))})")
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
    pg.evaluate("fillFacts().then(()=>checkDeals())"); pg.wait_for_timeout(800)
    print('badges:', pg.evaluate("[...document.querySelectorAll('#rack .badge')].map(x=>x.textContent)"))
    pg.evaluate("openGame('a')"); pg.wait_for_timeout(200)
    print('card:', pg.inner_text('#gBody').replace('\n',' | ')[:400])
    # timer
    pg.click('[data-t=start]'); pg.evaluate("set.timer.start-=90*60e3"); pg.click('[data-t=stop]'); pg.wait_for_timeout(200)
    print('after timer:', pg.evaluate("[byId('a').hours, set.log[today()], streak(), $('#playChip').hidden]"))
    # merge
    pg.on('dialog', lambda d: d.accept())
    pg.click('[data-merge=b]'); pg.wait_for_timeout(200)
    print('merged:', pg.evaluate("[games.length, byId('a').hours, JSON.stringify(byId('a').merged)]"))
    # sync tops up merged part
    pg.evaluate("importGames([{id:'N1',name:'Hades',minutes:480}],{field:'ns',sameKind:/switch/i})")
    print('after ns sync:', pg.evaluate("[byId('a').hours, byId('a').merged[0].hours, games.length]"))
    pg.evaluate("importGames([{id:'P1',name:'Hades',minutes:720}],{field:'psn',sameKind:/ps/i})")
    print('after psn sync:', pg.evaluate("[byId('a').hours, games.length]"))
    pg.evaluate("$('#dlgGame').close()")
    # year in review
    pg.evaluate("go(WALLS.stats,true)"); pg.wait_for_timeout(300); pg.click('#yearBtn'); pg.wait_for_timeout(200)
    print('year:', pg.inner_text('#yrBody').replace('\n',' | ')[:250])
    pg.evaluate("$('#dlgYear').close(); go(0,true)"); pg.wait_for_timeout(400)
    # drag Celeste... drag the wishlist game onto Playing section header
    box=pg.locator('#rack .case[data-id=c]').bounding_box(); tgt=pg.locator('#rack .grp-h[data-g=playing]').bounding_box()
    print(box,tgt)
    pg.mouse.move(box['x']+20,box['y']+30); pg.mouse.down(); pg.wait_for_timeout(600)
    print('drop bar:', pg.evaluate("!!document.querySelector('.drop-bar')"))
    pg.mouse.move(tgt['x']+30,tgt['y']+10,steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
    print('dragged status:', pg.evaluate("byId('c').status"))
    # treats
    pg.evaluate("treatGame()"); pg.wait_for_timeout(1500); n=pg.evaluate("document.querySelectorAll('.treats span').length"); print('treats falling:', n)
    print('stats extra:', 'Collection' in pg.content(), 'errors:', errs)
    b.close()
