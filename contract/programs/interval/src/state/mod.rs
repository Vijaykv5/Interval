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
