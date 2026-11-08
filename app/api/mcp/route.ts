import type { IncomingMessage, ServerResponse } from "node:http";
import OpenAI from "openai";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SESSIONS = 100;
const transports = new Map<string, SSEServerTransport>();

const EngagingClipSchema = z.object({
  title: z.string().trim().min(1).max(120),
  startTime: z.number().finite().min(0),
  endTime: z.number().finite().positive(),
  reason: z.string().trim().max(240).optional(),
});

const EngagingClipsResponseSchema = z.object({
  clips: z.array(EngagingClipSchema).min(1).max(10),
});

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "MCP AI tools are not configured. Add OPENAI_API_KEY on the server."
    );
  }
  return new OpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL });
}

function parseJsonContent(content: string): unknown {
  return JSON.parse(
    content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
  );
}

function toolError(error: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: error instanceof Error ? error.message : "The tool failed.",
      },
    ],
    isError: true,
  };
}

function createMcpServer() {
  const server = new McpServer(
    { name: "clippboard", version: "1.0.0" },
    { capabilities: { logging: {} } }
  );

  server.registerTool(
    "get_engaging_clips",
    {
      description:
        "Find the strongest, most engaging moments in a timestamped video transcript. Returns clip titles, source start/end timestamps, and reasons.",
      inputSchema: {
        transcript: z
          .string()
          .trim()
          .min(20)
          .max(80000)
          .describe(
            "Video transcript with timestamps in seconds. Include speaker text and timestamps."
          ),
        clipCount: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("How many clips to return. Defaults to 5."),
      },
    },
    async ({ transcript, clipCount = 5 }, extra) => {
      try {
        const openai = getOpenAI();
        const completion = await openai.chat.completions.create(
          {
            model: process.env.OPENAI_MODEL ?? "gpt-4o",
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  'You are an expert short-form video editor. Analyze the supplied transcript and find the strongest self-contained moments for TikTok, Reels, or Shorts. Use only timestamps present in the transcript. Each clip must have a short title, startTime, endTime, and a one-sentence reason. Return JSON only in the shape {"clips":[{"title":"...","startTime":0,"endTime":30,"reason":"..."}]}.',
              },
              {
                role: "user",
                content: `Return ${clipCount} engaging clips. Transcript with timestamps in seconds:\n\n${transcript}`,
              },
            ],
          },
          { signal: extra.signal }
        );

        const content = completion.choices[0]?.message?.content;
        if (!content?.trim()) {
          throw new Error("The AI returned no clips. Please try again.");
        }

        const validation = EngagingClipsResponseSchema.safeParse(
          parseJsonContent(content)
        );
        if (!validation.success) {
          throw new Error("The AI returned an invalid clip response.");
        }

        const clips = validation.data.clips
          .map((clip) => ({
            title: clip.title,
            startTime: Math.round(Math.max(0, clip.startTime) * 100) / 100,
            endTime:
              Math.round(Math.max(clip.startTime + 0.1, clip.endTime) * 100) /
              100,
            reason: clip.reason ?? "",
          }))
          .slice(0, clipCount);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ clips }, null, 2),
            },
          ],
        };
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    "generate_caption",
    {
      description:
        "Generate a short, engaging TikTok caption with relevant hashtags for a topic.",
      inputSchema: {
        topic: z
          .string()
          .trim()
          .min(2)
          .max(300)
          .describe("The clip topic, message, or transcript summary."),
      },
    },
    async ({ topic }, extra) => {
      try {
        const openai = getOpenAI();
        const completion = await openai.chat.completions.create(
          {
            model: process.env.OPENAI_MODEL ?? "gpt-4o",
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content:
                  "You write high-performing TikTok captions. Write one punchy caption under 180 characters followed by 3 to 6 relevant hashtags. No quotation marks, labels, or markdown. Return caption text only.",
              },
              {
                role: "user",
                content: `Topic: ${topic}`,
              },
            ],
          },
          { signal: extra.signal }
        );

        const caption = completion.choices[0]?.message?.content?.trim();
        if (!caption) {
          throw new Error("The AI returned an empty caption. Please try again.");
        }

        return {
          content: [{ type: "text" as const, text: caption }],
        };
      } catch (error) {
        return toolError(error);
      }
    }
  );

  return server;
}

type SseStreamController = ReadableStreamDefaultController<Uint8Array>;

