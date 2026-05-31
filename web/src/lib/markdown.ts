import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Tight markdown renderer for chat. GFM (tables, code fences, autolinks)
// without anything that could phone home (no images by default — those
// rarely appear in chat replies and are an XSS vector).
marked.use({
  gfm: true,
  breaks: true,
  async: false,
});

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'mark',
    'a', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'span', 'div',
  ],
  ALLOWED_ATTR: ['href', 'title', 'class'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

export function renderMarkdown(text: string): string {
  if (!text) return '';
  const raw = marked.parse(text) as string;
  return DOMPurify.sanitize(raw, PURIFY_CONFIG);
}
