use anchor_lang::prelude::*;

use crate::{
    constants::{CREATOR_SEED, PLATFORM_SEED},
    errors::IntervalError,
    state::{CreatorProfile, Platform},
};

pub fn initialize_platform(ctx: Context<InitializePlatform>) -> Result<()> {
    let platform = &mut ctx.accounts.platform;
    platform.admin = ctx.accounts.admin.key();
    platform.is_paused = false;
    platform.bump = ctx.bumps.platform;

    Ok(())
}

pub fn register_creator(ctx: Context<RegisterCreator>) -> Result<()> {
    let creator_profile = &mut ctx.accounts.creator_profile;
    creator_profile.authority = ctx.accounts.authority.key();
    creator_profile.is_active = true;
    creator_profile.bump = ctx.bumps.creator_profile;

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
