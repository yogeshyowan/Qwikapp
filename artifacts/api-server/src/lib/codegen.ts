import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.MYANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY must be set");
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
- Return ONLY a JSON object with this structure:
{
  "summary": "Brief description of what was built",
  "files": [
    { "filename": "relative/path/file.ext", "language": "javascript", "content": "full file content here" }
  ]
}
- Do not include any text outside the JSON object`;

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
    max_tokens: 8192,
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
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }
    const parsed = JSON.parse(jsonMatch[0]) as GenerationResult;
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

export async function streamConversationResponse(
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const client = getAnthropicClient();

  let fullResponse = "";

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
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
  }

  return fullResponse;
}
