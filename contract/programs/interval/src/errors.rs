use anchor_lang::prelude::*;

#[error_code]
pub enum IntervalError {
    #[msg("The platform fee cannot exceed the maximum allowed basis points.")]
    PlatformFeeTooHigh,
    #[msg("The Interval platform is currently paused.")]
    PlatformPaused,
    #[msg("The provider profile is inactive.")]
    ProviderInactive,
    #[msg("The service is inactive.")]
    ServiceInactive,
    #[msg("The display name is too long.")]
    NameTooLong,
    #[msg("The bio is too long.")]
    BioTooLong,
    #[msg("The timezone is too long.")]
    TimezoneTooLong,
    #[msg("The service title is too long.")]
    TitleTooLong,
    #[msg("The service description is too long.")]
    DescriptionTooLong,
    #[msg("The booking notes are too long.")]
    NotesTooLong,
    #[msg("The service duration is invalid.")]
    InvalidDuration,
    #[msg("The cancellation window cannot exceed the service duration.")]
    InvalidCancellationWindow,
    #[msg("The booking must start in the future.")]
    BookingInPast,
    #[msg("The booking window is invalid.")]
    InvalidBookingWindow,
    #[msg("The booking has not ended yet.")]
    BookingNotEnded,
    #[msg("The booking status does not allow this action.")]
    InvalidBookingStatus,
    #[msg("The signer is not authorized to perform this action.")]
    Unauthorized,
    #[msg("The service does not belong to this provider.")]
    InvalidServiceProvider,
    #[msg("The booking does not belong to this provider.")]
    InvalidBookingProvider,
    #[msg("The booking does not belong to this service.")]
    InvalidBookingService,
    #[msg("The cancellation window for this booking has closed.")]
    CancellationWindowClosed,
    #[msg("A checked arithmetic operation overflowed.")]
    ArithmeticOverflow,
}
