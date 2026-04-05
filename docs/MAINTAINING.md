# Docs Maintenance

This docs site is authored in MDX, exported through Mintlify, and published on GitHub Pages.

## GitHub Pages Compatibility Rules

- Use relative links for internal docs and asset references inside `docs/**/*.mdx`.
- Do not use root-relative internal paths such as `/docs/...` in MDX content.
- Avoid Mintlify `Frame` wrappers for diagrams and screenshots on Pages-exported docs.
- Prefer plain relative links to large diagrams and screenshots when in doubt.
- If you need to add a new interactive or custom MDX component, verify the exported site with a real browser reload before merging.

## Required Checks

Run these checks after editing docs content or the export pipeline:

```bash
bun test scripts/docs-static-compat.test.mjs scripts/export-docs-site.test.mjs
```

## Why These Rules Exist

GitHub Pages serves a static export. Root-relative internal links and some Mintlify component patterns can survive the initial render but fail after hydration or refresh, which can surface as Mintlify's `Error loading page` 500 screen.
