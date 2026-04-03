import { cp, mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);

const LOCKED_VIEWPORT =
  'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, viewport-fit=cover';

// Inline script — placed at the very top of <head> to run before any framework JS.
//
// Strategy: Next.js hydration doesn't just *modify* the viewport meta — it *removes*
// the old one and *creates* a new one, so a MutationObserver on the original element
// goes dead. Instead we observe the entire <head> for childList + subtree + attributes
// changes, and re-lock every viewport meta we find. This covers:
//   - attribute changes on existing meta
//   - old meta removed + new meta inserted (Next.js hydration)
//   - any script that modifies viewport at any point
const noZoomGestureScript =
  '<script id="disable-mobile-zoom">' +
  '(function(){' +
  "var V='width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, viewport-fit=cover';" +
  // Lock all viewport metas in the document right now
  'function lockAll(){' +
  "var ms=document.querySelectorAll('meta[name=viewport]');" +
  "for(var i=0;i<ms.length;i++){if(ms[i].getAttribute('content')!==V){ms[i].setAttribute('content',V);}}" +
  '}' +
  'lockAll();' +
  // Observe <head> for any DOM changes and re-lock
  "var h=document.head||document.getElementsByTagName('head')[0];" +
  'if(h){new MutationObserver(function(){lockAll();}).observe(h,{childList:true,subtree:true,attributes:true,attributeFilter:[\"content\"]});}' +
  // Gesture guards
  'var n=function(e){e.preventDefault();};' +
  "document.addEventListener('gesturestart',n,{passive:false});" +
  "document.addEventListener('gesturechange',n,{passive:false});" +
  "document.addEventListener('gestureend',n,{passive:false});" +
  "document.addEventListener('touchmove',function(e){if(e.touches.length>1){e.preventDefault();}},{passive:false});" +
  "var t=0;document.addEventListener('touchend',function(e){var now=Date.now();if(now-t<300){e.preventDefault();}t=now;},{passive:false});" +
  '})();' +
  '</script>';

// CSS to disable touch-based zoom gestures at the browser engine level.
// Use !important and wildcard selector to override all framework styles.
const noZoomStyle =
  '<style id="disable-mobile-zoom-css">' +
  'html,body,html *{touch-action:pan-x pan-y!important;-ms-touch-action:pan-x pan-y!important;-webkit-touch-callout:none!important;}' +
  '</style>';

function getArgValue(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return defaultValue;
  }

  return args[index + 1];
}

function getRepoBasePath() {
  const override = process.env.DOCS_BASE_PATH?.trim();
  if (override) {
    return override === '/' ? '' : override.replace(/\/$/, '');
  }

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return '';
  }

  const [, repo] = repository.split('/');
  if (!repo || repo.toLowerCase().endsWith('.github.io')) {
    return '';
  }

  return `/${repo}`;
}

function runCommand(command, commandArgs, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      ...options,
    });

    child.on('error', rejectPromise);
    child.on('exit', code => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`${command} exited with code ${code ?? 1}`));
    });
  });
}

/**
 * Rewrite a text asset:
 *   1. Adjust paths for the GitHub Pages base path (if any).
 *   2. For HTML files: force viewport to disable zoom, inject CSS + JS guards.
 */
