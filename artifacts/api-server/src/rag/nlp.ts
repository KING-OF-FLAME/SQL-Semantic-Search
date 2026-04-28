import { getOpenAI, getChatModel } from "../lib/openai";
import {
  INTENT_CLASSIFICATION_PROMPT,
  QUERY_REWRITE_PROMPT,
  ENTITY_EXTRACTION_PROMPT,
  GROUNDED_ANSWER_PROMPT,
  WEB_ENHANCED_ANSWER_PROMPT,
} from "./prompts";
import type { RetrievedChunk } from "./retrieval";
import type { WebSearchResult } from "./web-search";
import { logger } from "../lib/logger";

export type Intent =
  | "admissions"
  | "eligibility"
  | "scholarships"
  | "fees"
  | "hostel"
  | "placements"
  | "notices"
  | "results"
  | "policies"
  | "general";

export interface EntityItem {
  type: string;
  value: string;
}

export async function classifyIntent(question: string): Promise<Intent> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: getChatModel(),
      messages: [
        { role: "system", content: INTENT_CLASSIFICATION_PROMPT },
        { role: "user", content: question },
      ],
      max_tokens: 20,
      temperature: 0,
    });
    const raw = (response.choices[0]?.message?.content ?? "general").trim().toLowerCase();
    const validIntents: Intent[] = [
      "admissions", "eligibility", "scholarships", "fees",
      "hostel", "placements", "notices", "results", "policies", "general",
    ];
    return (validIntents.includes(raw as Intent) ? raw : "general") as Intent;
  } catch (err) {
    logger.error({ err }, "Intent classification failed");
    return "general";
  }
}

export async function rewriteQuery(question: string): Promise<string> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: getChatModel(),
      messages: [
        { role: "system", content: QUERY_REWRITE_PROMPT },
        { role: "user", content: question },
      ],
      max_tokens: 80,
      temperature: 0,
    });
    return response.choices[0]?.message?.content?.trim() ?? question;
  } catch (err) {
    logger.error({ err }, "Query rewrite failed");
    return question;
  }
}

export async function extractEntities(text: string): Promise<EntityItem[]> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: getChatModel(),
      messages: [
        { role: "system", content: ENTITY_EXTRACTION_PROMPT },
        { role: "user", content: text },
      ],
      max_tokens: 300,
      temperature: 0,
    });
    const content = response.choices[0]?.message?.content?.trim() ?? "[]";
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as EntityItem[];
    return [];
  } catch {
    return [];
  }
}

export async function generateGroundedAnswer(
  question: string,
  chunks: RetrievedChunk[],
  webResults?: WebSearchResult[],
): Promise<string> {
  const hasChunks = chunks.length > 0;
  const hasWeb = webResults && webResults.length > 0;

  if (!hasChunks && !hasWeb) {
    return "I could not verify this from official ADYPU sources. Please visit adypu.edu.in or contact the admissions office directly.";
  }

  const sourcesText = hasChunks
    ? chunks
        .map(
          (c, i) =>
            `[ADYPU Source ${i + 1}] Title: ${c.documentTitle}\nURL: ${c.sourceUrl}\nContent: ${c.content.slice(0, 800)}`,
        )
        .join("\n\n---\n\n")
    : "(No official ADYPU documents found in local knowledge base — rely on web results with verification caveat)";

  let systemPrompt: string;

  if (hasWeb) {
    const webText = webResults
      .map(
        (r, i) =>
          `[Web ${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`,
      )
      .join("\n\n---\n\n");

    systemPrompt = WEB_ENHANCED_ANSWER_PROMPT
      .replace("{sources}", sourcesText)
      .replace("{web_sources}", webText);
  } else {
    systemPrompt = GROUNDED_ANSWER_PROMPT.replace("{sources}", sourcesText);
  }

  try {
    const response = await getOpenAI().chat.completions.create({
      model: getChatModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      max_tokens: hasWeb ? 1200 : 800,
      temperature: 0.1,
    });
    return (
      response.choices[0]?.message?.content?.trim() ??
      "I could not verify this from official ADYPU sources."
    );
  } catch (err) {
    logger.error({ err }, "Answer generation failed");
    return "I could not verify this from official ADYPU sources.";
  }
}
