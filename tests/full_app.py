from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/a496db47-0267-5c2a-a0b6-ccc2e92f90d0/scratchpad/'
with sync_playwright() as p:
    b=p.chromium.launch()
    for loc in ['en-US','fr-FR']:
     pg=b.new_page(locale=loc,viewport={'width':390,'height':844},device_scale_factor=2)
     errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
     pg.add_init_script("if(!localStorage.getItem('gr.set'))localStorage.setItem('gr.set',JSON.stringify({toured:true}))")
     pg.goto('http://localhost:8765/'); pg.wait_for_timeout(500)
     for t,st,pl,r,h in [('Hollow Knight','finished','Nintendo Switch',9,40),('Elden Ring','playing','PlayStation 5',10,120),('Hades','backlog','PC',0,0),('Celeste','backlog','Nintendo Switch',7,3)]:
         pg.click('#btnAdd'); pg.click('#addManual')
         pg.fill('[name=title]',t); pg.fill('[name=platform]',pl); pg.click(f'#eStatus [data-s={st}]')
         if st=='finished' and pg.is_visible('#dlgWhen'): pg.click('[data-when=today]')
         if r: pg.click(f'#eRate [data-r="{r}"]')
         pg.fill('[name=hours]',str(h)); pg.click('#fEdit .btn.primary'); pg.wait_for_timeout(150)
     pg.click('.case[data-id]'); pg.click('#gBody [data-q=hour]'); pg.click('#gBody [data-close]')
     pg.click('#btnLook'); pg.click('#cBody [data-k=hat] [data-v=cap]'); pg.click('#cBody [data-k=shelf] [data-v=metal]'); pg.click('#dlgLook [data-close]')
     pg.wait_for_timeout(500); pg.evaluate("$('#view-room').scrollTo(0,0)")
     m=pg.mouse; m.move(300,500); m.down(); m.move(150,500,steps=6); m.up(); pg.wait_for_timeout(500)
     stats=pg.evaluate("view+' '+$('#view-stats .kpi b').textContent")
     pg.click('.dots [data-k="-1"]'); pg.wait_for_timeout(500); pg.click('#spin'); pg.wait_for_timeout(1500)
     pg.click('#btnSettings'); print('ver',pg.evaluate("$('#ver').textContent")); pg.click('#dlgSet [data-close]')
     print(stats, pg.evaluate('view'), pg.evaluate('games.length'), errs)
    b.close()
