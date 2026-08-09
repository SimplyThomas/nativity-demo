import puppeteer from 'puppeteer-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SITE_URL || `file://${REPO}`;

/* Resolve a browser: CI runners and local machines put it in different places. */
import { existsSync } from 'node:fs';
const CHROME = [
  process.env.CHROME_PATH,
  '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/opt/google/chrome/chrome',
].find(p => p && existsSync(p));
if (!CHROME) {
  console.error('No Chrome/Chromium found. Set CHROME_PATH to a browser binary.');
  process.exit(2);
}
const PAGES=['index.html','visit.html','faith.html','calendar.html','ministries.html','about.html',
  'give.html','contact.html','festival.html','hall.html','bookstore.html','mobile-views.html'];
const b=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-gpu']});
console.log('WCAG 1.4.10 Reflow — viewport 320x800, no horizontal scrolling allowed\n');
let bad=0;
for(const f of PAGES){
  const p=await b.newPage();
  await p.setViewport({width:320,height:800});
  await p.goto(`${BASE}/${f}`,{waitUntil:'networkidle0'});
  const r=await p.evaluate(()=>{
    const d=document.documentElement;
    const over=[...document.querySelectorAll('*')]
      .filter(e=>e.getBoundingClientRect().right > d.clientWidth+1)
      .slice(0,3).map(e=>e.tagName.toLowerCase()+'.'+(e.className||'').split(' ')[0]);
    return {scrollW:d.scrollWidth, clientW:d.clientWidth, over};
  });
  const ok = r.scrollW <= r.clientW+1;
  if(!ok) bad++;
  console.log(`  ${ok?'PASS':'FAIL'}  ${f.padEnd(18)} scrollWidth ${r.scrollW} vs ${r.clientW}${ok?'':'   overflowing: '+r.over.join(', ')}`);
  await p.close();
}
// keyboard focus check on one representative page
const p=await b.newPage();
await p.setViewport({width:1440,height:900});
await p.goto(`${BASE}/contact.html`,{waitUntil:'networkidle0'});
const focus=await p.evaluate(()=>{
  const out=[];
  const els=[...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')];
  for(const el of els.slice(0,60)){
    el.focus();
    const s=getComputedStyle(el);
    const visible = (s.outlineStyle!=='none' && parseFloat(s.outlineWidth)>0) || s.boxShadow!=='none';
    out.push({tag:el.tagName.toLowerCase(), visible});
  }
  return {total:els.length, noRing:out.filter(o=>!o.visible).length};
});
console.log(`\nKeyboard focus (contact.html): ${focus.total} focusable elements, ${focus.noRing} without a visible focus indicator`);
await b.close();
process.exit(bad?1:0);
