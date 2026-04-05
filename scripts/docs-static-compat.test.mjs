import { describe, expect, it } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function listMdxFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listMdxFiles(entryPath)));
      continue;
    }

    if (entry.name.endsWith('.mdx')) {
      files.push(entryPath);
    }
  }

  return files;
}

describe('docs static export compatibility', () => {
  it('avoids Mintlify Frame embeds that break on GitHub Pages refresh', async () => {
    const files = await listMdxFiles(join(process.cwd(), 'docs'));
    const offenders = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');

      if (content.includes('<Frame')) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('avoids root-relative /docs links inside MDX content', async () => {
    const files = await listMdxFiles(join(process.cwd(), 'docs'));
    const offenders = [];
    const rootRelativeDocsPattern = /(\]\(\/docs\/|href="\/docs\/|src="\/docs\/)/;

    for (const file of files) {
      const content = await readFile(file, 'utf8');

      if (rootRelativeDocsPattern.test(content)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
