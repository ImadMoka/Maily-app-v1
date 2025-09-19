export interface DetectionResult {
  isHtml: boolean;
  hasImages: boolean;
  hasLinks: boolean;
  characterCount: number;
}

export class ContentDetector {
  detect(content: string, mimeType?: string): DetectionResult {
    // Single pass through content
    let isHtml = false;
    let hasImages = false;
    let hasLinks = false;

    // Quick MIME type check first (trust but verify)
    if (mimeType?.includes('html')) {
      isHtml = true;
    }

    // Single regex pass for all features
    const htmlPattern = /<(\w+)([^>]*)>/g;
    let match;

    while ((match = htmlPattern.exec(content)) !== null) {
      const tag = match[1]?.toLowerCase();

      if (!tag) continue;

      // Detect HTML structure
      if (tag === 'html' || tag === 'body' || tag === 'div' || tag === 'p' || tag === 'br') {
        isHtml = true;
      }

      // Detect images
      if (tag === 'img') {
        hasImages = true;
      }

      // Detect links
      if (tag === 'a') {
        hasLinks = true;
      }
    }

    // Character count (excluding tags if HTML)
    const characterCount = isHtml
      ? content.replace(/<[^>]*>/g, '').trim().length
      : content.trim().length;


    return {
      isHtml,
      hasImages,
      hasLinks,
      characterCount
    };
  }
}
