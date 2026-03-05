export const PRO_WHITELIST: Record<string, boolean> = {
    "siddhantjangam33@gmail.com": true,
    "swapnali89narwade@gmail.com": true,
    "siddhantcil590@gmail.com": true,
    "siddhant.jangams@gmail.com": true
};

export function isProEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return !!PRO_WHITELIST[email.toLowerCase()];
}
