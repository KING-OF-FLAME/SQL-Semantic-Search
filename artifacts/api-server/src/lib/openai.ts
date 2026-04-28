import OpenAI from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const envApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (!baseURL && !envApiKey) {
  throw new Error("Either AI_INTEGRATIONS_OPENAI_BASE_URL or OPENAI_API_KEY must be set.");
}

let _apiKey: string = envApiKey ?? "dummy";
let _chatModel: string = "gpt-4o-mini";
let _client: OpenAI = new OpenAI({ baseURL, apiKey: _apiKey });

export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIMENSIONS = 1536;

/**
 * Called once per chat request with settings read from DB.
 * Re-creates the OpenAI client only when the key actually changes.
 * When using the Replit AI proxy (baseURL set), DB key is ignored.
 */
export function updateOpenAIConfig(dbApiKey?: string, dbChatModel?: string): void {
  if (!baseURL && dbApiKey && dbApiKey.startsWith("sk-") && dbApiKey !== _apiKey) {
    _apiKey = dbApiKey;
    _client = new OpenAI({ apiKey: dbApiKey });
  }
  if (dbChatModel && dbChatModel !== _chatModel) {
    _chatModel = dbChatModel;
  }
}

export function getOpenAI(): OpenAI {
  return _client;
}

export function getChatModel(): string {
  return _chatModel;
}
