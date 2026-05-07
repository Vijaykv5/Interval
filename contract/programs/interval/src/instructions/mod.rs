use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};

use crate::{
    constants::{BOOKING_SEED, CREATOR_SEED, PLATFORM_SEED, TREASURY_SEED},
    errors::IntervalError,
    state::{BookingEscrow, BookingStatus, CreatorProfile, Platform, Treasury},
};

pub fn initialize_platform(ctx: Context<InitializePlatform>) -> Result<()> {
    let platform = &mut ctx.accounts.platform;
    platform.admin = ctx.accounts.admin.key();
    platform.is_paused = false;
    platform.bump = ctx.bumps.platform;

    Ok(())
}

pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    treasury.bump = ctx.bumps.treasury;

    Ok(())
}

pub fn register_creator(ctx: Context<RegisterCreator>) -> Result<()> {
    let creator_profile = &mut ctx.accounts.creator_profile;
    creator_profile.authority = ctx.accounts.authority.key();
    creator_profile.is_active = true;
    creator_profile.bump = ctx.bumps.creator_profile;

    Ok(())
}

pub fn onboard_creator(ctx: Context<OnboardCreator>, onboarding_amount: u64) -> Result<()> {
    require!(onboarding_amount > 0, IntervalError::InvalidOnboardingAmount);

    let rent_minimum = Rent::get()?.minimum_balance(Treasury::SPACE);
    let treasury_lamports = **ctx.accounts.treasury.to_account_info().lamports.borrow();
    let available_lamports = treasury_lamports.saturating_sub(rent_minimum);
    require!(
        available_lamports >= onboarding_amount,
        IntervalError::InsufficientTreasuryBalance
    );

    let creator_profile = &mut ctx.accounts.creator_profile;
    creator_profile.authority = ctx.accounts.authority.key();
    creator_profile.is_active = true;
    creator_profile.bump = ctx.bumps.creator_profile;

    ctx.accounts.treasury.sub_lamports(onboarding_amount)?;
    ctx.accounts.authority.add_lamports(onboarding_amount)?;

    Ok(())
}

pub fn book_slot(
    ctx: Context<BookSlot>,
    booking_id: [u8; 32],
    slot_hash: [u8; 32],
    amount: u64,
    scheduled_end_time: i64,
) -> Result<()> {
    require!(amount > 0, IntervalError::InvalidBookingAmount);
    require!(
        ctx.accounts.creator_profile.is_active,
        IntervalError::CreatorInactive
    );

    let clock = Clock::get()?;
    require!(
        scheduled_end_time > clock.unix_timestamp,
        IntervalError::InvalidScheduledEndTime
    );

    let booking_escrow = &mut ctx.accounts.booking_escrow;
    booking_escrow.booking_id = booking_id;
    booking_escrow.slot_hash = slot_hash;
    booking_escrow.buyer = ctx.accounts.buyer.key();
    booking_escrow.creator = ctx.accounts.creator_profile.authority;
    booking_escrow.amount = amount;
    booking_escrow.scheduled_end_time = scheduled_end_time;
    booking_escrow.status = BookingStatus::Funded;
    booking_escrow.bump = ctx.bumps.booking_escrow;

    let transfer_accounts = Transfer {
        from: ctx.accounts.buyer.to_account_info(),
        to: ctx.accounts.booking_escrow.to_account_info(),
    };
    let transfer_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        transfer_accounts,
    );
    transfer(transfer_ctx, amount)?;

    Ok(())
}

pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
    let booking_escrow = &mut ctx.accounts.booking_escrow;
    require!(
        booking_escrow.status == BookingStatus::Funded,
        IntervalError::InvalidBookingStatus
    );

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= booking_escrow.scheduled_end_time,
        IntervalError::BookingNotEnded
    );

    booking_escrow.status = BookingStatus::Released;
    booking_escrow.sub_lamports(booking_escrow.amount)?;
    ctx.accounts
        .authority
        .add_lamports(booking_escrow.amount)?;

    Ok(())
}

