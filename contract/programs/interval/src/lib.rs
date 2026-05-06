use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

#[allow(ambiguous_glob_reexports)]
pub use instructions::*;

declare_id!("6GfKzK6QZ3xMaRgmvriLwqtSAeMKn9vPvwUwx1z971TY");

#[program]
pub mod interval {
    use super::*;

    pub fn initialize_platform(ctx: Context<InitializePlatform>) -> Result<()> {
        instructions::initialize_platform(ctx)
    }

    pub fn register_creator(ctx: Context<RegisterCreator>) -> Result<()> {
        instructions::register_creator(ctx)
    }

    pub fn book_slot(
        ctx: Context<BookSlot>,
        booking_id: [u8; 32],
        slot_hash: [u8; 32],
        amount: u64,
        scheduled_end_time: i64,
    ) -> Result<()> {
        instructions::book_slot(ctx, booking_id, slot_hash, amount, scheduled_end_time)
    }

    pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
        instructions::release_funds(ctx)
    }

    pub fn refund_booking(ctx: Context<RefundBooking>) -> Result<()> {
        instructions::refund_booking(ctx)
    }
}
