import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

/**
 * Convert markdown to HTML
 * Used for rendering Logseq block content
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);

  return String(result);
}

/**
 * Synchronous version for use in server actions
 * Note: This is less feature-complete but works for basic markdown
 */
export function markdownToHtmlSync(markdown: string): string {
  // For now, just escape HTML and preserve line breaks
  // TODO: Enhance with proper sync markdown rendering
  return markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .split("\n")
    .map((line) => `<p>${line}</p>`)
    .join("");
}
