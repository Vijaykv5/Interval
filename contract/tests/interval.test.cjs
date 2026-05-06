const assert = require("node:assert/strict");
const { before, describe, it } = require("node:test");
const anchor = require("@coral-xyz/anchor");
const { Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");

const PLATFORM_SEED = "platform";
const CREATOR_SEED = "creator";
const BOOKING_SEED = "booking";
const LAMPORTS_PER_SOL = anchor.web3.LAMPORTS_PER_SOL;

function fixedArray(value) {
  return Array.from(Buffer.alloc(32, value));
}

function uniqueArray() {
  return Array.from(Keypair.generate().publicKey.toBytes());
}

function findBookingPda(programId, bookingId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BOOKING_SEED), Buffer.from(bookingId)],
    programId
  )[0];
}

async function airdrop(connection, pubkey, lamports) {
  const signature = await connection.requestAirdrop(pubkey, lamports);
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed"
  );
}

async function expectAnchorError(promise, messageFragment) {
  await assert.rejects(
    promise,
    (error) => {
      const message = String(error?.error?.errorMessage || error?.message || error);
      return message.includes(messageFragment);
    }
  );
}

describe("interval", () => {
  const provider = process.env.ANCHOR_PROVIDER_URL
    ? anchor.AnchorProvider.env()
    : anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.Interval;
  const creator = Keypair.generate();
  const buyer = Keypair.generate();
  const refundBuyer = Keypair.generate();

  const [platformPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(PLATFORM_SEED)],
    program.programId
  );

  const [creatorProfilePda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CREATOR_SEED), creator.publicKey.toBuffer()],
    program.programId
  );

  before(async () => {
    await Promise.all([
      airdrop(provider.connection, creator.publicKey, 3 * LAMPORTS_PER_SOL),
      airdrop(provider.connection, buyer.publicKey, 3 * LAMPORTS_PER_SOL),
      airdrop(provider.connection, refundBuyer.publicKey, 3 * LAMPORTS_PER_SOL),
    ]);
  });

  it("initializes the platform account", async () => {
    const existingPlatform = await program.account.platform.fetchNullable(platformPda);

    if (!existingPlatform) {
      await program.methods
        .initializePlatform()
        .accounts({
          platform: platformPda,
          admin: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }

    const platform = await program.account.platform.fetch(platformPda);

    assert.equal(platform.admin.toBase58(), provider.wallet.publicKey.toBase58());
    assert.equal(platform.isPaused, false);
  });

  it("registers a creator profile", async () => {
    const existingCreator = await program.account.creatorProfile.fetchNullable(
      creatorProfilePda
    );

    if (!existingCreator) {
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
    }

    const creatorProfile = await program.account.creatorProfile.fetch(creatorProfilePda);

    assert.equal(creatorProfile.authority.toBase58(), creator.publicKey.toBase58());
    assert.equal(creatorProfile.isActive, true);
  });

  it("books a slot into escrow", async () => {
    const bookingId = uniqueArray();
    const bookingPda = findBookingPda(program.programId, bookingId);
    const amount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);
    const now = Math.floor(Date.now() / 1000);
    const scheduledEndTime = new anchor.BN(now + 300);

    await program.methods
      .bookSlot(bookingId, fixedArray(11), amount, scheduledEndTime)
      .accounts({
        platform: platformPda,
        creatorProfile: creatorProfilePda,
        bookingEscrow: bookingPda,
        buyer: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const booking = await program.account.bookingEscrow.fetch(bookingPda);

    assert.equal(Buffer.from(booking.bookingId).equals(Buffer.from(bookingId)), true);
    assert.equal(Buffer.from(booking.slotHash).equals(Buffer.from(fixedArray(11))), true);
    assert.equal(booking.buyer.toBase58(), buyer.publicKey.toBase58());
    assert.equal(booking.creator.toBase58(), creator.publicKey.toBase58());
    assert.equal(booking.amount.toString(), amount.toString());
    assert.equal("funded" in booking.status, true);
  });

  it("prevents early release", async () => {
    const bookingId = uniqueArray();
    const bookingPda = findBookingPda(program.programId, bookingId);
    const amount = new anchor.BN(0.2 * LAMPORTS_PER_SOL);
    const now = Math.floor(Date.now() / 1000);

    await program.methods
      .bookSlot(bookingId, fixedArray(12), amount, new anchor.BN(now + 300))
      .accounts({
        platform: platformPda,
        creatorProfile: creatorProfilePda,
        bookingEscrow: bookingPda,
        buyer: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    await expectAnchorError(
      program.methods
        .releaseFunds()
        .accounts({
          platform: platformPda,
          creatorProfile: creatorProfilePda,
          bookingEscrow: bookingPda,
          authority: creator.publicKey,
          buyer: buyer.publicKey,
        })
        .signers([creator])
        .rpc(),
      "The booking has not ended yet"
    );
  });

  it("releases funds after the meeting time has passed", async () => {
    const bookingId = uniqueArray();
    const bookingPda = findBookingPda(program.programId, bookingId);
    const amount = new anchor.BN(0.25 * LAMPORTS_PER_SOL);
    const now = Math.floor(Date.now() / 1000);
    const creatorBalanceBefore = await provider.connection.getBalance(creator.publicKey);

    await program.methods
      .bookSlot(bookingId, fixedArray(33), amount, new anchor.BN(now + 2))
      .accounts({
        platform: platformPda,
        creatorProfile: creatorProfilePda,
        bookingEscrow: bookingPda,
        buyer: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    await new Promise((resolve) => setTimeout(resolve, 2500));

    await program.methods
      .releaseFunds()
      .accounts({
        platform: platformPda,
        creatorProfile: creatorProfilePda,
        bookingEscrow: bookingPda,
        authority: creator.publicKey,
        buyer: buyer.publicKey,
      })
      .signers([creator])
      .rpc();

    const creatorBalanceAfter = await provider.connection.getBalance(creator.publicKey);
    assert.equal(creatorBalanceAfter > creatorBalanceBefore, true);

    await assert.rejects(program.account.bookingEscrow.fetch(bookingPda));
  });

  it("refunds a funded booking", async () => {
    const bookingId = uniqueArray();
    const bookingPda = findBookingPda(program.programId, bookingId);
    const amount = new anchor.BN(0.4 * LAMPORTS_PER_SOL);
    const now = Math.floor(Date.now() / 1000);
    const refundBuyerBalanceBefore = await provider.connection.getBalance(refundBuyer.publicKey);

    await program.methods
      .bookSlot(bookingId, fixedArray(22), amount, new anchor.BN(now + 300))
      .accounts({
        platform: platformPda,
        creatorProfile: creatorProfilePda,
        bookingEscrow: bookingPda,
        buyer: refundBuyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([refundBuyer])
      .rpc();

    const refundBuyerBalanceAfterBooking = await provider.connection.getBalance(
      refundBuyer.publicKey
    );

    await program.methods
      .refundBooking()
      .accounts({
        platform: platformPda,
        creatorProfile: creatorProfilePda,
        bookingEscrow: bookingPda,
        signer: creator.publicKey,
        buyer: refundBuyer.publicKey,
      })
      .signers([creator])
      .rpc();

    const refundBuyerBalanceAfter = await provider.connection.getBalance(refundBuyer.publicKey);
    assert.equal(refundBuyerBalanceAfter > refundBuyerBalanceAfterBooking, true);

    await assert.rejects(program.account.bookingEscrow.fetch(bookingPda));
  });
});
