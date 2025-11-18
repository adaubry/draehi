import * as cheerio from "cheerio";

/**
 * Process Logseq-specific syntax in HTML
 * - [[page references]] → internal links
 * - ((block references)) → hash links
 * - TODO/DOING/DONE → checkboxes
 */
export function processLogseqReferences(
  html: string,
  workspaceSlug: string,
  currentPagePath: string
): string {
  const $ = cheerio.load(html);

  // Process text nodes for Logseq syntax
  $("*")
    .contents()
    .filter(function () {
      return this.type === "text";
    })
    .each(function () {
      const text = $(this).text();
      let processed = text;

      // Page references: [[page name]] or [[namespace/page]]
      processed = processed.replace(/\[\[([^\]]+)\]\]/g, (match, pageName) => {
        // Convert page name to URL path
        const pageSlug = pageName.trim().replace(/\//g, "/");
        const pageUrl = `/${workspaceSlug}/${pageSlug}`;
        return `<a href="${pageUrl}" class="page-reference" data-page="${pageName}">${pageName}</a>`;
      });

      // Block references: ((uuid))
      processed = processed.replace(
        /\(\(([a-f0-9-]{36})\)\)/g,
        (match, uuid) => {
          // Link to block on current page (hash link)
          return `<a href="#${uuid}" class="block-reference" data-block-uuid="${uuid}">((${uuid.slice(0, 8)}))</a>`;
        }
      );

      // Task markers: TODO, DOING, DONE, LATER, NOW
      processed = processed.replace(
        /\b(TODO|DOING|DONE|LATER|NOW)\b/g,
        (match, marker) => {
          const checked = marker === "DONE";
          const markerClass = `task-marker task-${marker.toLowerCase()}`;
          return `<span class="${markerClass}"><input type="checkbox" ${checked ? "checked" : ""} disabled /> ${marker}</span>`;
        }
      );

      // Priority levels: [#A], [#B], [#C]
      processed = processed.replace(/\[#([ABC])\]/g, (match, level) => {
        return `<span class="priority priority-${level}" data-priority="${level}">[#${level}]</span>`;
      });

      // Hashtags: #tag → page link
      // Match # followed by alphanumeric/underscore/dash, but not inside URLs or already processed HTML
      processed = processed.replace(
        /#([\w-]+)(?=\s|$|[^\w-])/g,
        (match, tag) => {
          // Skip if inside an href (basic check)
          if (processed.includes(`href="#${tag}`)) {
            return match;
          }
          const tagSlug = tag.toLowerCase();
          return `<a href="/${workspaceSlug}/${tagSlug}" class="hashtag-link" data-tag="${tag}">#${tag}</a>`;
        }
      );

      // Replace text node if changed
      if (processed !== text) {
        $(this).replaceWith(processed);
      }
    });

  return $.html();
}

/**
 * Convert Logseq page name to URL-safe path
 * Examples:
 * - "My Page" → "my-page"
 * - "guides/setup" → "guides/setup"
 * - "2024-01-15" → "2024-01-15"
 */
export function pageNameToPath(pageName: string): string {
  return pageName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9/-]/g, "");
}
