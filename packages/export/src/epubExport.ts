/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import { Project, Chapter } from './types.js';

export async function generateEpub(project: Project, chapters: Chapter[]) {
  const zip = new JSZip();

  // 1. mimetype (MUST be first and uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`);

  // 3. OEBPS/content.opf
  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);
  
  let coverItem = '';
  let coverManifest = '';
  const imageUrl = project.publishing?.coverTheme?.imageUrl;

  if (imageUrl) {
    const isBase64 = imageUrl.startsWith('data:');
    if (isBase64) {
      const parts = imageUrl.split(',');
      const contentType = parts[0].split(':')[1].split(';')[0];
      const extension = contentType.split('/')[1];
      const b64Data = parts[1];
      zip.file(`OEBPS/cover.${extension}`, b64Data, { base64: true });
      coverItem = `<item id="cover-image" href="cover.${extension}" media-type="${contentType}" properties="cover-image"/>`;
      coverManifest = `<meta name="cover" content="cover-image"/>`;
    }
  }

  const manifestItems = sortedChapters.map((c, i) => `<item id="chapter_${i}" href="chapter_${i}.xhtml" media-type="application/xhtml+xml"/>`).join('\n        ');
  const spineItems = sortedChapters.map((c, i) => `<itemref idref="chapter_${i}"/>`).join('\n        ');

  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:identifier id="pub-id">urn:uuid:${project.id}</dc:identifier>
        <dc:title>${project.title}</dc:title>
        <dc:language>en</dc:language>
        <dc:creator>${project.publishing?.authorName || 'Unknown Author'}</dc:creator>
        <meta property="dcterms:modified">${new Date().toISOString().replace(/\.[0-9]+Z/, 'Z')}</meta>
        ${coverManifest}
    </metadata>
    <manifest>
        <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        ${coverItem}
        ${manifestItems}
    </manifest>
    <spine>
        <itemref idref="toc"/>
        ${spineItems}
    </spine>
</package>`);

  // 4. OEBPS/toc.xhtml
  const tocItems = sortedChapters.map((c, i) => `<li><a href="chapter_${i}.xhtml">${c.title}</a></li>`).join('\n            ');
  zip.file('OEBPS/toc.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title></head>
<body>
    <nav epub:type="toc">
        <h1>Table of Contents</h1>
        <ol>
            ${tocItems}
        </ol>
    </nav>
</body>
</html>`);

  // 5. OEBPS Chapters
  sortedChapters.forEach((chapter, i) => {
    zip.file(`OEBPS/chapter_${i}.xhtml`, `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>${chapter.title}</title>
    <style>
        body { font-family: serif; line-height: 1.5; padding: 1em; }
        h1 { text-align: center; margin-bottom: 2em; }
        p { text-indent: 1.5em; margin: 0; }
        p + p { margin-top: 0.5em; }
    </style>
</head>
<body>
    <h1>${chapter.title}</h1>
    ${chapter.content.split('\n\n').map(p => `<p>${p}</p>`).join('\n    ')}
</body>
</html>`);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.title.replace(/\s+/g, '_')}.epub`;
  a.click();
  URL.revokeObjectURL(url);
}
