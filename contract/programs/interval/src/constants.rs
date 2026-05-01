pub const MAX_PLATFORM_FEE_BPS: u16 = 2_500;
pub const MAX_DISPLAY_NAME_LEN: usize = 64;
pub const MAX_BIO_LEN: usize = 280;
pub const MAX_TIMEZONE_LEN: usize = 48;
pub const MAX_TITLE_LEN: usize = 80;
pub const MAX_DESCRIPTION_LEN: usize = 512;
pub const MAX_NOTES_LEN: usize = 512;
pub const MAX_DURATION_MINUTES: u16 = 24 * 60;

pub const fn string_space(max_len: usize) -> usize {
    4 + max_len
}
