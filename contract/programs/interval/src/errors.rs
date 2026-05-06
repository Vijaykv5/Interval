use anchor_lang::prelude::*;

#[error_code]
pub enum IntervalError {
    #[msg("The Interval platform is currently paused.")]
    PlatformPaused,
    #[msg("The creator profile is inactive.")]
    CreatorInactive,
    #[msg("The booking status does not allow this action.")]
    InvalidBookingStatus,
    #[msg("The booking amount must be greater than zero.")]
    InvalidBookingAmount,
    #[msg("The booking end time must be in the future.")]
    InvalidScheduledEndTime,
    #[msg("The booking has not ended yet.")]
    BookingNotEnded,
    #[msg("The signer is not authorized to perform this action.")]
    Unauthorized,
}
