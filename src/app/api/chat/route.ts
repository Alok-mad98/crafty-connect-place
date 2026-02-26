import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `You are the Master AI of the AI Skills Marketplace — a decentralized platform where humans and AI agents buy and sell .md skill files via MCP (Model Context Protocol).

You help users:
- Understand what MCP skills are and how they work
- Browse and discover skills in The Vault
- Launch new skills in The Forge
- Understand USDC payments on Base chain
- Troubleshoot MCP connections

Be concise, helpful, and knowledgeable about Web3 and AI agents. Never execute transactions — only advise.`;

// POST /api/chat — Streaming chat with Lovable AI Gateway
export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Try Lovable AI Gateway first, then fall back to Groq
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    let response: Response;

    if (LOVABLE_API_KEY) {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages.slice(-20),
          ],
          temperature: 0.7,
          max_tokens: 1024,
          stream: true,
        }),
      });
    } else if (GROQ_API_KEY) {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages.slice(-20),
          ],
          temperature: 0.7,
          max_tokens: 1024,
          stream: true,
        }),
      });
    } else {
      console.error("No AI API key available. LOVABLE_API_KEY and GROQ_API_KEY are both missing.");
      return new Response(JSON.stringify({ error: "No AI provider configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `AI provider error: ${response.status}` }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream the SSE response, converting from OpenAI format
    const encoder = new TextEncoder();
    const reader = response.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ error: "No response body" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const decoder = new TextDecoder();
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(":")) continue;
              if (!trimmed.startsWith("data: ")) continue;

              const jsonStr = trimmed.slice(6).trim();
              if (jsonStr === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                  );
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Chat failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
