use anchor_lang::prelude::*;

#[account]
pub struct Platform {
    pub admin: Pubkey,
    pub is_paused: bool,
    pub bump: u8,
}

impl Platform {
    pub const SPACE: usize = 8 + 32 + 1 + 1;
}

#[account]
pub struct CreatorProfile {
    pub authority: Pubkey,
    pub is_active: bool,
    pub bump: u8,
}

impl CreatorProfile {
    pub const SPACE: usize = 8 + 32 + 1 + 1;
}

#[account]
pub struct BookingEscrow {
    pub booking_id: [u8; 32],
    pub slot_hash: [u8; 32],
    pub buyer: Pubkey,
    pub creator: Pubkey,
    pub amount: u64,
    pub scheduled_end_time: i64,
    pub status: BookingStatus,
    pub bump: u8,
}

impl BookingEscrow {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 32 + 8 + 8 + BookingStatus::SPACE + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BookingStatus {
    Funded,
    Released,
    Refunded,
}

impl BookingStatus {
    pub const SPACE: usize = 1;
}
