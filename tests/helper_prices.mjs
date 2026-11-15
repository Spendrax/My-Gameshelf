const asked=[];
globalThis.fetch=async(u,i)=>{const b=i?.body?JSON.parse(i.body):null;const J=o=>new Response(JSON.stringify(o));
 if(String(u).includes('lookup/id/shop'))return J({});
 if(String(u).includes('lookup/id/title')){asked.push(b);return J(Object.fromEntries(b.map(t=>[t, t==='The Witcher 3: Wild Hunt'?'W3':t==='Hades'?'H':null])));}
 return J([{id:'W3',deals:[{shop:{id:35,name:'GOG'},price:{amount:9.99,currency:'CAD'},regular:{amount:39.99}},{shop:{id:61,name:'Steam'},price:{amount:12.99,currency:'CAD'},regular:{amount:39.99}}]},{id:'H',deals:[{shop:{id:35},price:{amount:20,currency:'CAD'},regular:{amount:25}}]}]);};
const w=(await import('../tools/cloudflare-helper.js')).default;
const r=await w.fetch(new Request('https://x/deals',{method:'POST',headers:{Origin:'https://spendrax.github.io'},body:JSON.stringify({all:true,games:[{key:'a',name:'The Witcher 3: Wild Hunt – Remastered'},{key:'b',name:'Hades'},{key:'c',name:'Zelda: Tears of the Kingdom'}]})}),{ITAD_KEY:'k'});
console.log(JSON.stringify(await r.json())); console.log(JSON.stringify(asked));
