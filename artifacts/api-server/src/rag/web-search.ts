import { logger } from "../lib/logger";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

function extractActualUrl(ddgUrl: string): string | null {
  // Extract actual URL from DDG redirect parameter (organic results)
  try {
    const uddgMatch = ddgUrl.match(/[?&]uddg=([^&]+)/);
    if (uddgMatch) {
      const decoded = decodeURIComponent(uddgMatch[1]);
      if (decoded.startsWith("http") && !decoded.includes("duckduckgo.com")) {
        return decoded;
      }
    }
  } catch {}

  // If it's already a direct non-DDG URL
  if (ddgUrl.startsWith("http") && !ddgUrl.includes("duckduckgo.com")) {
    return ddgUrl;
  }

  // Everything else (ads, DDG-internal URLs) is filtered out
  return null;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Search DuckDuckGo (no API key required) and return structured results
 * scoped to ADYPU university context.
 */
export async function searchDuckDuckGo(
  query: string,
  maxResults = 5,
): Promise<WebSearchResult[]> {
  const scopedQuery = `${query} ADYPU "Ajeenkya DY Patil University"`;

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(scopedQuery)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "DDG search returned non-OK status");
      return [];
    }

    const html = await res.text();

    const titleMatches = [
      ...html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g),
    ];
    const snippetMatches = [
      ...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g),
    ];

    const results: WebSearchResult[] = [];
    const maxItems = Math.min(
      maxResults,
      titleMatches.length,
      snippetMatches.length,
    );

    for (let i = 0; i < maxItems; i++) {
      const rawUrl = titleMatches[i][1];
      const actualUrl = extractActualUrl(rawUrl);
      if (!actualUrl) continue;

      const title = cleanHtml(titleMatches[i][2]);
      const snippet = cleanHtml(snippetMatches[i][1]);

      if (!title || !snippet) continue;

      results.push({ title, url: actualUrl, snippet });
    }

    logger.info(
      { count: results.length, query: scopedQuery.slice(0, 60) },
      "DDG web search completed",
    );
    return results;
  } catch (err) {
    logger.warn({ err }, "DDG web search failed — continuing without web context");
    return [];
  }
}
