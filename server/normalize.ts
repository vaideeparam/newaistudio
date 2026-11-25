/**
 * Turn an MCP CallToolResult into plain data for the browser.
 * Order: structuredContent, then a single text block parsed as JSON,
 * then the joined text, then the raw content array.
 */
export interface ToolOutcome {
  isError: boolean;
  data: unknown;
}

interface ContentBlock {
  type: string;
  text?: string;
  [k: string]: unknown;
}

export function normalizeToolResult(result: {
  content?: unknown;
  structuredContent?: unknown;
  isError?: boolean;
}): ToolOutcome {
  const isError = result.isError === true;
  if (result.structuredContent !== undefined && result.structuredContent !== null) {
    return { isError, data: result.structuredContent };
  }
  const content = Array.isArray(result.content) ? (result.content as ContentBlock[]) : [];
  const texts = content.filter((b) => b.type === 'text' && typeof b.text === 'string');
  if (texts.length === content.length && texts.length > 0) {
    const joined = texts.map((b) => b.text).join('\n');
    if (texts.length === 1) {
      try {
        return { isError, data: JSON.parse(joined) };
      } catch {
        /* not JSON: fall through to plain text */
      }
    }
    return { isError, data: joined };
  }
  return { isError, data: content };
}
