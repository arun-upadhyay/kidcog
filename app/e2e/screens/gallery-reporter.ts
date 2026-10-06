import fs from 'node:fs';
import path from 'node:path';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * Builds screens-report/index.html: one row per screen, one column per device,
 * every screenshot the suite took, with problems listed under each device.
 * Open it with `npm run test:screens:gallery` to eyeball a release in a minute.
 */
type Shot = { file: string; screen: string; device: string };

export default class GalleryReporter implements Reporter {
  private out = path.resolve('screens-report');
  private shots: Shot[] = [];
  private problems = new Map<string, string[]>();
  private devices: string[] = [];

  onBegin() {
    fs.rmSync(this.out, { recursive: true, force: true });
    fs.mkdirSync(path.join(this.out, 'img'), { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const device = test.parent.project()?.name ?? 'device';
    if (!this.devices.includes(device)) this.devices.push(device);
    for (const a of result.attachments) {
      if (!a.name.startsWith('screen:') || !a.body) continue;
      const screen = a.name.slice('screen:'.length);
      const file = `img/${slug(device)}--${slug(screen)}.png`;
      fs.writeFileSync(path.join(this.out, file), a.body);
      this.shots.push({ file, screen, device });
    }
    const list = this.problems.get(device) ?? [];
    for (const e of result.errors) list.push(`${test.title}: ${strip(e.message ?? '').split('\n')[0]}`);
    for (const n of result.annotations) if (n.type === 'warning' && n.description) list.push(`⚠ ${n.description}`);
    this.problems.set(device, list);
  }

  onEnd(result: FullResult) {
    const screens = [...new Set(this.shots.map(s => s.screen))];
    const cell = (screen: string, device: string) => {
      const shot = this.shots.find(s => s.screen === screen && s.device === device);
      return shot ? `<td><a href="${shot.file}" target="_blank"><img loading="lazy" src="${shot.file}"></a></td>` : '<td class="none">—</td>';
    };
    const issues = this.devices.map(d => {
      const list = this.problems.get(d) ?? [];
      return `<li><b>${esc(d)}</b>: ${list.length ? `<ul>${list.map(p => `<li class="${p.startsWith('⚠') ? 'warn' : 'bad'}">${esc(p)}</li>`).join('')}</ul>` : '<span class="ok">all good</span>'}</li>`;
    }).join('');
    const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KidCog screens</title>
<style>
body{font:14px system-ui,-apple-system,sans-serif;margin:16px;color:#2a2118;background:#fff8ef}
h1{font-size:20px} .status{font-weight:700;color:${result.status === 'passed' ? '#2f7a4f' : '#b83a37'}}
table{border-collapse:collapse} th,td{border:1px solid #eadfd0;padding:6px;vertical-align:top;background:#fff}
th{position:sticky;top:0;background:#f3eee7;font-size:12px;max-width:180px} th.row{position:sticky;left:0;text-align:left;z-index:1}
img{width:160px;display:block} .none{color:#b5a898;text-align:center}
.ok{color:#2f7a4f;font-weight:700} .bad{color:#b83a37} .warn{color:#8a5a0a} ul{margin:4px 0}
.wrap{overflow:auto;max-height:80vh}
</style>
<h1>KidCog on ${this.devices.length} devices · <span class="status">${result.status}</span> · ${new Date().toLocaleString()}</h1>
<details ${result.status === 'passed' ? '' : 'open'}><summary>Problems by device</summary><ul>${issues}</ul></details>
<div class="wrap"><table><tr><th class="row">Screen</th>${this.devices.map(d => `<th>${esc(d)}</th>`).join('')}</tr>
${screens.map(s => `<tr><th class="row">${esc(s)}</th>${this.devices.map(d => cell(s, d)).join('')}</tr>`).join('\n')}
</table></div>`;
    fs.writeFileSync(path.join(this.out, 'index.html'), html);
    console.log(`\nScreen gallery: ${path.join(this.out, 'index.html')}`);
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
// eslint-disable-next-line no-control-regex
const strip = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');
