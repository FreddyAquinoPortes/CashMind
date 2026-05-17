import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
export function formatCurrency(amount, currency = 'DOP', locale = 'es-DO') {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}
export function formatDate(date, locale = 'es-DO') {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(date));
}