pub fn refund_booking(ctx: Context<RefundBooking>) -> Result<()> {
    let booking_escrow = &mut ctx.accounts.booking_escrow;
    require!(
        booking_escrow.status == BookingStatus::Funded,
        IntervalError::InvalidBookingStatus
    );

    let signer = ctx.accounts.signer.key();
    require!(
        signer == ctx.accounts.creator_profile.authority || signer == ctx.accounts.platform.admin,
        IntervalError::Unauthorized
    );

    booking_escrow.status = BookingStatus::Refunded;
    booking_escrow.sub_lamports(booking_escrow.amount)?;
    ctx.accounts.buyer.add_lamports(booking_escrow.amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = admin,
        space = Platform::SPACE,
        seeds = [PLATFORM_SEED],
        bump
    )]
    pub platform: Account<'info, Platform>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterCreator<'info> {
    #[account(
        seeds = [PLATFORM_SEED],
        bump = platform.bump,
        constraint = !platform.is_paused @ IntervalError::PlatformPaused
    )]
    pub platform: Account<'info, Platform>,
    #[account(
        init,
        payer = authority,
        space = CreatorProfile::SPACE,
        seeds = [CREATOR_SEED, authority.key().as_ref()],
        bump
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        seeds = [PLATFORM_SEED],
        bump = platform.bump,
        has_one = admin @ IntervalError::Unauthorized
    )]
    pub platform: Account<'info, Platform>,
    #[account(
        init,
        payer = admin,
        space = Treasury::SPACE,
        seeds = [TREASURY_SEED],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OnboardCreator<'info> {
    #[account(
        seeds = [PLATFORM_SEED],
        bump = platform.bump,
        has_one = admin @ IntervalError::Unauthorized,
        constraint = !platform.is_paused @ IntervalError::PlatformPaused
    )]
    pub platform: Account<'info, Platform>,
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    #[account(
        init,
        payer = admin,
        space = CreatorProfile::SPACE,
        seeds = [CREATOR_SEED, authority.key().as_ref()],
        bump
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(booking_id: [u8; 32])]
pub struct BookSlot<'info> {
    #[account(
        seeds = [PLATFORM_SEED],
        bump = platform.bump,
        constraint = !platform.is_paused @ IntervalError::PlatformPaused
    )]
    pub platform: Account<'info, Platform>,
    #[account(
        seeds = [CREATOR_SEED, creator_profile.authority.as_ref()],
        bump = creator_profile.bump
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
    #[account(
        init,
        payer = buyer,
        space = BookingEscrow::SPACE,
        seeds = [BOOKING_SEED, &booking_id],
        bump
    )]
    pub booking_escrow: Account<'info, BookingEscrow>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseFunds<'info> {
    #[account(
        seeds = [PLATFORM_SEED],
        bump = platform.bump,
        constraint = !platform.is_paused @ IntervalError::PlatformPaused
    )]
    pub platform: Account<'info, Platform>,
    #[account(
        seeds = [CREATOR_SEED, authority.key().as_ref()],
        bump = creator_profile.bump,
        has_one = authority @ IntervalError::Unauthorized
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
    #[account(
        mut,
        close = buyer,
        seeds = [BOOKING_SEED, &booking_escrow.booking_id],
        bump = booking_escrow.bump,
        constraint = booking_escrow.creator == authority.key() @ IntervalError::Unauthorized,
        constraint = booking_escrow.buyer == buyer.key() @ IntervalError::Unauthorized
    )]
    pub booking_escrow: Account<'info, BookingEscrow>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub buyer: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct RefundBooking<'info> {
    #[account(seeds = [PLATFORM_SEED], bump = platform.bump)]
    pub platform: Account<'info, Platform>,
    #[account(
        seeds = [CREATOR_SEED, creator_profile.authority.as_ref()],
        bump = creator_profile.bump
    )]
    pub creator_profile: Account<'info, CreatorProfile>,
    #[account(
        mut,
        close = buyer,
        seeds = [BOOKING_SEED, &booking_escrow.booking_id],
        bump = booking_escrow.bump,
        constraint = booking_escrow.creator == creator_profile.authority @ IntervalError::Unauthorized,
        constraint = booking_escrow.buyer == buyer.key() @ IntervalError::Unauthorized
    )]
    pub booking_escrow: Account<'info, BookingEscrow>,
    pub signer: Signer<'info>,
    #[account(mut)]
    pub buyer: SystemAccount<'info>,
}
