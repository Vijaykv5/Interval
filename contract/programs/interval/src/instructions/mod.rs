use anchor_lang::prelude::*;

use crate::{
    constants::{
        MAX_BIO_LEN, MAX_DESCRIPTION_LEN, MAX_DISPLAY_NAME_LEN, MAX_DURATION_MINUTES,
        MAX_NOTES_LEN, MAX_PLATFORM_FEE_BPS, MAX_TIMEZONE_LEN, MAX_TITLE_LEN,
    },
    errors::IntervalError,
    state::{Booking, BookingStatus, Platform, Provider, Service},
};

pub fn initialize_platform(ctx: Context<InitializePlatform>, platform_fee_bps: u16) -> Result<()> {
    require!(
        platform_fee_bps <= MAX_PLATFORM_FEE_BPS,
        IntervalError::PlatformFeeTooHigh
    );

    let platform = &mut ctx.accounts.platform;
    platform.admin = ctx.accounts.admin.key();
    platform.platform_fee_bps = platform_fee_bps;
    platform.is_paused = false;
    platform.bump = ctx.bumps.platform;

    Ok(())
}

pub fn update_platform(
    ctx: Context<UpdatePlatform>,
    platform_fee_bps: u16,
    is_paused: bool,
) -> Result<()> {
    require!(
        platform_fee_bps <= MAX_PLATFORM_FEE_BPS,
        IntervalError::PlatformFeeTooHigh
    );

    let platform = &mut ctx.accounts.platform;
    platform.platform_fee_bps = platform_fee_bps;
    platform.is_paused = is_paused;

    Ok(())
}

pub fn register_provider(
    ctx: Context<RegisterProvider>,
    display_name: String,
    bio: String,
    timezone: String,
) -> Result<()> {
    require_string_len(
        &display_name,
        MAX_DISPLAY_NAME_LEN,
        IntervalError::NameTooLong,
    )?;
    require_string_len(&bio, MAX_BIO_LEN, IntervalError::BioTooLong)?;
    require_string_len(&timezone, MAX_TIMEZONE_LEN, IntervalError::TimezoneTooLong)?;

    let provider = &mut ctx.accounts.provider;
    provider.authority = ctx.accounts.authority.key();
    provider.display_name = display_name;
    provider.bio = bio;
    provider.timezone = timezone;
    provider.service_count = 0;
    provider.is_active = true;
    provider.bump = ctx.bumps.provider;

    Ok(())
}

pub fn update_provider(
    ctx: Context<UpdateProvider>,
    display_name: String,
    bio: String,
    timezone: String,
    is_active: bool,
) -> Result<()> {
    require_string_len(
        &display_name,
        MAX_DISPLAY_NAME_LEN,
        IntervalError::NameTooLong,
    )?;
    require_string_len(&bio, MAX_BIO_LEN, IntervalError::BioTooLong)?;
    require_string_len(&timezone, MAX_TIMEZONE_LEN, IntervalError::TimezoneTooLong)?;

    let provider = &mut ctx.accounts.provider;
    provider.display_name = display_name;
    provider.bio = bio;
    provider.timezone = timezone;
    provider.is_active = is_active;

    Ok(())
}

pub fn create_service(
    ctx: Context<CreateService>,
    title: String,
    description: String,
    duration_minutes: u16,
    price_lamports: u64,
    cancellation_window_minutes: u16,
) -> Result<()> {
    require_not_paused(&ctx.accounts.platform)?;
    require!(
        ctx.accounts.provider.is_active,
        IntervalError::ProviderInactive
    );
    validate_service_input(
        &title,
        &description,
        duration_minutes,
        cancellation_window_minutes,
    )?;

    let provider = &mut ctx.accounts.provider;
    let service = &mut ctx.accounts.service;
    let service_id = provider.service_count;

    service.provider = provider.key();
    service.provider_authority = provider.authority;
    service.service_id = service_id;
    service.title = title;
    service.description = description;
    service.duration_minutes = duration_minutes;
    service.price_lamports = price_lamports;
    service.cancellation_window_minutes = cancellation_window_minutes;
    service.is_active = true;
    service.bump = ctx.bumps.service;

    provider.service_count = provider
        .service_count
        .checked_add(1)
        .ok_or(IntervalError::ArithmeticOverflow)?;

    Ok(())
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
    require_not_paused(&ctx.accounts.platform)?;
    validate_service_input(
        &title,
        &description,
        duration_minutes,
        cancellation_window_minutes,
    )?;

    let service = &mut ctx.accounts.service;
    service.title = title;
    service.description = description;
    service.duration_minutes = duration_minutes;
    service.price_lamports = price_lamports;
    service.cancellation_window_minutes = cancellation_window_minutes;
    service.is_active = is_active;

    Ok(())
}