function rewriteTextAsset(content, basePath) {
  const pathPrefixPattern =
    /(["'`])\/(?=(_next\/|docs\/|favicons\/|sitemap\.xml|robots\.txt))/g;
  const rootHrefPattern = /(href\s*[=:]\s*["'])\/(?=["'])/g;
  const cssUrlPattern =
    /url\(\s*\/(?=(_next\/|docs\/|favicons\/|sitemap\.xml|robots\.txt))/g;
  let rewritten = content;

  if (basePath) {
    rewritten = rewritten.replace(pathPrefixPattern, `$1${basePath}/`);
    rewritten = rewritten.replace(rootHrefPattern, `$1${basePath}/`);
    rewritten = rewritten.replace(cssUrlPattern, `url(${basePath}/`);
  }

  // Only inject zoom-lock into HTML files (those with </head>).
  if (rewritten.includes('</head>')) {
    // 1. Inject the zoom-lock script at the very top of <head>, right after <meta charset>
    //    so it runs before any framework JS (Next.js hydration, etc.)
    if (!rewritten.includes('id="disable-mobile-zoom"')) {
      // Find <meta charset> and inject right after it, or fallback to after <head>
      const charsetMatch = rewritten.match(/<meta\s+charset=[^>]*>/i);
      if (charsetMatch) {
        rewritten = rewritten.replace(
          charsetMatch[0],
          `${charsetMatch[0]}${noZoomGestureScript}${noZoomStyle}`
        );
      } else {
        rewritten = rewritten.replace(
          /<head[^>]*>/i,
          `$&${noZoomGestureScript}${noZoomStyle}`
        );
      }
    }

    // 2. Force the viewport meta tag to disable zoom (static, works everywhere).
    //    This sets the initial state; the script above guards it at runtime.
    rewritten = rewritten.replace(
      /<meta\s+name=["']viewport["'][^>]*>/i,
      `<meta name="viewport" content="${LOCKED_VIEWPORT}">`
    );
  }

  return rewritten;
}

async function rewriteSitePaths(rootDir, basePath) {
  const textExtensions = new Set([
    '.css',
    '.html',
    '.js',
    '.json',
    '.txt',
    '.webmanifest',
    '.xml',
  ]);

  async function visit(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await visit(entryPath);
        continue;
      }

      const extension = entry.name.includes('.')
        ? `.${entry.name.split('.').pop()}`
        : '';

      if (!textExtensions.has(extension)) {
        continue;
      }

      const original = await readFile(entryPath, 'utf8');
      const rewritten = rewriteTextAsset(original, basePath);

      if (rewritten !== original) {
        await writeFile(entryPath, rewritten, 'utf8');
      }
    }
  }

  await visit(rootDir);
}

async function main() {
  const outputDir = resolve(getArgValue('--output', './.pages-dist'));
  const basePath = getRepoBasePath();
  const workingDir = await mkdtemp(join(tmpdir(), 'claude-code-pages-'));
  const cliDir = join(workingDir, 'mintlify-cli');
  const zipPath = join(workingDir, 'site-export.zip');
  const extractedDir = join(workingDir, 'extracted');
  const allowedEntries = new Set([
    '_next',
    'docs',
    'favicons',
    'index.html',
    '404.html',
    'robots.txt',
    'sitemap.xml',
  ]);
  const installEnv = {
    ...process.env,
    PUPPETEER_SKIP_DOWNLOAD: '1',
  };

  try {
    await mkdir(cliDir, { recursive: true });
    await mkdir(extractedDir, { recursive: true });

    await runCommand('npm', ['init', '-y'], {
      cwd: cliDir,
      env: process.env,
    });

    await runCommand('npm', ['install', 'mintlify'], {
      cwd: cliDir,
      env: installEnv,
    });

    await runCommand(
      'node',
      [join(cliDir, 'node_modules', 'mintlify', 'index.js'), 'export', '--output', zipPath],
      { cwd: process.cwd(), env: process.env }
    );

    if (!existsSync(zipPath)) {
      throw new Error(`Mintlify export archive was not created at ${zipPath}`);
    }

    await runCommand('unzip', ['-q', zipPath, '-d', extractedDir], {
      cwd: process.cwd(),
      env: process.env,
    });

    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });

    const entries = await readdir(extractedDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!allowedEntries.has(entry.name)) {
        continue;
      }

      await cp(join(extractedDir, entry.name), join(outputDir, entry.name), {
        recursive: true,
        force: true,
      });
    }

    await rewriteSitePaths(outputDir, basePath);

    await writeFile(join(outputDir, '.nojekyll'), '', 'utf8');
    console.log(`Exported static docs to ${outputDir}${basePath ? ` with base path ${basePath}` : ''}`);
  } finally {
    await rm(workingDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
