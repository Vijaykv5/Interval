import { createActionHeaders } from "@solana/actions";
import { getSelectedSolanaNetwork } from "@/lib/solana-config";

export async function GET(req: Request) {
  const chainId = getSelectedSolanaNetwork(req.headers.get("cookie"));
  const headers = createActionHeaders({ chainId, actionVersion: "1" });
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

export async function OPTIONS(req: Request) {
  const chainId = getSelectedSolanaNetwork(req.headers.get("cookie"));
  const headers = createActionHeaders({ chainId, actionVersion: "1" });
  return new Response(null, { status: 204, headers });
}
