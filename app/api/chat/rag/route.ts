import { StreamingTextResponse } from "ai";
import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

import { runRAGAgent } from "@/app/ai_sdk/rag/agent";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body.input || "";
    const context = body.context || "";
    const { streamData } = await runRAGAgent(query, context);
    return new StreamingTextResponse(streamData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}