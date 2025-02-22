import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ResearchChain } from "@/app/deep-research/chains/research";
import { loadConfiguration } from "@/app/deep-research/configuration";
import { ResearchStateSchema } from "@/app/deep-research/state";

export async function POST(req: NextRequest) {
  try {
    // Validate input
    const body = await req.json();
    const { topic } = ResearchStateSchema.parse(body);

    // Load configuration
    const config = loadConfiguration();

    // Initialize and execute research chain
    const chain = new ResearchChain(config);
    const result = await chain.execute(topic);

    // Return results including final report
    return NextResponse.json({
      success: true,
      data: result,
      final_report: result.state.final_report || null
    });

  } catch (error: unknown) {
    console.error("Deep research error:", error);

    // Handle validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          errors: error.errors.map(e => ({
            path: e.path.join("."),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === "development"
          ? error instanceof Error ? error.message : "Unknown error"
          : "An error occurred while processing your research request"
      },
      { status: 500 }
    );
  }
}