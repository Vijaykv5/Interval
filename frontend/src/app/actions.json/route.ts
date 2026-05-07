import { createActionHeaders } from "@solana/actions";
import { SOLANA_NETWORK } from "@/lib/solana-config";

const chainId = SOLANA_NETWORK;
const headers = createActionHeaders({ chainId, actionVersion: "1" });

export async function GET() {
  const payload = {
    rules: [
      {
        pathPattern: "/book/*",
        apiPath: "/api/action/book",
      },
    ],
  };
  return Response.json(payload, { headers });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers });
}