pub fn request_booking(ctx: Context<RequestBooking>, start_ts: i64, notes: String) -> Result<()> {
    require_not_paused(&ctx.accounts.platform)?;
    require!(
        ctx.accounts.provider.is_active,
        IntervalError::ProviderInactive
    );
    require!(
        ctx.accounts.service.is_active,
        IntervalError::ServiceInactive
    );
    require_string_len(&notes, MAX_NOTES_LEN, IntervalError::NotesTooLong)?;

    let clock = Clock::get()?;
    let duration_seconds = i64::from(ctx.accounts.service.duration_minutes)
        .checked_mul(60)
        .ok_or(IntervalError::ArithmeticOverflow)?;
    let end_ts = start_ts
        .checked_add(duration_seconds)
        .ok_or(IntervalError::ArithmeticOverflow)?;

    require!(
        start_ts > clock.unix_timestamp,
        IntervalError::BookingInPast
    );
    require!(end_ts > start_ts, IntervalError::InvalidBookingWindow);

    let booking = &mut ctx.accounts.booking;
    booking.client = ctx.accounts.client.key();
    booking.provider = ctx.accounts.provider.key();
    booking.provider_authority = ctx.accounts.provider.authority;
    booking.service = ctx.accounts.service.key();
    booking.start_ts = start_ts;
    booking.end_ts = end_ts;
    booking.price_lamports = ctx.accounts.service.price_lamports;
    booking.status = BookingStatus::Requested;
    booking.notes = notes;
    booking.created_at = clock.unix_timestamp;
    booking.updated_at = clock.unix_timestamp;
    booking.bump = ctx.bumps.booking;

    Ok(())
}

pub fn confirm_booking(ctx: Context<ProviderMutatesBooking>) -> Result<()> {
    require_not_paused(&ctx.accounts.platform)?;

    let booking = &mut ctx.accounts.booking;
    require!(
        booking.status == BookingStatus::Requested,
        IntervalError::InvalidBookingStatus
    );

    booking.status = BookingStatus::Confirmed;
    booking.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}

pub fn cancel_booking(ctx: Context<CancelBooking>) -> Result<()> {
    require_not_paused(&ctx.accounts.platform)?;

    let booking = &mut ctx.accounts.booking;
    require!(
        booking.status == BookingStatus::Requested || booking.status == BookingStatus::Confirmed,
        IntervalError::InvalidBookingStatus
    );

    let signer = ctx.accounts.signer.key();
    let provider_authority = ctx.accounts.provider_authority.key();
    require!(
        signer == booking.client || signer == provider_authority,
        IntervalError::Unauthorized
    );

    if signer == booking.client && booking.status == BookingStatus::Confirmed {
        let clock = Clock::get()?;
        let cancellation_window_seconds =
            i64::from(ctx.accounts.service.cancellation_window_minutes)
                .checked_mul(60)
                .ok_or(IntervalError::ArithmeticOverflow)?;
        let cancellation_cutoff = booking
            .start_ts
            .checked_sub(cancellation_window_seconds)
            .ok_or(IntervalError::ArithmeticOverflow)?;

        require!(
            clock.unix_timestamp <= cancellation_cutoff,
            IntervalError::CancellationWindowClosed
        );
    }

    booking.status = BookingStatus::Cancelled;
    booking.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}

pub fn complete_booking(ctx: Context<ProviderMutatesBooking>) -> Result<()> {
    require_not_paused(&ctx.accounts.platform)?;

    let clock = Clock::get()?;
    let booking = &mut ctx.accounts.booking;
    require!(
        booking.status == BookingStatus::Confirmed,
        IntervalError::InvalidBookingStatus
    );
    require!(
        clock.unix_timestamp >= booking.end_ts,
        IntervalError::BookingNotEnded
    );

    booking.status = BookingStatus::Completed;
    booking.updated_at = clock.unix_timestamp;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = admin,
        space = Platform::SPACE,
        seeds = [b"platform"],
        bump
    )]
    pub platform: Account<'info, Platform>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePlatform<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump,
        has_one = admin @ IntervalError::Unauthorized
    )]
    pub platform: Account<'info, Platform>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterProvider<'info> {
    #[account(
        init,
        payer = authority,
        space = Provider::SPACE,
        seeds = [b"provider", authority.key().as_ref()],
        bump
    )]
    pub provider: Account<'info, Provider>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProvider<'info> {
    #[account(
        mut,
        seeds = [b"provider", authority.key().as_ref()],
        bump = provider.bump,
        has_one = authority @ IntervalError::Unauthorized
    )]
    pub provider: Account<'info, Provider>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateService<'info> {
    #[account(seeds = [b"platform"], bump = platform.bump)]
    pub platform: Account<'info, Platform>,
    #[account(
        mut,
        seeds = [b"provider", authority.key().as_ref()],
        bump = provider.bump,
        has_one = authority @ IntervalError::Unauthorized
    )]
    pub provider: Account<'info, Provider>,
    #[account(
        init,
        payer = authority,
        space = Service::SPACE,
        seeds = [
            b"service",
            provider.key().as_ref(),
            &provider.service_count.to_le_bytes()
        ],
        bump
    )]
    pub service: Account<'info, Service>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateService<'info> {
    #[account(seeds = [b"platform"], bump = platform.bump)]
    pub platform: Account<'info, Platform>,
    #[account(
        seeds = [b"provider", authority.key().as_ref()],
        bump = provider.bump,
        has_one = authority @ IntervalError::Unauthorized
    )]
    pub provider: Account<'info, Provider>,
    #[account(
        mut,
        seeds = [
            b"service",
            provider.key().as_ref(),
            &service.service_id.to_le_bytes()
        ],
        bump = service.bump,
        constraint = service.provider == provider.key() @ IntervalError::InvalidServiceProvider
    )]
    pub service: Account<'info, Service>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(start_ts: i64)]
