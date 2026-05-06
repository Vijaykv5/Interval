use anchor_lang::prelude::*;

#[error_code]
pub enum IntervalError {
    #[msg("The Interval platform is currently paused.")]
    PlatformPaused,
    #[msg("The signer is not authorized to perform this action.")]
    Unauthorized,
}
