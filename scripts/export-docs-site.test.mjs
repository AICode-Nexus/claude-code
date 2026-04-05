import { describe, expect, it } from 'bun:test';
import {
  buildMintlifyExportEnv,
  buildMintlifyExportPatch,
  rewriteTextAsset,
} from './export-docs-site.mjs';

const sampleMintlifyExportSource = [
  "const CONCURRENCY = 10;",
  'async function generatePages(baseUrl, routes, outputDir) {',
  '  async function worker() {',
  '    const res = await fetch(`${baseUrl}${route}`);',
  '    return res;',
  '  }',
  '}',
].join('\n');

describe('buildMintlifyExportPatch', () => {
  it('injects timeout and retry guards into Mintlify export fetches', () => {
    const patched = buildMintlifyExportPatch(sampleMintlifyExportSource);

    expect(patched).toContain("cc-export-fetch-patch-v1");
    expect(patched).toContain(
      "const CONCURRENCY = Number(process.env.MINTLIFY_EXPORT_CONCURRENCY ?? '4');"
    );
    expect(patched).toContain(
      "const EXPORT_FETCH_TIMEOUT_MS = Number(process.env.MINTLIFY_EXPORT_FETCH_TIMEOUT_MS ?? '45000');"
    );
    expect(patched).toContain('async function fetchExportRoute(url) {');
    expect(patched).toContain('AbortSignal.timeout(EXPORT_FETCH_TIMEOUT_MS)');
    expect(patched).toContain(
      'const res = await fetchExportRoute(`${baseUrl}${route}`);'
    );
  });

  it('is idempotent once the patch marker is present', () => {
    const firstPass = buildMintlifyExportPatch(sampleMintlifyExportSource);
    const secondPass = buildMintlifyExportPatch(firstPass);

    expect(secondPass).toBe(firstPass);
  });

  it('fails loudly when Mintlify changes the expected source layout', () => {
    expect(() => buildMintlifyExportPatch('const CONCURRENCY = 5;')).toThrow(
      'Unable to patch Mintlify export implementation: unexpected source layout'
    );
  });
});

describe('buildMintlifyExportEnv', () => {
  it('forces Pages-safe runtime env overrides', () => {
    const env = buildMintlifyExportEnv({ EXISTING: '1' }, '/claude-code');

    expect(env).toEqual(
      expect.objectContaining({
        EXISTING: '1',
        BASE_PATH: '/claude-code',
        NEXT_PUBLIC_BASE_PATH: '/claude-code',
        NEXT_PUBLIC_ENV: 'production',
        NEXT_PUBLIC_AUTH_ENABLED: 'false',
        NEXT_PUBLIC_IS_LOCAL_CLIENT: 'false',
      })
    );
  });
});

describe('rewriteTextAsset', () => {
  it('rewrites CLI runtime literals out of exported text assets', () => {
    const original = [
      'const env={NEXT_PUBLIC_ENV:"cli",NEXT_PUBLIC_IS_LOCAL_CLIENT:"true"};',
      'const asset="/_next/static/chunk.js";',
    ].join('\n');

    const rewritten = rewriteTextAsset(original, '/claude-code');

    expect(rewritten).toContain('NEXT_PUBLIC_ENV:"production"');
    expect(rewritten).toContain('NEXT_PUBLIC_IS_LOCAL_CLIENT:"false"');
    expect(rewritten).toContain('"/claude-code/_next/static/chunk.js"');
  });
});
