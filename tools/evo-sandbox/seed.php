<?php
declare(strict_types=1);

/**
 * Seed an Evolution CMS instance with the draft parish site.
 *
 * This performs, over PDO, what IMPORT.md steps 3-6 ask a volunteer to do by
 * hand: create one template, create every chunk in dist/chunks/, create one
 * resource per source page, and repoint the internal links.
 *
 * It runs inside the container, after cli-install.php, for both 1.4.18 and
 * 3.5.7. The two versions store chunks, templates and resources in the same
 * tables with compatible columns; the only structural difference is that 3.x
 * maintains a site_content_closure hierarchy table, handled at the end.
 *
 * It is idempotent. Records are matched by name and updated in place, so
 * `npm run evo:seed` re-pushes after `npm run chunks` without a rebuild.
 *
 * Inputs, all read-only mounts:
 *   /opt/ntgoc/chunks   dist/chunks/          what gets imported
 *   /opt/ntgoc/site     the repository root   where page->chunk order is read from
 */

const CHUNKS_DIR = '/opt/ntgoc/chunks';
const SITE_DIR   = '/opt/ntgoc/site';
const WEBROOT    = '/var/www/html';
const ASSET_DIR  = WEBROOT . '/assets/templates/ntgoc';

/**
 * These four live in the template, not in any page's resource body — they are
 * on all 16 pages, and duplicating them per resource is exactly the drift
 * CLAUDE.md warns about with `npm run shell`.
 */
const SHELL_CHUNKS = ['ntgocDraftBanner', 'ntgocTopBar', 'ntgocSiteHeader', 'ntgocSiteFooter'];

const TEMPLATE_NAME = 'NTGOC Draft';

// Kept to PHP 7.4 syntax throughout: this same file runs in the 1.4.18
// container (PHP 7.4) and the 3.5.7 one (PHP 8.3). No `never`, no
// str_starts_with, no 0o octal literals.
function say(string $m): void { fwrite(STDERR, "[ntgoc-seed] $m\n"); }
function fail(string $m): void { fwrite(STDERR, "[ntgoc-seed] FATAL: $m\n"); exit(1); }

function env_or(string $key, string $default = ''): string {
    $v = getenv($key);
    return ($v === false || $v === '') ? $default : $v;
}

// ---------------------------------------------------------------- connect