function createSseResponseShim(controller: SseStreamController) {
  const encoder = new TextEncoder();
  const closeListeners = new Set<() => void>();
  let ended = false;
  let status = 200;
  const responseHeaders: Record<string, string> = {};

  function end(chunk?: unknown) {
    if (chunk) {
      try {
        controller.enqueue(encoder.encode(String(chunk)));
      } catch {
        // The stream may already be closed by the client.
      }
    }
    if (!ended) {
      ended = true;
      try {
        controller.close();
      } catch {
        // The stream may already be closed by the client.
      }
      closeListeners.forEach((listener) => listener());
      closeListeners.clear();
    }
  }

  const response = {
    writeHead(code: number, headers?: Record<string, string | string[]>) {
      status = code;
      Object.entries(headers ?? {}).forEach(([key, value]) => {
        responseHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
      });
      return response;
    },
    setHeader(name: string, value: string | string[]) {
      responseHeaders[name] = Array.isArray(value) ? value.join(", ") : value;
      return response;
    },
    getHeader(name: string) {
      return responseHeaders[name];
    },
    flushHeaders() {},
    write(chunk: unknown) {
      if (!ended) {
        controller.enqueue(encoder.encode(String(chunk)));
      }
      return true;
    },
    end,
    on(event: string, listener: () => void) {
      if (event === "close") closeListeners.add(listener);
      return response;
    },
    once(event: string, listener: () => void) {
      if (event === "close") closeListeners.add(listener);
      return response;
    },
    socket: {},
    get headersSent() {
      return true;
    },
    get statusCode() {
      return status;
    },
  };

  return { response, end };
}

function createPostResponseShim() {
  let status = 200;
  let body = "";
  const headers: Record<string, string> = {};

  const response = {
    writeHead(code: number, nextHeaders?: Record<string, string | string[]>) {
      status = code;
      Object.entries(nextHeaders ?? {}).forEach(([key, value]) => {
        headers[key] = Array.isArray(value) ? value.join(", ") : value;
      });
      return response;
    },
    setHeader(name: string, value: string | string[]) {
      headers[name] = Array.isArray(value) ? value.join(", ") : value;
      return response;
    },
    getHeader(name: string) {
      return headers[name];
    },
    write(chunk: unknown) {
      body += String(chunk);
      return true;
    },
    end(chunk?: unknown) {
      if (chunk) body += String(chunk);
      return response;
    },
    socket: {},
  };

  return {
    response,
    getResult() {
      return { status, body, headers };
    },
  };
}

export async function GET(request: Request) {
  if (transports.size >= MAX_SESSIONS) {
    return new Response("Too many open MCP sessions. Try again shortly.", {
      status: 503,
    });
  }

  let controller!: SseStreamController;
  const stream = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController;
    },
  });

  const { response, end } = createSseResponseShim(controller);
  const transport = new SSEServerTransport(
    "/api/mcp",
    response as unknown as ServerResponse
  );
  const sessionId = transport.sessionId;
  transports.set(sessionId, transport);

  transport.onclose = () => {
    transports.delete(sessionId);
    end();
  };

  request.signal.addEventListener("abort", () => {
    void transport.close().catch(() => undefined);
  });

  try {
    const server = createMcpServer();
    await server.connect(transport);
  } catch (error) {
    transports.delete(sessionId);
    end();
    console.error("[mcp] Could not establish SSE session", error);
    return new Response("Could not establish MCP session.", { status: 500 });
  }

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return new Response("Missing sessionId parameter.", { status: 400 });
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    return new Response("MCP session not found or expired.", { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return new Response("Expected application/json.", { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  const requestHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });

  const requestShim = {
    headers: requestHeaders,
    url: request.url,
    method: "POST",
    socket: {},
  } as unknown as IncomingMessage;

  const collector = createPostResponseShim();

  try {
    await transport.handlePostMessage(
      requestShim,
      collector.response as unknown as ServerResponse,
      body
    );
  } catch (error) {
    console.error("[mcp] Could not handle MCP message", error);
    return new Response("Could not handle MCP message.", { status: 500 });
  }

  const result = collector.getResult();
  return new Response(result.body || null, {
    status: result.status,
    headers: {
      "Content-Type":
        result.headers["Content-Type"] ??
        result.headers["content-type"] ??
        "text/plain; charset=utf-8",
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
