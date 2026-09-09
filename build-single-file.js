#!/usr/bin/env node
/* Bundle Lumen into one self-contained HTML file.
 *
 *   node build-single-file.js [outfile]
 *
 * Inlines the stylesheet and every script in the order index.html loads them, so the result
 * runs from a single file with no server, no build step and no network access. Useful for
 * emailing it, dropping it on a static host, or publishing it as an artifact.
 *
 * Live mode is unavailable in the bundle when the host blocks outbound requests (an artifact
 * does); demo mode is fully functional either way.
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const args = process.argv.slice(2);
// --fragment emits page content only (no doctype/html/head/body), for hosts that wrap the
// page in their own skeleton. The default is a complete standalone document.
const fragment = args.indexOf('--fragment') >= 0;
const out = args.filter((a) => a.charAt(0) !== '-')[0]
  || path.join(root, fragment ? 'lumen-artifact.html' : 'lumen-terminal.html');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error('missing ' + rel + ' — run this from the repo root');
  return fs.readFileSync(p, 'utf8');
}

// A closing </script> anywhere inside inlined JS would end the tag early.
function safe(js) { return js.replace(/<\/script>/gi, '<\\/script>'); }

let outHtml = html.replace(
  /<link rel="stylesheet" href="([^"]+)">/,
  (_, href) => '<style>\n' + read(href) + '\n</style>'
);

const scripts = [];
outHtml = outHtml.replace(/[ \t]*<script src="([^"]+)"><\/script>\n?/g, (_, src) => {
  scripts.push(src);
  return '';
});
if (!scripts.length) throw new Error('no <script src> tags found in index.html');

const bundle = scripts
  .map((src) => '/* ==== ' + src + ' ==== */\n' + safe(read(src)))
  .join('\n\n');

// Function replacement, not a string: a literal `$'` or `$&` in the JS would otherwise be
// interpreted as a regex substitution pattern and silently corrupt the bundle.
outHtml = outHtml.replace('</body>', () => '<script>\n' + bundle + '\n</script>\n</body>');

if (fragment) {
  const title = (outHtml.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
  const style = (outHtml.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
  const body = (outHtml.match(/<body>([\s\S]*)<\/body>/) || [null, ''])[1];
  outHtml = title + '\n' + style + '\n' + body.trim() + '\n';
}

fs.writeFileSync(out, outHtml);
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log('wrote ' + path.relative(root, out) + ' (' + kb + ' KB, ' + scripts.length + ' scripts inlined'
  + (fragment ? ', fragment mode' : '') + ')');
