import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Creator token launch is temporarily disabled while the app is configured for devnet flow testing.",
    },
    { status: 410 }
  );
}
