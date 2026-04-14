import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

function getAnthropicClient(): Anthropic {
  const apiKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.MYANTHROPIC_API_KEY ||
    process.env.MY_ANTHROPIC_API_KEY ||
    process.env.CLAUDE_API_KEY;
  const baseURL = process.env.ANTHROPIC_BASE_URL;

  if (!apiKey) {
    throw new Error(
      "Your Anthropic API key is missing. Add it as ANTHROPIC_API_KEY.",
    );
  }

  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

export interface GeneratedFile {
  filename: string;
  language: string;
  content: string;
}

export interface GenerationResult {
  files: GeneratedFile[];
  summary: string;
}

const SYSTEM_PROMPT = `You are an expert software engineer. When given an app idea and tech stack, you generate complete, production-ready code.

Rules:
- Generate ALL files needed for the app to run (package.json, source files, etc.)
- Always include a Dockerfile that exposes port 3000
- Make the app fully functional — no placeholders, no TODOs
- Be concise: avoid unnecessary comments, long license headers, and verbose boilerplate
- Keep the app compact enough to fit in a single response. Prefer fewer files with cohesive code over many small component files.
- For React apps, prefer Vite and keep UI code in src/App.jsx plus src/App.css unless more files are truly necessary.
- Return ONLY a JSON object with this structure:
{
  "summary": "Brief description of what was built",
  "files": [
    { "filename": "relative/path/file.ext", "language": "javascript", "content": "full file content here" }
  ]
}
- Do not wrap the JSON in markdown fences.
- Do not include any text outside the JSON object`;

function extractJsonObject(response: string): string {
  const trimmed = response.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in Claude response");
  }

  return unfenced.slice(start, end + 1);
}

function validateGenerationResult(value: unknown): GenerationResult {
  if (!value || typeof value !== "object") {
    throw new Error("Claude response was not an object");
  }

  const result = value as Partial<GenerationResult>;
  if (typeof result.summary !== "string" || !Array.isArray(result.files)) {
    throw new Error("Claude response did not include summary and files");
  }

  for (const file of result.files) {
    if (
      !file ||
      typeof file !== "object" ||
      typeof file.filename !== "string" ||
      typeof file.language !== "string" ||
      typeof file.content !== "string"
    ) {
      throw new Error("Claude response included an invalid file entry");
    }
  }

  return result as GenerationResult;
}

export async function generateAppCode(
  title: string,
  description: string,
  techStack: string,
  onChunk?: (chunk: string) => void
): Promise<GenerationResult> {
  const client = getAnthropicClient();

  logger.info({ title, techStack }, "Generating app code with Claude");

  const userPrompt = `Build a complete app with the following details:

Title: ${title}
Description: ${description}
Tech Stack: ${techStack}

Generate all files needed. Include:
1. The complete application source code
2. A package.json with all dependencies
3. A Dockerfile (expose port 3000)

Keep file contents concise and production-ready. Return the complete JSON response.`;

  let fullResponse = "";

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 12000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullResponse += event.delta.text;
      if (onChunk) {
        onChunk(event.delta.text);
      }
    }
  }

  try {
    const parsed = validateGenerationResult(JSON.parse(extractJsonObject(fullResponse)));
    logger.info(
      { fileCount: parsed.files.length },
      "Successfully parsed generated files"
    );
    return parsed;
  } catch (err) {
    logger.error({ err }, "Failed to parse Claude response as JSON");
    throw new Error("Failed to parse generated code from Claude");
  }
}

export const LIVE_BUILD_SYSTEM = `You are a live app builder. Build a complete, self-contained HTML application progressively, emitting JSON action objects.

OUTPUT RULES:
- Output ONLY valid JSON objects, one per action. No prose, no markdown, no text outside JSON.
- Every JSON object must be complete and independently parseable.

BUILD PROTOCOL:

Step 1 — Build immediately. Never ask questions before building. Make sensible design choices.
Emit 3–4 progressive build actions, each with the FULL current HTML document:
{"action":"build","part":"Structure","progress":25,"html":"<!doctype html><html lang=\\"en\\">...</html>","message":"Created the basic layout","done":false}
{"action":"build","part":"Core Features","progress":65,"html":"<!doctype html><html lang=\\"en\\">...</html>","message":"Implemented main functionality","done":false}
{"action":"build","part":"Complete App","progress":100,"html":"<!doctype html><html lang=\\"en\\">...</html>","message":"Working app ready","done":true}

Step 2 — Immediately after the final build action (done:true), emit ONE ask action with 3 specific enhancement suggestions tailored to what was just built:
{"action":"ask","question":"Your app is ready! What would you like to add next?","options":["Specific feature A","Specific feature B","Specific feature C"]}

MODIFICATION PROTOCOL (when user requests a change or picks a suggestion):
Emit a single modify action with the complete updated HTML:
{"action":"modify","part":"What changed","progress":100,"html":"<!doctype html><html lang=\\"en\\">...</html>","message":"Description of the change","done":true}

Immediately after each modify action, emit another ask with 3 fresh suggestions relevant to the current state of the app:
{"action":"ask","question":"What would you like to improve next?","options":["Option A","Option B","Option C"]}

CRITICAL RULES:
- NEVER ask questions before building — always build first
- Every build/modify action's "html" field MUST contain the COMPLETE HTML document from <!doctype html> to </html>
- Each HTML snapshot must be a fully working, renderable page on its own
- Embed all CSS in <style> tags; embed all JS in <script> tags
- You MAY use CDN-hosted libraries via <script src="..."> (Tailwind, Chart.js, Alpine.js, etc.)
- Never use ES module syntax (import/export) in inline <script> tags
- Make suggestions specific to what was actually built — not generic
- Build apps that are visually polished with modern styling
- When modifying an existing app, preserve the current interface and behavior unless the user explicitly asks to replace it
- If the user message includes current preview HTML, treat it as the exact interface state the user is seeing and update that complete document`;

/**
 * Scans a streaming text buffer and extracts any complete top-level JSON objects.
 * Handles strings containing braces and escape sequences correctly.
 * Returns the parsed objects and the remaining unparsed buffer.
 */
export function extractCompleteJsonObjects(buffer: string): {
  objects: unknown[];
  remaining: string;
} {
  const objects: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  let lastEnd = 0;

  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        const jsonStr = buffer.slice(start, i + 1);
        try {
          objects.push(JSON.parse(jsonStr));
        } catch {
          // Skip malformed object
        }
        lastEnd = i + 1;
        start = -1;
      }
    }
  }

  // Keep any in-progress partial object; discard consumed content.
  const remaining = start !== -1 ? buffer.slice(start) : "";
  void lastEnd; // lastEnd used implicitly via start logic
  return { objects, remaining };
}

export interface StreamResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export async function streamConversationResponse(
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt: string,
  onChunk: (chunk: string) => void,
  maxTokens = 2048
): Promise<StreamResult> {
  const client = getAnthropicClient();

  let fullResponse = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullResponse += event.delta.text;
      onChunk(event.delta.text);
    }
    if (event.type === "message_delta" && event.usage) {
      outputTokens = event.usage.output_tokens ?? 0;
    }
    if (event.type === "message_start" && event.message.usage) {
      inputTokens = event.message.usage.input_tokens ?? 0;
    }
  }

  return { text: fullResponse, inputTokens, outputTokens };
}
