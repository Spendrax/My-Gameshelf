// Every file the offline copy (sw.js SHELL) needs must exist, or the app can't install its update.
import { readFileSync, existsSync } from 'node:fs';
const shell = readFileSync('sw.js', 'utf8').match(/SHELL\s*=\s*\[([\s\S]*?)\]/)[1].match(/'[^']+'/g).map((x) => x.slice(1, -1));
const missing = shell.filter((f) => f !== './' && !existsSync(f));
console.log(missing.length ? 'MISSING: ' + missing.join(', ') : `all ${shell.length} files present`);
process.exit(missing.length ? 1 : 0);
