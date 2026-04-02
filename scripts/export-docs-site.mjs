import { cp, mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const mobileZoomLockScript = `<script id="disable-mobile-zoom">(function(){const LOCKED_VIEWPORT='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';const IN_APP_TOKENS=['MicroMessenger','QQ/','Weibo','AlipayClient','AliApp','DingTalk','Lark','Feishu','NewsArticle','Toutiao','BytedanceWebview','aweme','Douyin','Kwai','XiaoHongShu'];function getParams(){try{return new URLSearchParams(window.location.search);}catch{return new URLSearchParams();}}function hasTruthyParam(name){const value=getParams().get(name);return value==='1'||value==='true'||value==='yes';}const debugEnabled=hasTruthyParam('zoomDebug');const debugState={override:false,reasons:[],lockRequested:false,lockApplied:false,viewportBefore:'',viewportAfter:'',ua:navigator.userAgent||'',events:{gesturestart:0,gesturechange:0,gestureend:0,touchstartMulti:0,touchmoveScaled:0,touchendDouble:0}};function renderDebug(){if(!debugEnabled){return;}const scale=window.visualViewport&&typeof window.visualViewport.scale==='number'?window.visualViewport.scale:'n/a';const lines=['zoomLockDebug=on','lockRequested='+String(debugState.lockRequested),'lockApplied='+String(debugState.lockApplied),'reasons='+(debugState.reasons.length?debugState.reasons.join(', '):'none'),'viewportBefore='+(debugState.viewportBefore||'missing'),'viewportAfter='+(debugState.viewportAfter||'missing'),'visualViewport.scale='+String(scale),'events='+JSON.stringify(debugState.events),'ua='+debugState.ua];let panel=document.getElementById('zoom-lock-debug-panel');if(!panel){panel=document.createElement('pre');panel.id='zoom-lock-debug-panel';panel.setAttribute('style','position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;margin:0;padding:10px;max-height:45vh;overflow:auto;white-space:pre-wrap;word-break:break-word;background:rgba(0,0,0,.82);color:#7CFFB2;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;border-radius:10px;pointer-events:none;');document.addEventListener('DOMContentLoaded',function appendPanel(){if(!document.body){return;}document.body.appendChild(panel);renderDebug();},{once:true});if(document.body){document.body.appendChild(panel);}}panel.textContent=lines.join('\\n');}function hasLockOverride(){debugState.override=hasTruthyParam('lockZoom');return debugState.override;}function getDetectionReasons(){const reasons=[];const ua=debugState.ua;const token=IN_APP_TOKENS.find(item=>ua.indexOf(item)!==-1);if(token){reasons.push('token:'+token);}const isAppleMobile=/iPhone|iPad|iPod/i.test(ua);const isEmbeddedIOSWebView=isAppleMobile&&/AppleWebKit/i.test(ua)&&!/Safari/i.test(ua);if(isEmbeddedIOSWebView){reasons.push('ios-webview-no-safari');}const isAndroidWebView=/\\bwv\\b/i.test(ua);if(isAndroidWebView){reasons.push('android-webview');}return reasons;}function isLikelyInAppBrowser(){debugState.reasons=getDetectionReasons();return debugState.reasons.length>0;}function lockViewport(){const head=document.head||document.getElementsByTagName('head')[0];if(!head){return false;}let viewport=document.querySelector('meta[name="viewport"]');debugState.viewportBefore=viewport?viewport.getAttribute('content')||'':'';if(!viewport){viewport=document.createElement('meta');viewport.setAttribute('name','viewport');head.prepend(viewport);}viewport.setAttribute('content',LOCKED_VIEWPORT);debugState.viewportAfter=viewport.getAttribute('content')||'';return true;}function installGestureGuards(){let lastTouchEnd=0;const cancel=event=>event.preventDefault();document.addEventListener('gesturestart',event=>{debugState.events.gesturestart+=1;cancel(event);renderDebug();},{passive:false});document.addEventListener('gesturechange',event=>{debugState.events.gesturechange+=1;cancel(event);renderDebug();},{passive:false});document.addEventListener('gestureend',event=>{debugState.events.gestureend+=1;cancel(event);renderDebug();},{passive:false});document.addEventListener('touchstart',event=>{if(event.touches.length>1){debugState.events.touchstartMulti+=1;cancel(event);renderDebug();}}, {passive:false});document.addEventListener('touchmove',event=>{if(event.touches.length>1||typeof event.scale==='number'&&event.scale!==1){debugState.events.touchmoveScaled+=1;cancel(event);renderDebug();}}, {passive:false});document.addEventListener('touchend',event=>{const now=Date.now();if(now-lastTouchEnd<=300){debugState.events.touchendDouble+=1;cancel(event);renderDebug();}lastTouchEnd=now;},{passive:false});}const override=hasLockOverride();const detectedInApp=isLikelyInAppBrowser();debugState.lockRequested=override||detectedInApp;debugState.lockApplied=debugState.lockRequested&&lockViewport();renderDebug();if(!debugState.lockRequested){return;}installGestureGuards();renderDebug();})();</script>`;

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
