use anchor_lang::prelude::*;

use crate::constants::{
    string_space, MAX_BIO_LEN, MAX_DESCRIPTION_LEN, MAX_DISPLAY_NAME_LEN, MAX_NOTES_LEN,
    MAX_TIMEZONE_LEN, MAX_TITLE_LEN,
};

#[account]
pub struct Platform {
    pub admin: Pubkey,
    pub platform_fee_bps: u16,
    pub is_paused: bool,
    pub bump: u8,
}

impl Platform {
    pub const SPACE: usize = 8 + 32 + 2 + 1 + 1;
}

#[account]
pub struct Provider {
    pub authority: Pubkey,
    pub service_count: u64,
    pub is_active: bool,
    pub bump: u8,
    pub display_name: String,
    pub bio: String,
    pub timezone: String,
}

impl Provider {
    pub const SPACE: usize = 8
        + 32
        + 8
        + 1
        + 1
        + string_space(MAX_DISPLAY_NAME_LEN)
        + string_space(MAX_BIO_LEN)
        + string_space(MAX_TIMEZONE_LEN);
}

#[account]
pub struct Service {
    pub provider: Pubkey,
    pub provider_authority: Pubkey,
    pub service_id: u64,
    pub duration_minutes: u16,
    pub price_lamports: u64,
    pub cancellation_window_minutes: u16,
    pub is_active: bool,
    pub bump: u8,
    pub title: String,
    pub description: String,
}

impl Service {
    pub const SPACE: usize = 8
        + 32
        + 32
        + 8
        + 2
        + 8
        + 2
        + 1
        + 1
        + string_space(MAX_TITLE_LEN)
        + string_space(MAX_DESCRIPTION_LEN);
}

#[account]
pub struct Booking {
    pub client: Pubkey,
    pub provider: Pubkey,
    pub provider_authority: Pubkey,
    pub service: Pubkey,
    pub start_ts: i64,
    pub end_ts: i64,
    pub price_lamports: u64,
    pub status: BookingStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
    pub notes: String,
}

impl Booking {
    pub const SPACE: usize = 8
        + 32
        + 32
        + 32
        + 32
        + 8
        + 8
        + 8
        + BookingStatus::SPACE
        + 8
        + 8
        + 1
        + string_space(MAX_NOTES_LEN);
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BookingStatus {
    Requested,
    Confirmed,
    Cancelled,
    Completed,
}

impl BookingStatus {
    pub const SPACE: usize = 1;
}