pub struct RequestBooking<'info> {
    #[account(seeds = [b"platform"], bump = platform.bump)]
    pub platform: Account<'info, Platform>,
    #[account(
        seeds = [b"provider", provider.authority.as_ref()],
        bump = provider.bump
    )]
    pub provider: Account<'info, Provider>,
    #[account(
        seeds = [
            b"service",
            provider.key().as_ref(),
            &service.service_id.to_le_bytes()
        ],
        bump = service.bump,
        constraint = service.provider == provider.key() @ IntervalError::InvalidServiceProvider
    )]
    pub service: Account<'info, Service>,
    #[account(
        init,
        payer = client,
        space = Booking::SPACE,
        seeds = [
            b"booking",
            service.key().as_ref(),
            client.key().as_ref(),
            &start_ts.to_le_bytes()
        ],
        bump
    )]
    pub booking: Account<'info, Booking>,
    #[account(mut)]
    pub client: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProviderMutatesBooking<'info> {
    #[account(seeds = [b"platform"], bump = platform.bump)]
    pub platform: Account<'info, Platform>,
    #[account(
        seeds = [b"provider", provider_authority.key().as_ref()],
        bump = provider.bump,
        constraint = provider.authority == provider_authority.key() @ IntervalError::Unauthorized
    )]
    pub provider: Account<'info, Provider>,
    #[account(
        seeds = [
            b"service",
            provider.key().as_ref(),
            &service.service_id.to_le_bytes()
        ],
        bump = service.bump,
        constraint = service.provider == provider.key() @ IntervalError::InvalidServiceProvider
    )]
    pub service: Account<'info, Service>,
    #[account(
        mut,
        seeds = [
            b"booking",
            service.key().as_ref(),
            booking.client.as_ref(),
            &booking.start_ts.to_le_bytes()
        ],
        bump = booking.bump,
        constraint = booking.provider == provider.key() @ IntervalError::InvalidBookingProvider,
        constraint = booking.service == service.key() @ IntervalError::InvalidBookingService
    )]
    pub booking: Account<'info, Booking>,
    #[account(address = provider.authority @ IntervalError::Unauthorized)]
    pub provider_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelBooking<'info> {
    #[account(seeds = [b"platform"], bump = platform.bump)]
    pub platform: Account<'info, Platform>,
    #[account(
        seeds = [b"provider", provider_authority.key().as_ref()],
        bump = provider.bump
    )]
    pub provider: Account<'info, Provider>,
    #[account(
        seeds = [
            b"service",
            provider.key().as_ref(),
            &service.service_id.to_le_bytes()
        ],
        bump = service.bump,
        constraint = service.provider == provider.key() @ IntervalError::InvalidServiceProvider
    )]
    pub service: Account<'info, Service>,
    #[account(
        mut,
        seeds = [
            b"booking",
            service.key().as_ref(),
            booking.client.as_ref(),
            &booking.start_ts.to_le_bytes()
        ],
        bump = booking.bump,
        constraint = booking.provider == provider.key() @ IntervalError::InvalidBookingProvider,
        constraint = booking.service == service.key() @ IntervalError::InvalidBookingService
    )]
    pub booking: Account<'info, Booking>,
    /// CHECK: This account is only used for key comparison against the booking provider.
    #[account(address = provider.authority @ IntervalError::Unauthorized)]
    pub provider_authority: UncheckedAccount<'info>,
    pub signer: Signer<'info>,
}

fn require_not_paused(platform: &Account<Platform>) -> Result<()> {
    require!(!platform.is_paused, IntervalError::PlatformPaused);
    Ok(())
}

fn require_string_len(value: &str, max_len: usize, error: IntervalError) -> Result<()> {
    if value.as_bytes().len() > max_len {
        return Err(error.into());
    }

    Ok(())
}

fn validate_service_input(
    title: &str,
    description: &str,
    duration_minutes: u16,
    cancellation_window_minutes: u16,
) -> Result<()> {
    require_string_len(title, MAX_TITLE_LEN, IntervalError::TitleTooLong)?;
    require_string_len(
        description,
        MAX_DESCRIPTION_LEN,
        IntervalError::DescriptionTooLong,
    )?;
    require!(
        duration_minutes > 0 && duration_minutes <= MAX_DURATION_MINUTES,
        IntervalError::InvalidDuration
    );
    require!(
        cancellation_window_minutes <= duration_minutes,
        IntervalError::InvalidCancellationWindow
    );

    Ok(())
}
