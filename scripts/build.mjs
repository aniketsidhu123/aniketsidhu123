import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await fs.readFile(path.join(root, 'profile.json'), 'utf8'));
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const attrs = s => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
await fs.mkdir(path.join(root,'assets'),{recursive:true});
await fs.mkdir(path.join(root,'data'),{recursive:true});
let html;
if (process.argv.includes('--offline')) {
  html = null;
} else if (process.argv[2]) {
  html = await fs.readFile(process.argv[2],'utf8');
} else {
  const response = await fetch(`https://github.com/users/${encodeURIComponent(config.username)}/contributions`, {signal:AbortSignal.timeout(30000),headers:{'User-Agent':'profile-readme-builder'}});
  if (!response.ok) throw new Error(`GitHub returned ${response.status}; existing assets preserved`);
  html = await response.text();
}
let days;
if (html !== null) {
  const tips = new Map([...html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)].map(m=>[attrs(m[1]).for,m[2].replace(/<[^>]+>/g,'').trim()]));
  days = [...html.matchAll(/<td\b([^>]*)>/g)].map(m=>attrs(m[1])).filter(a=>a['data-date']).map(a=>{
    const tip = tips.get(a.id) ?? '';
    const count = /^No contributions/.test(tip) ? 0 : Number(tip.match(/^([\d,]+) contribution/)?.[1]?.replaceAll(',',''));
    const level = Number(a['data-level']);
    if (!Number.isFinite(count) || !Number.isInteger(level) || level<0 || level>4) throw new Error('GitHub calendar format changed; existing data preserved');
    return {date:a['data-date'],count,level};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  if (days.length < 350 || new Set(days.map(d=>d.date)).size!==days.length) throw new Error('Incomplete calendar; existing data preserved');
  await fs.writeFile(path.join(root,'data/contributions.json'),JSON.stringify(days,null,2)+'\n');
} else days = JSON.parse(await fs.readFile(path.join(root,'data/contributions.json'),'utf8'));
const text = (x,y,s,cls='') => `<text x="${x}" y="${y}" class="${cls}">${esc(s)}</text>`;
function frame(w,h,title,body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title"><title id="title">${esc(title)}</title><style>text{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;fill:#dce5ee;font-size:13px}.muted{fill:#7e91a6;font-size:11px}.accent{fill:#67e8c0}.heading{font-size:24px;font-weight:700}.reveal{animation:reveal .65s both;animation-delay:var(--delay,0s)}@keyframes reveal{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.reveal{animation:none}}</style><rect x="1" y="1" width="${w-2}" height="${h-2}" rx="14" fill="#0b111b" stroke="#243244"/><path d="M1 41H${w-1}" stroke="#243244"/><circle cx="20" cy="21" r="4" fill="#ff7369"/><circle cx="35" cy="21" r="4" fill="#eac15a"/><circle cx="50" cy="21" r="4" fill="#67e8c0"/>${text(70,25,title,'muted')}${body}</svg>`;
}
const monogram = ['     AAA       SSSSSSS  ','    AAAAA     SSS       ','   AAA AAA    SSS       ','  AAA   AAA    SSSSSS   ','  AAAAAAAAA        SSS  ','  AAA   AAA        SSS  ','  AAA   AAA    SSSSSSS  '];
let portrait = text(24,77,'IDENTITY / 01','muted');
monogram.forEach((s,i)=>portrait+=`<g class="reveal" style="--delay:${i*.13}s"><text x="25" y="${115+i*18}" xml:space="preserve" class="accent" style="font-size:17px;font-weight:700">${esc(s)}</text></g>`);
portrait+=text(25,268,'ANIKET SIDHU','heading')+text(25,293,'@'+config.username,'muted');
await fs.writeFile(path.join(root,'assets/identity.svg'),frame(330,320,'~/identity',portrait));
let info = text(25,82,config.name,'heading')+text(25,108,'AI that sees, predicts & explains','accent');
config.rows.forEach(([k,v],i)=>info+=`<g class="reveal" style="--delay:${.2+i*.15}s">${text(25,148+i*29,k,'muted')}${text(120,148+i*29,v)}</g>`);
await fs.writeFile(path.join(root,'assets/info.svg'),frame(530,320,'~/about.json',info));
const start=new Date(days[0].date+'T00:00:00Z'); start.setUTCDate(start.getUTCDate()-start.getUTCDay());
const palette=['#172331','#145746','#21896b','#40bc96','#83f2cc'];
let graph=text(25,78,'CONTRIBUTION LOG','accent');
let lastMonth='';
for (const d of days) {
  const date=new Date(d.date+'T00:00:00Z');
  const col=Math.floor((date-start)/604800000),row=date.getUTCDay();
  const month=d.date.slice(0,7);
  if(month!==lastMonth && row===0){graph+=text(53+col*14,105,date.toLocaleString('en',{month:'short',timeZone:'UTC'}),'muted');lastMonth=month;}
  graph+=`<rect class="reveal" style="--delay:${(col*.018+row*.035).toFixed(3)}s" x="${53+col*14}" y="${117+row*15}" width="11" height="11" rx="3" fill="${palette[d.level]}"><title>${d.date}: ${d.count} contributions</title></rect>`;
}
graph+=text(20,143,'M','muted')+text(20,173,'W','muted')+text(20,203,'F','muted');
const total=days.reduce((s,d)=>s+d.count,0),active=days.filter(d=>d.count>0).length;
graph+=text(25,254,`${total.toLocaleString('en-US')} contributions · ${active} active days`)+text(25,279,`${days[0].date} — ${days.at(-1).date} · GitHub calendar`,'muted');
palette.forEach((c,i)=>graph+=`<rect x="${728+i*17}" y="245" width="11" height="11" rx="3" fill="${c}"/>`);
graph+=text(686,255,'Less','muted')+text(815,255,'More','muted');
await fs.writeFile(path.join(root,'assets/contributions.svg'),frame(880,300,'~/activity',graph));
console.log(`Built 3 SVGs: ${days.length} days, ${total} contributions, ${active} active days`);
