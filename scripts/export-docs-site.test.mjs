import { describe, expect, it } from 'bun:test';
import { buildMintlifyExportPatch } from './export-docs-site.mjs';

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
