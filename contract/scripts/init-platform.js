const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const CONTRACT_ROOT = path.resolve(__dirname, "..");
const IDL_PATH = path.join(CONTRACT_ROOT, "target/idl/interval.json");
const DEFAULT_WALLET_PATH = "/Users/vijaykv/.config/solana/id.json";
const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_PROGRAM_ID = "4ATtXLmT25nh447GjP9BtdWJudN8uuqcNNmawRWexfx6";

function loadKeypair(walletPath) {
  const secret = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")));
  return Keypair.fromSecretKey(secret);
}

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL;
  const walletPath = process.env.SOLANA_WALLET_PATH || DEFAULT_WALLET_PATH;
  const programId = new PublicKey(process.env.INTERVAL_PROGRAM_ID || DEFAULT_PROGRAM_ID);
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));

  const walletKeypair = loadKeypair(walletPath);
  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const programAccount = await connection.getAccountInfo(programId, "confirmed");
  if (!programAccount) {
    throw new Error(
      `Program ${programId.toBase58()} does not exist on ${rpcUrl}. Deploy it first, then rerun this script.`
    );
  }

  if (!programAccount.executable) {
    throw new Error(
      `Program ${programId.toBase58()} exists on ${rpcUrl} but is not executable. Check the deployed program id.`
    );
  }

  const program = new anchor.Program(
    {
      ...idl,
      address: programId.toBase58(),
    },
    provider
  );
  const [platformPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    programId
  );

  const existingPlatform = await connection.getAccountInfo(platformPda, "confirmed");
  if (existingPlatform) {
    console.log("Platform already initialized.");
    console.log("Admin:", provider.wallet.publicKey.toBase58());
    console.log("Program:", programId.toBase58());
    console.log("Platform PDA:", platformPda.toBase58());
    return;
  }

  const signature = await program.methods
    .initializePlatform()
    .accounts({
      platform: platformPda,
      admin: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Platform initialized.");
  console.log("Admin:", provider.wallet.publicKey.toBase58());
  console.log("Program:", programId.toBase58());
  console.log("Platform PDA:", platformPda.toBase58());
  console.log("Tx:", signature);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
