import { createActionHeaders } from "@solana/actions";

const chainId = process.env.SOLANA_NETWORK ?? "devnet";
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
