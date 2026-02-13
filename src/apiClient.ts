const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

// If VITE_API_BASE_URL is set, use it.
// Otherwise default to same-origin so reverse proxies work in production.
export const API_BASE_URL = rawApiBaseUrl
    ? trimTrailingSlashes(rawApiBaseUrl)
    : window.location.origin;

export const buildApiUrl = (path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
};
