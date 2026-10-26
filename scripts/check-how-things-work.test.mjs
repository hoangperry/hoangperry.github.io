import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateHowThingsWork } from './check-how-things-work.mjs';

const payloads = {
  '_includes/how-things-work/c-41-scene.html': '{% raw %}<figure><div id="machine-scene"><svg class="fp-svg op-svg" viewBox="0 0 10 10"></svg></div></figure>{% endraw %}',
  '_includes/how-things-work/c-41-console.html': '{% raw %}<section id="operation">Controls</section>{% endraw %}',
  'assets/how-things-work/c-41/c41.js': '(() => { /* self-contained fixture, not a simulator */ })();\n',
  'assets/how-things-work/c-41/c41.css': '.htw-c41 { color: #eee; }\n',
  'assets/how-things-work/c-41/thumbnail.webp': 'test-image-bytes',
  'assets/how-things-work/c-41/NOTICE.txt': 'MIT attribution fixture\n',
};
const manifestPath = 'assets/how-things-work/c-41/manifest.json';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const put = (root, relative, value) => {
  const file = join(root, relative);
  mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, value); return file;
};
function fixture(t, baseurl = '') {
  const root = mkdtempSync(join(tmpdir(), 'htw-validator-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  put(root, '_config.yml', 'baseurl: ""\n');
  for (const [path, content] of Object.entries(payloads)) put(root, path, content);
  const manifest = { schemaVersion: 1, topic: 'c-41', sourceDigest: 'a'.repeat(64), files: Object.fromEntries(Object.entries(payloads).map(([p, v]) => [p, sha(v)])) };
  put(root, manifestPath, JSON.stringify(manifest));
  const site = join(root, 'output');
  for (const [path, content] of Object.entries(payloads)) if (path.startsWith('assets/')) put(site, path, content);
  put(site, manifestPath, JSON.stringify(manifest));
  const hub = `${baseurl}/how-things-work/`;
  const article = `${hub}c-41/`;
  const asset = `${baseurl}/assets/how-things-work/c-41/`;
  const page = (body, head = '') => `<!doctype html><html lang="vi"><head><title>How Things Work / C-41</title>${head}</head><body>${body}</body></html>`;
  put(site, 'index.html', page(`<a href="${hub}">How Things Work</a>`));
  put(site, 'photography/index.html', page(`<a href="${article}">C-41</a>`));
  put(site, 'how-things-work/index.html', page(`<a href="${article}"><img src="${asset}thumbnail.webp" alt="Máy tráng phim">C-41</a>`));
  put(site, 'how-things-work/c-41/index.html', page(`<a href="${hub}">How Things Work</a><div class="htw-c41 iso" data-htw-figure="c-41"><div data-htw-reader-slot><div data-htw-scene><svg class="fp-svg op-svg" viewBox="0 0 10 10"></svg></div></div><div data-htw-story><section data-htw-step="all">Explanation</section></div><button data-htw-mode="explore">Try</button><div data-htw-explore-slot></div><div data-htw-explore-controls hidden inert><button data-htw-mode="reader">Read</button><section id="operation">Controls</section></div></div><script src="${asset}c41.js"></script>`, `<link rel="stylesheet" href="${asset}c41.css">`));
  return { root, site, manifest, articleFile: join(site, 'how-things-work/c-41/index.html') };
}
const fail = (result, pattern) => {
  assert.equal(result.ok, false); assert.match(result.errors.join('\n'), pattern);
};

test('valid manifest and static built routes pass at root and subpath, without writes', (t) => {
  for (const baseurl of ['', '/preview']) {
    const { root, site } = fixture(t, baseurl);
    const file = join(root, manifestPath); const before = statSync(file).mtimeMs;
    const result = validateHowThingsWork({ root, site, baseurl });
    assert.deepEqual(result.errors, []); assert.equal(result.ok, true);
    assert.equal(result.filesChecked, 6); assert.equal(result.routesChecked, 2);
    assert.equal(statSync(file).mtimeMs, before);
  }
});
test('source-only validation does not require a site build or upstream checkout', (t) => {
  const { root, site } = fixture(t); rmSync(site, { recursive: true });
  assert.equal(validateHowThingsWork({ root }).ok, true);
});
test('wrong schema, topic and source digest are rejected', (t) => {
  for (const [key, value] of [['schemaVersion', 2], ['topic', 'other'], ['sourceDigest', '/Users/private/path']]) {
    const { root, manifest } = fixture(t); manifest[key] = value;
    put(root, manifestPath, JSON.stringify(manifest));
    fail(validateHowThingsWork({ root }), /schema|topic|sourceDigest/i);
  }
});
test('missing or tampered payload fails actual hashes', (t) => {
  const { root } = fixture(t);
  put(root, 'assets/how-things-work/c-41/c41.js', 'tampered');
  fail(validateHowThingsWork({ root }), /hash|digest/i);
  rmSync(join(root, 'assets/how-things-work/c-41/c41.js'));
  fail(validateHowThingsWork({ root }), /missing|ENOENT|not found/i);
});
test('manifest cannot whitelist arbitrary paths, traversal or extra files', (t) => {
  for (const path of ['../outside', '/tmp/private', 'assets/unrelated.js']) {
    const { root, manifest } = fixture(t); manifest.files[path] = 'b'.repeat(64);
    put(root, manifestPath, JSON.stringify(manifest));
    fail(validateHowThingsWork({ root }), /path|payload|whitelist|expected/i);
  }
});
test('symlinks in source payloads or manifest cannot escape the blog', (t) => {
  for (const path of [manifestPath, 'assets/how-things-work/c-41/c41.js']) {
    const { root } = fixture(t);
    const outside = mkdtempSync(join(tmpdir(), 'htw-outside-'));
    t.after(() => rmSync(outside, { recursive: true, force: true }));
    const secret = put(outside, 'file', 'not a valid payload');
    rmSync(join(root, path)); symlinkSync(secret, join(root, path));
    fail(validateHowThingsWork({ root }), /symlink|outside|escape/i);
  }
});
test('raw includes cannot contain an early endraw or whole HTML document', (t) => {
  for (const content of ['{% raw %}<svg></svg>{% endraw %}unsafe{% endraw %}', '{% raw %}<html><body>x</body></html>{% endraw %}']) {
    const { root, manifest } = fixture(t); const path = '_includes/how-things-work/c-41-scene.html';
    put(root, path, content); manifest.files[path] = sha(content); put(root, manifestPath, JSON.stringify(manifest));
    fail(validateHowThingsWork({ root }), /raw|document|scene|svg/i);
  }
});
test('console does not carry a second scene and static JS/CSS have no front matter', (t) => {
  for (const [path, content] of [['_includes/how-things-work/c-41-console.html', '{% raw %}<svg></svg>{% endraw %}'], ['assets/how-things-work/c-41/c41.js', '---\ntitle: wrong\n---\n']]) {
    const { root, manifest } = fixture(t); put(root, path, content); manifest.files[path] = sha(content); put(root, manifestPath, JSON.stringify(manifest));
    fail(validateHowThingsWork({ root }), /console|scene|svg|front matter/i);
  }
});
test('build must contain both routes and exactly one machine/bootstrap', (t) => {
  const a = fixture(t); rmSync(join(a.site, 'how-things-work/index.html'));
  fail(validateHowThingsWork({ root: a.root, site: a.site }), /route|missing|ENOENT/i);
  const b = fixture(t); put(b.site, 'how-things-work/c-41/index.html', readFileSync(b.articleFile, 'utf8').replace('</body>', '<svg class="fp-svg op-svg"></svg></body>'));
  fail(validateHowThingsWork({ root: b.root, site: b.site }), /one|single|machine|scene/i);
  const c = fixture(t); put(c.site, 'how-things-work/c-41/index.html', readFileSync(c.articleFile, 'utf8').replace('</body>', '<script src="/assets/how-things-work/c-41/c41.js"></script></body>'));
  fail(validateHowThingsWork({ root: c.root, site: c.site }), /bootstrap|script|once|one/i);
});
test('missing mount slots and duplicate roots or consoles fail even when assets are valid', (t) => {
  for (const attribute of ['data-htw-scene', 'data-htw-reader-slot', 'data-htw-explore-slot', 'data-htw-explore-controls', 'data-htw-story']) {
    const { root, site, articleFile } = fixture(t);
    writeFileSync(articleFile, readFileSync(articleFile, 'utf8').replace(attribute, 'data-removed'));
    fail(validateHowThingsWork({ root, site }), /slot|scene|story|mount|controls/i);
  }
  for (const extra of ['<section data-htw-figure="c-41"></section>', '<section id="operation"></section>']) {
    const { root, site, articleFile } = fixture(t);
    writeFileSync(articleFile, readFileSync(articleFile, 'utf8').replace('</body>', `${extra}</body>`));
    fail(validateHowThingsWork({ root, site }), /root|console|operation|one|exactly/i);
  }
});
test('whitespace-control Liquid endraw cannot close a raw include early', (t) => {
  const { root, manifest } = fixture(t);
  const path = '_includes/how-things-work/c-41-scene.html';
  const content = payloads[path].replace('{% endraw %}', '{%- endraw -%}<p>outside raw</p>{% endraw %}');
  put(root, path, content); manifest.files[path] = sha(content); put(root, manifestPath, JSON.stringify(manifest));
  fail(validateHowThingsWork({ root }), /raw|Liquid/i);
});
test('subpath output cannot reference root-only model assets', (t) => {
  const { root, site, articleFile } = fixture(t, '/preview');
  writeFileSync(articleFile, readFileSync(articleFile, 'utf8').replaceAll('/preview/assets/', '/assets/'));
  fail(validateHowThingsWork({ root, site, baseurl: '/preview' }), /baseurl|asset|prefix/i);
});
test('hub must remain light and all built model assets match source', (t) => {
  const a = fixture(t); const path = 'how-things-work/index.html';
  put(a.site, path, readFileSync(join(a.site, path), 'utf8') + '<script src="/assets/how-things-work/c-41/c41.js"></script>');
  fail(validateHowThingsWork({ root: a.root, site: a.site }), /hub|library|bundle/i);
  const b = fixture(t); put(b.site, 'assets/how-things-work/c-41/c41.js', 'changed during build');
  fail(validateHowThingsWork({ root: b.root, site: b.site }), /hash|digest|copy/i);
});
test('broken navigation, raw Liquid and publicly copied checker are rejected', (t) => {
  const a = fixture(t); put(a.site, 'index.html', '<html><a href="/wrong/">wrong</a></html>');
  fail(validateHowThingsWork({ root: a.root, site: a.site }), /home|profile|navigation|link/i);
  const b = fixture(t); writeFileSync(b.articleFile, readFileSync(b.articleFile, 'utf8') + '{% raw %}');
  fail(validateHowThingsWork({ root: b.root, site: b.site }), /Liquid|raw/i);
  const c = fixture(t); put(c.site, 'scripts/check-how-things-work.mjs', 'should not be served');
  fail(validateHowThingsWork({ root: c.root, site: c.site }), /checker|script|public|excluded/i);
});
test('CLI returns zero for valid output and nonzero for invalid/unknown arguments', (t) => {
  const { root, site } = fixture(t);
  const script = fileURLToPath(new URL('./check-how-things-work.mjs', import.meta.url));
  assert.equal(spawnSync(process.execPath, [script, '--site', site], { cwd: root }).status, 0);
  assert.equal(spawnSync(process.execPath, [script, '--unknown'], { cwd: root }).status, 2);
  assert.equal(spawnSync(process.execPath, [script, '--site'], { cwd: root }).status, 2);
});
