import { createActionHeaders } from "@solana/actions";

const chainId = process.env.SOLANA_NETWORK ?? "devnet";
const headers = createActionHeaders({ chainId, actionVersion: "1" });

/**
 * actions.json tells blink clients how to map website URLs to Action API endpoints.
 * @see https://github.com/solana-labs/solana-actions-spec
 */
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
