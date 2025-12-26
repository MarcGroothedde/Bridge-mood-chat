import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { detectMood } from "@/lib/mood";

export const runtime = "nodejs";

const supportiveSystem = `You are a supportive, calm helper. Keep responses concise (3-5 sentences), acknowledge the feeling, normalize it, and offer one actionable next step. Avoid platitudes; reflect back specifics. End with a gentle question to invite more sharing.`;

const exploratorySystem = `You are a curious collaborator. Keep responses concise (3-5 sentences), build on the user's interest, and ask one focused follow-up to deepen the topic. Keep tone upbeat but grounded, avoid overpromising.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return new Response("Missing CLAUDE_API_KEY environment variable.", { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const message: string | undefined = body?.message;

  if (!message || typeof message !== "string") {
    return new Response("Message is required.", { status: 400 });
  }

  const mood = detectMood(message);
  const system = mood.mode === "Supportive" ? supportiveSystem : exploratorySystem;

  const anthropic = new Anthropic({ apiKey });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`META:${JSON.stringify(mood)}\n`));

      try {
        const messageStream = await anthropic.messages.create({
          // Use generally available model; 20241022 may not be enabled on all keys.
          model: "claude-sonnet-4-20250514",
          max_tokens: 240,
          temperature: 0.5,
          system,
          stream: true,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `User message: ${message}\n\nDetected mood: ${mood.mood}\nSelected mode: ${mood.mode}\nUse the mode intent above while replying.`,
                },
              ],
            },
          ],
        });

        for await (const event of messageStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (error) {
        console.error("Anthropic stream error", error);
        controller.enqueue(encoder.encode("\n[stream error: unable to complete AI response]\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