$major  = (int) env_or('EVO_MAJOR', '1');
$prefix = env_or('DB_PREFIX', 'evo_');

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', env_or('DB_HOST', 'db'), env_or('DB_NAME')),
        env_or('DB_USER'),
        env_or('DB_PASS'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (Throwable $e) {
    fail('cannot connect to the database: ' . $e->getMessage());
}

$T = fn(string $table): string => "`{$prefix}{$table}`";

// ---------------------------------------------------------------- read chunks

if (!is_dir(CHUNKS_DIR)) {
    fail(CHUNKS_DIR . ' is not mounted. Has `npm run chunks` ever been run?');
}

$chunks = [];
foreach (glob(CHUNKS_DIR . '/*.html') ?: [] as $file) {
    $name = basename($file, '.html');

    // _index.md, _link-map.md and _components.evo.css are volunteer aids and
    // the stylesheet, not chunks.
    if (strpos($name, '_') === 0) {
        continue;
    }

    $raw  = (string) file_get_contents($file);
    $body = $raw;
    $desc = 'NTGOC draft chunk';

    // Strip the generated header comment. IMPORT.md step 4 tells the volunteer
    // to skip it too — it is instructions, not markup.
    if (preg_match('/^\s*<!--(.*?)-->\s*/s', $raw, $m) === 1) {
        $body = substr($raw, strlen($m[0]));
        if (preg_match('/Source:\s*(\S+)/', $m[1], $src) === 1) {
            $desc = "NTGOC draft — extracted from {$src[1]}";
        }
    }

    $chunks[$name] = ['description' => $desc, 'body' => rtrim($body) . "\n"];
}

if ($chunks === []) {
    fail('no chunks found in ' . CHUNKS_DIR);
}
say(sprintf('read %d chunks', count($chunks)));

// ---------------------------------------------------------------- read pages
//
// Page -> chunk order comes from the <!-- CHUNK:name --> markers in the source
// pages rather than from IMPORT.md's table. The markers are the import
// mechanism and are lint-enforced; a table in prose is not.

$pages = [];
foreach (glob(SITE_DIR . '/*.html') ?: [] as $file) {
    $alias = basename($file, '.html');
    $raw   = (string) file_get_contents($file);

    $title = $alias;
    if (preg_match('/<title>(.*?)<\/title>/s', $raw, $m) === 1) {
        $title = trim(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        // Titles read "About the Parish — Nativity of the Theotokos"; the
        // template appends the parish name itself, so keep only the leading part.
        $title = trim(preg_split('/\s+[—–|]\s+/u', $title)[0]);
    }

    preg_match_all('/<!--\s*CHUNK:(ntgoc[A-Za-z0-9]+)\s*-->/', $raw, $found);

    $order = [];
    foreach ($found[1] as $chunkName) {
        if (in_array($chunkName, SHELL_CHUNKS, true) || in_array($chunkName, $order, true)) {
            continue;
        }
        if (!isset($chunks[$chunkName])) {
            fail("page {$alias}.html references chunk {$chunkName}, which is not in dist/chunks — run `npm run chunks`");
        }
        $order[] = $chunkName;
    }

    $pages[$alias] = ['title' => $title, 'chunks' => $order];
}

if ($pages === []) {
    fail('no source pages found in ' . SITE_DIR);
}
ksort($pages);
say(sprintf('read %d source pages', count($pages)));

// ---------------------------------------------------------------- template

$templateFile = '/opt/ntgoc/template/ntgoc.tpl';
if (!is_file($templateFile)) {
    fail("template not found at {$templateFile}");
}
$templateBody = (string) file_get_contents($templateFile);

$row = $pdo->prepare('SELECT id FROM ' . $T('site_templates') . ' WHERE templatename = ? LIMIT 1');
$row->execute([TEMPLATE_NAME]);
$templateId = (int) ($row->fetchColumn() ?: 0);

if ($templateId > 0) {
    $pdo->prepare('UPDATE ' . $T('site_templates') . ' SET description = ?, content = ? WHERE id = ?')
        ->execute(['The draft parish site — sandbox only', $templateBody, $templateId]);
} else {
    $pdo->prepare('INSERT INTO ' . $T('site_templates') . ' (templatename, description, content) VALUES (?, ?, ?)')
        ->execute([TEMPLATE_NAME, 'The draft parish site — sandbox only', $templateBody]);
    $templateId = (int) $pdo->lastInsertId();
}
say("template {$templateId} (" . TEMPLATE_NAME . ')');

// ---------------------------------------------------------------- resources
//
// Resources first, chunks second: the chunks' [~id~] links need these ids.

$now       = time();
$menuOrder = array_values(array_unique(array_merge(['index'], array_keys($pages))));
$ids       = [];

$findDoc = $pdo->prepare('SELECT id FROM ' . $T('site_content') . ' WHERE alias = ? LIMIT 1');

foreach ($pages as $alias => $page) {
    $content = '';
    foreach ($page['chunks'] as $chunkName) {
        $content .= '{{' . $chunkName . '}}' . "\n";
    }

    $menuindex = array_search($alias, $menuOrder, true);

    $findDoc->execute([$alias]);
    $docId = (int) ($findDoc->fetchColumn() ?: 0);

    if ($docId > 0) {
        $pdo->prepare(
            'UPDATE ' . $T('site_content') . '
                SET pagetitle = ?, longtitle = ?, content = ?, template = ?,
                    published = 1, richtext = 0, searchable = 1, cacheable = 1,
                    menuindex = ?, editedon = ?
              WHERE id = ?'
        )->execute([$page['title'], $page['title'], $content, $templateId, $menuindex, $now, $docId]);
    } else {
        $pdo->prepare(
            'INSERT INTO ' . $T('site_content') . '
                (type, contentType, pagetitle, longtitle, description, alias, published,
                 parent, isfolder, content, richtext, template, menuindex, searchable,
                 cacheable, createdon, editedon, publishedon, hidemenu)
             VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, ?, 0, ?, ?, 1, 1, ?, ?, ?, 0)'
        )->execute([
            'document', 'text/html', $page['title'], $page['title'],
            'Draft page, sandbox only', $alias, $content, $templateId, $menuindex,
            $now, $now, $now,
        ]);
        $docId = (int) $pdo->lastInsertId();
    }

    $ids[$alias] = $docId;
}
say(sprintf('seeded %d resources', count($ids)));

// richtext = 0 above is not cosmetic. IMPORT.md section 3 is about TinyMCE
// silently rewriting complex HTML; a resource created with richtext on would
// mangle its own body the first time someone opened and saved it in the manager.

// ---------------------------------------------------------------- chunks
//
// The 60 internal links ship as <a href="#" data-ntgoc-link="about">
// placeholders, and dist/chunks/_link-map.md is a worksheet for filling them in
// by hand. Here they are resolved against the ids just assigned. The
// data-ntgoc-link attribute is kept so the substitution stays auditable.

$findChunk = $pdo->prepare('SELECT id FROM ' . $T('site_htmlsnippets') . ' WHERE name = ? LIMIT 1');
$resolved  = 0;

foreach ($chunks as $name => $chunk) {
    $body = preg_replace_callback(
        '/href="#"(\s+data-ntgoc-link="([A-Za-z0-9_-]+)")/',
        function (array $m) use ($ids, $name, &$resolved): string {
            $target = $m[2];
            if (!isset($ids[$target])) {
                fail("chunk {$name} links to \"{$target}\", which is not one of the seeded pages");
            }
            $resolved++;
            return 'href="[~' . $ids[$target] . '~]"' . $m[1];
        },
        $chunk['body']
    );

    if ($body === null) {
        fail("link rewriting failed for chunk {$name}");
    }

    $findChunk->execute([$name]);
    $chunkId = (int) ($findChunk->fetchColumn() ?: 0);

    if ($chunkId > 0) {
        $pdo->prepare('UPDATE ' . $T('site_htmlsnippets') . ' SET description = ?, snippet = ? WHERE id = ?')
            ->execute([$chunk['description'], $body, $chunkId]);
    } else {
        $pdo->prepare('INSERT INTO ' . $T('site_htmlsnippets') . ' (name, description, snippet) VALUES (?, ?, ?)')
            ->execute([$name, $chunk['description'], $body]);
    }
}
say(sprintf('seeded %d chunks, resolved %d internal links', count($chunks), $resolved));

// ---------------------------------------------------------------- 3.x closure
//
// 3.5.7 keeps the resource tree in site_content_closure. Without rows here the
// pages render but the manager's tree comes up empty. Rather than guess the
// convention, mirror whatever shape the installer's own default document has.

if ($major >= 3) {
    $closure = $prefix . 'site_content_closure';
    $exists  = $pdo->query("SHOW TABLES LIKE " . $pdo->quote($closure))->fetchColumn();

    if ($exists === false) {
        say('no closure table found; skipping (unexpected on 3.x)');
    } else {
        $usesRootRows = (int) $pdo->query(
            'SELECT COUNT(*) FROM `' . $closure . '` WHERE ancestor = 0'
        )->fetchColumn() > 0;

        $ins = $pdo->prepare(
            'INSERT IGNORE INTO `' . $closure . '` (ancestor, descendant, depth) VALUES (?, ?, ?)'
        );

        foreach ($ids as $docId) {
            $ins->execute([$docId, $docId, 0]);
            if ($usesRootRows) {
                $ins->execute([0, $docId, 1]);
            }
        }
        say(sprintf('wrote closure rows for %d resources%s', count($ids), $usesRootRows ? ' (with root rows)' : ''));
    }
}

// ---------------------------------------------------------------- settings

$homeId = $ids['index'] ?? null;
if ($homeId !== null) {
    $pdo->prepare('UPDATE ' . $T('system_settings') . ' SET setting_value = ? WHERE setting_name = ?')
        ->execute([(string) $homeId, 'site_start']);
    say("site_start -> {$homeId}");
}

// ---------------------------------------------------------------- static files
//
// components.css and the progressive-enhancement script are files, not chunks.
// IMPORT.md step 3 uploads them through the File Manager; here they are copied
// to the same path the chunks' asset rewriting expects.

if (!is_dir(ASSET_DIR) && !mkdir(ASSET_DIR, 0775, true) && !is_dir(ASSET_DIR)) {
    fail('could not create ' . ASSET_DIR);
}

$staticFiles = [
    CHUNKS_DIR . '/_components.evo.css'    => ASSET_DIR . '/components.css',
    SITE_DIR . '/assets/js/ntgoc-enhance.js' => ASSET_DIR . '/ntgoc-enhance.js',
];

foreach ($staticFiles as $from => $to) {
    if (!is_file($from)) {
        fail("expected {$from} to exist");
    }
    if (!copy($from, $to)) {
        fail("could not copy {$from} to {$to}");
    }
}
say('copied components.css and ntgoc-enhance.js into ' . ASSET_DIR);

// ---------------------------------------------------------------- manifest
//
// verify.mjs runs on the host and has no way to know which resource id each
// page got — the ids differ between the two installations. It reads this over
// HTTP. It doubles as the filled-in version of dist/chunks/_link-map.md, which
// ships as a blank worksheet.

$manifest = [
    'evoMajor'      => $major,
    'seededAt'      => $now,
    'templateId'    => $templateId,
    'shellChunks'   => SHELL_CHUNKS,
    'chunkCount'    => count($chunks),
    'linksResolved' => $resolved,
    'pages'         => [],
];

foreach ($pages as $alias => $page) {
    $manifest['pages'][] = [
        'alias'  => $alias,
        'id'     => $ids[$alias],
        'title'  => $page['title'],
        'chunks' => $page['chunks'],
    ];
}

if (file_put_contents(
    ASSET_DIR . '/seed-manifest.json',
    json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n"
) === false) {
    fail('could not write seed-manifest.json');
}
say('wrote seed-manifest.json');

// ---------------------------------------------------------------- cache
//
// Writing to the tables behind the CMS's back leaves stale cached pages. Only
// page caches and the cache index are removed: assets/cache/siteManager.php
// holds MGR_DIR and deleting it breaks the manager.

// The two versions keep it in different places, and the 3.x location is not
// the obvious one: core/storage/bootstrap/, not core/storage/cache/. Clearing
// the wrong directory leaves siteCache.idx.php holding an alias listing from
// before the seed, so every new page 404s while the CMS quietly serves the
// default document. Nothing else reports that; it just looks like the seed
// failed.
//
// siteCache.idx.php is the alias and settings listing; sitePublishing.idx.php
// is the pub/unpub schedule. assets/cache/siteManager.php holds MGR_DIR and
// deleting it breaks the manager, so it is not matched here.
$cleared = 0;
$targets = array_merge(
    glob(WEBROOT . '/assets/cache/*.pageCache.php') ?: [],
    glob(WEBROOT . '/assets/cache/siteCache.idx.php') ?: [],
    glob(WEBROOT . '/core/storage/bootstrap/*.pageCache.php') ?: [],
    glob(WEBROOT . '/core/storage/bootstrap/siteCache.idx.php') ?: [],
    glob(WEBROOT . '/core/storage/bootstrap/sitePublishing.idx.php') ?: [],
    glob(WEBROOT . '/core/storage/cache/*.pageCache.php') ?: [],
);
foreach ($targets as $file) {
    if (@unlink($file)) {
        $cleared++;
    }
}
say("cleared {$cleared} cache files");

say('done');
