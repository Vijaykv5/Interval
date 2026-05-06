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
}
