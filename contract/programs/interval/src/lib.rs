use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

#[allow(ambiguous_glob_reexports)]
pub use instructions::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod interval {
    use super::*;

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        platform_fee_bps: u16,
    ) -> Result<()> {
        instructions::initialize_platform(ctx, platform_fee_bps)
    }

    pub fn update_platform(
        ctx: Context<UpdatePlatform>,
        platform_fee_bps: u16,
        is_paused: bool,
    ) -> Result<()> {
        instructions::update_platform(ctx, platform_fee_bps, is_paused)
    }

    pub fn register_provider(
        ctx: Context<RegisterProvider>,
        display_name: String,
        bio: String,
        timezone: String,
    ) -> Result<()> {
        instructions::register_provider(ctx, display_name, bio, timezone)
    }

    pub fn update_provider(
        ctx: Context<UpdateProvider>,
        display_name: String,
        bio: String,
        timezone: String,
        is_active: bool,
    ) -> Result<()> {
        instructions::update_provider(ctx, display_name, bio, timezone, is_active)
    }

    pub fn create_service(
        ctx: Context<CreateService>,
        title: String,
        description: String,
        duration_minutes: u16,
        price_lamports: u64,
        cancellation_window_minutes: u16,
    ) -> Result<()> {
        instructions::create_service(
            ctx,
            title,
            description,
            duration_minutes,
            price_lamports,
            cancellation_window_minutes,
        )
    }

    pub fn update_service(
        ctx: Context<UpdateService>,
        title: String,
        description: String,
        duration_minutes: u16,
        price_lamports: u64,
        cancellation_window_minutes: u16,
        is_active: bool,
    ) -> Result<()> {
        instructions::update_service(
            ctx,
            title,
            description,
            duration_minutes,
            price_lamports,
            cancellation_window_minutes,
            is_active,
        )
    }

    pub fn request_booking(
        ctx: Context<RequestBooking>,
        start_ts: i64,
        notes: String,
    ) -> Result<()> {
        instructions::request_booking(ctx, start_ts, notes)
    }

    pub fn confirm_booking(ctx: Context<ProviderMutatesBooking>) -> Result<()> {
        instructions::confirm_booking(ctx)
    }

    pub fn cancel_booking(ctx: Context<CancelBooking>) -> Result<()> {
        instructions::cancel_booking(ctx)
    }

    pub fn complete_booking(ctx: Context<ProviderMutatesBooking>) -> Result<()> {
        instructions::complete_booking(ctx)
    }
}
