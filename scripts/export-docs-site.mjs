import { cp, mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const mobileZoomLockScript = `<script id="disable-mobile-zoom">(function(){const LOCKED_VIEWPORT='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';const IN_APP_UA_PATTERN=/(MicroMessenger|QQ\\/|Weibo|AlipayClient|AliApp|DingTalk|Lark|Feishu|NewsArticle|Toutiao|BytedanceWebview|aweme|Douyin|Kwai|XiaoHongShu)/i;function hasLockOverride(){try{const params=new URLSearchParams(window.location.search);const override=params.get('lockZoom');return override==='1'||override==='true'||override==='yes';}catch{return false;}}function isLikelyInAppBrowser(){const ua=navigator.userAgent||'';const isAppleMobile=/iPhone|iPad|iPod/i.test(ua);const isEmbeddedIOSWebView=isAppleMobile&&/AppleWebKit/i.test(ua)&&!/Safari/i.test(ua);const isAndroidWebView=/\\bwv\\b/i.test(ua);return IN_APP_UA_PATTERN.test(ua)||isEmbeddedIOSWebView||isAndroidWebView;}function lockViewport(){const head=document.head||document.getElementsByTagName('head')[0];if(!head){return;}let viewport=document.querySelector('meta[name="viewport"]');if(!viewport){viewport=document.createElement('meta');viewport.setAttribute('name','viewport');head.prepend(viewport);}viewport.setAttribute('content',LOCKED_VIEWPORT);}function installGestureGuards(){let lastTouchEnd=0;const cancel=event=>event.preventDefault();document.addEventListener('gesturestart',cancel,{passive:false});document.addEventListener('gesturechange',cancel,{passive:false});document.addEventListener('gestureend',cancel,{passive:false});document.addEventListener('touchstart',event=>{if(event.touches.length>1){cancel(event);}}, {passive:false});document.addEventListener('touchmove',event=>{if(event.touches.length>1||typeof event.scale==='number'&&event.scale!==1){cancel(event);}}, {passive:false});document.addEventListener('touchend',event=>{const now=Date.now();if(now-lastTouchEnd<=300){cancel(event);}lastTouchEnd=now;},{passive:false});}if(!hasLockOverride()&&!isLikelyInAppBrowser()){return;}lockViewport();installGestureGuards();})();</script>`;

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

  if (rewritten.includes('</head>')) {
    if (!rewritten.includes('id="disable-mobile-zoom"')) {
      rewritten = rewritten.replace('</head>', `${mobileZoomLockScript}</head>`);
    }
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
