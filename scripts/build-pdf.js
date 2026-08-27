'use strict';

/**
 * Markdown -> PDF build.
 *
 * Renders REPORT.md and qa-spec.md to dist/*.pdf using headless Chromium
 * driven by Playwright. Markdown is converted to HTML with `marked` and
 * wrapped in a fully self-contained HTML document (no external resources),
 * so it renders correctly offline.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const JOBS = [
  { input: path.join(ROOT, 'REPORT.md'), output: path.join(DIST, 'REPORT.pdf') },
  { input: path.join(ROOT, 'qa-spec.md'), output: path.join(DIST, 'qa-spec.pdf') },
];

const PDF_MARGIN = { top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' };

const PRINT_CSS = `
  @page { margin: 18mm; }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
  }

  body {
    font-family: Georgia, "Times New Roman", "DejaVu Serif", serif;
    font-size: 12pt;
    line-height: 1.55;
    color: #1a1a1a;
    background: #ffffff;
  }

  .page {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 8px;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "DejaVu Sans", sans-serif;
    line-height: 1.25;
    font-weight: 700;
    margin: 1.4em 0 0.6em;
    page-break-after: avoid;
    break-after: avoid;
  }

  h1 { font-size: 22pt; margin-top: 0; }
  h2 { font-size: 17pt; border-bottom: 1px solid #d0d0d0; padding-bottom: 0.2em; }
  h3 { font-size: 14pt; }
  h4 { font-size: 12.5pt; }

  p { margin: 0.6em 0; }

  a { color: #0b57d0; text-decoration: none; word-break: break-word; }

  ul, ol { margin: 0.6em 0; padding-left: 1.8em; }
  li { margin: 0.25em 0; }

  code, kbd, samp {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", "DejaVu Sans Mono", Menlo, monospace;
    font-size: 10.5pt;
  }

  :not(pre) > code {
    background: #f2f3f5;
    border: 1px solid #e2e4e8;
    border-radius: 3px;
    padding: 0.08em 0.35em;
  }

  pre {
    background: #f6f8fa;
    border: 1px solid #e2e4e8;
    border-radius: 4px;
    padding: 0.9em 1em;
    margin: 0.9em 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  pre code {
    background: none;
    border: none;
    padding: 0;
    white-space: pre-wrap;
  }

  blockquote {
    margin: 0.9em 0;
    padding: 0.2em 1em;
    color: #444;
    border-left: 3px solid #c8c8c8;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 10.5pt;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  th, td {
    border: 1px solid #b8bcc2;
    padding: 0.4em 0.6em;
    text-align: left;
    vertical-align: top;
  }

  th { background: #eef0f2; font-weight: 700; }

  tr:nth-child(even) td { background: #fafbfc; }

  img { max-width: 100%; }

  hr {
    border: none;
    border-top: 1px solid #d0d0d0;
    margin: 1.6em 0;
  }
`;

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHtml(title, markdown) {
  const body = marked.parse(markdown, { mangle: false, headerIds: true });
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<main class="page">
${body}
</main>
</body>
</html>`;
}

async function main() {
  if (!fs.existsSync(DIST)) {
    fs.mkdirSync(DIST, { recursive: true });
  }

  const browser = await chromium.launch();
  try {
    for (const job of JOBS) {
      if (!fs.existsSync(job.input)) {
        throw new Error(`Input file not found: ${job.input}`);
      }

      const markdown = fs.readFileSync(job.input, 'utf8');
      const title = path.basename(job.input, '.md');
      const html = buildHtml(title, markdown);

      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'load' });
        await page.emulateMedia({ media: 'print' });
        await page.pdf({
          path: job.output,
          format: 'A4',
          printBackground: true,
          margin: PDF_MARGIN,
        });
      } finally {
        await page.close();
      }

      const bytes = fs.statSync(job.output).size;
      console.log(`Wrote ${job.output} (${bytes} bytes)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
