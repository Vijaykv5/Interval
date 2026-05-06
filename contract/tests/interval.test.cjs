const assert = require("node:assert/strict");
const { before, describe, it } = require("node:test");
const anchor = require("@coral-xyz/anchor");
const { Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");

const PLATFORM_SEED = "platform";
const CREATOR_SEED = "creator";

describe("interval", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Interval;
  const creator = Keypair.generate();

  const [platformPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(PLATFORM_SEED)],
    program.programId
  );

  const [creatorProfilePda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CREATOR_SEED), creator.publicKey.toBuffer()],
    program.programId
  );

  before(async () => {
    const signature = await provider.connection.requestAirdrop(
      creator.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "confirmed"
    );
  });

  it("initializes the platform account", async () => {
    await program.methods
      .initializePlatform()
      .accounts({
        platform: platformPda,
        admin: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const platform = await program.account.platform.fetch(platformPda);

    assert.equal(platform.admin.toBase58(), provider.wallet.publicKey.toBase58());
    assert.equal(platform.isPaused, false);
  });

  it("registers a creator profile", async () => {
    await program.methods
      .registerCreator()
      .accounts({
        platform: platformPda,
        creatorProfile: creatorProfilePda,
        authority: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const creatorProfile = await program.account.creatorProfile.fetch(creatorProfilePda);

    assert.equal(creatorProfile.authority.toBase58(), creator.publicKey.toBase58());
    assert.equal(creatorProfile.isActive, true);
  });
});
