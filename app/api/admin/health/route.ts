import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProviderStatus = {
  provider: string;
  model: string;
  status: "healthy" | "error";
  message: string;
  latencyMs?: number;
};

const REQUEST_TIMEOUT_MS = 10_000;

const GEMINI_MODEL = "gemini-1.5-flash-lite";
const OPENROUTER_MODEL = "openrouter/free";
const GROQ_MODEL = "openai/gpt-oss-120b";

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") {
      return "Provider check timed out.";
    }
    return error.message;
  }

  return "Provider check failed.";
}

async function checkGemini(): Promise<ProviderStatus> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      provider: "Gemini",
      model: GEMINI_MODEL,
      status: "error",
      message: "GEMINI_API_KEY is not configured.",
    };
  }

  try {
    const startedAt = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`,
      {
        headers: { "x-goog-api-key": apiKey },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      return {
        provider: "Gemini",
        model: GEMINI_MODEL,
        status: "error",
        message: `Gemini returned HTTP ${response.status}.`,
        latencyMs: Date.now() - startedAt,
      };
    }

    return {
      provider: "Gemini",
      model: GEMINI_MODEL,
      status: "healthy",
      message: "Key is valid and the model is available.",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      provider: "Gemini",
      model: GEMINI_MODEL,
      status: "error",
      message: errorMessage(error),
    };
  }
}

async function checkOpenRouter(): Promise<ProviderStatus> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      provider: "OpenRouter",
      model: OPENROUTER_MODEL,
      status: "error",
      message: "OPENROUTER_API_KEY is not configured.",
    };
  }

  try {
    const headers = { Authorization: `Bearer ${apiKey}` };
    const startedAt = Date.now();

    const keyResponse = await fetch("https://openrouter.ai/api/v1/key", {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!keyResponse.ok) {
      return {
        provider: "OpenRouter",
        model: OPENROUTER_MODEL,
        status: "error",
        message: `OpenRouter rejected the API key (HTTP ${keyResponse.status}).`,
        latencyMs: Date.now() - startedAt,
      };
    }

    const modelResponse = await fetch(
      `https://openrouter.ai/api/v1/models/${OPENROUTER_MODEL}/endpoints`,
      {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );

    if (!modelResponse.ok) {
      return {
        provider: "OpenRouter",
        model: OPENROUTER_MODEL,
        status: "error",
        message: `Model is unavailable (HTTP ${modelResponse.status}).`,
        latencyMs: Date.now() - startedAt,
      };
    }

    return {
      provider: "OpenRouter",
      model: OPENROUTER_MODEL,
      status: "healthy",
      message: "Key is valid and the model is available.",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      provider: "OpenRouter",
      model: OPENROUTER_MODEL,
      status: "error",
      message: errorMessage(error),
    };
  }
}

async function checkGroq(): Promise<ProviderStatus> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      provider: "Groq",
      model: GROQ_MODEL,
      status: "error",
      message: "GROQ_API_KEY is not configured.",
    };
  }

  try {
    const startedAt = Date.now();
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        provider: "Groq",
        model: GROQ_MODEL,
        status: "error",
        message: `Groq returned HTTP ${response.status}.`,
        latencyMs: Date.now() - startedAt,
      };
    }

    const payload = (await response.json()) as {
      data?: Array<{ id?: string }>;
    };
    const available = payload.data?.some(
      (model) => model.id === GROQ_MODEL
    );

    if (!available) {
      return {
        provider: "Groq",
        model: GROQ_MODEL,
        status: "error",
        message: "The configured model is not listed by Groq.",
        latencyMs: Date.now() - startedAt,
      };
    }

    return {
      provider: "Groq",
      model: GROQ_MODEL,
      status: "healthy",
      message: "Key is valid and the model is available.",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      provider: "Groq",
      model: GROQ_MODEL,
      status: "error",
      message: errorMessage(error),
    };
  }
}

async function checkDeepgram(): Promise<ProviderStatus> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return {
      provider: "Deepgram",
      model: "Nova-2",
      status: "error",
      message: "DEEPGRAM_API_KEY is not configured.",
    };
  }

  try {
    const startedAt = Date.now();
    const response = await fetch("https://api.deepgram.com/v1/auth/token", {
      headers: { Authorization: `Token ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        provider: "Deepgram",
        model: "Nova-2",
        status: "error",
        message: `Deepgram rejected the API key (HTTP ${response.status}).`,
        latencyMs: Date.now() - startedAt,
      };
    }

    return {
      provider: "Deepgram",
      model: "Nova-2",
      status: "healthy",
      message: "Key is valid and the API is reachable.",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      provider: "Deepgram",
      model: "Nova-2",
      status: "error",
      message: errorMessage(error),
    };
  }
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[admin-health] Could not verify admin access", error);
    return NextResponse.json(
      { error: "Could not verify admin access." },
      { status: 500 }
    );
  }

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const statuses = await Promise.all([
    checkGemini(),
    checkOpenRouter(),
    checkGroq(),
    checkDeepgram(),
  ]);

  return NextResponse.json(statuses, {
    headers: { "Cache-Control": "no-store" },
  });
}
