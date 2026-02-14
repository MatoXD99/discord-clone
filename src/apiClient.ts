const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");
const PREFERRED_API_BASE_STORAGE_KEY = "preferredApiBaseUrl";
const FORWARDED_SIGNALING_BASE_URL = "https://api.discord.slovenitech.si";

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const explicitApiBaseUrl = rawApiBaseUrl ? trimTrailingSlashes(rawApiBaseUrl) : null;

type JsonRecord = Record<string, unknown>;

type ParsedBody = {
    value: unknown;
};

const extractTextPreview = (value: string) => {
    const compact = value.replace(/\s+/g, " ").trim();
    return compact.length > 140 ? `${compact.slice(0, 140)}...` : compact;
};

const isRetriableStatus = (status: number) => [404, 405, 502, 503, 504].includes(status);

const readPreferredApiBase = () => {
    if (typeof window === "undefined") return null;

    const value = window.localStorage.getItem(PREFERRED_API_BASE_STORAGE_KEY)?.trim();
    return value ? trimTrailingSlashes(value) : null;
};

const normalizeApiBaseUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
        const url = new URL(candidate);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return trimTrailingSlashes(url.origin + url.pathname).replace(/\/$/, "");
    } catch {
        return null;
    }
};

const storePreferredApiBase = (baseUrl: string) => {
    if (typeof window === "undefined") return;
    const normalized = normalizeApiBaseUrl(baseUrl);
    if (!normalized) return;
    window.localStorage.setItem(PREFERRED_API_BASE_STORAGE_KEY, normalized);
};

export const setPreferredApiBaseUrl = (baseUrl: string) => {
    if (typeof window === "undefined") return false;
    const normalized = normalizeApiBaseUrl(baseUrl);
    if (!normalized) return false;
    window.localStorage.setItem(PREFERRED_API_BASE_STORAGE_KEY, normalized);
    return true;
};

export const clearPreferredApiBaseUrl = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(PREFERRED_API_BASE_STORAGE_KEY);
};

const unique = (values: Array<string | null | undefined>) => {
    const seen = new Set<string>();
    const out: string[] = [];

    for (const value of values) {
        if (!value) continue;
        const normalized = trimTrailingSlashes(value);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        out.push(normalized);
    }

    return out;
};

const getApiBaseFromQuery = () => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const queryValue = params.get("apiBase");
    if (!queryValue) return null;
    const normalized = normalizeApiBaseUrl(queryValue);
    if (!normalized) return null;
    window.localStorage.setItem(PREFERRED_API_BASE_STORAGE_KEY, normalized);
    return normalized;
};

export const getApiBaseCandidates = () => {
    if (typeof window === "undefined") {
        return explicitApiBaseUrl ? [explicitApiBaseUrl] : [];
    }

    const { protocol, hostname, port, origin } = window.location;
    const queryApiBase = getApiBaseFromQuery();
    const preferred = readPreferredApiBase();

    const apiSubdomain = hostname.startsWith("api.") ? null : `${protocol}//api.${hostname}${port ? `:${port}` : ""}`;
    const port3001 = port ? null : `${protocol}//${hostname}:3001`;

    if (explicitApiBaseUrl) {
        return unique([explicitApiBaseUrl, queryApiBase, preferred, FORWARDED_SIGNALING_BASE_URL]);
    }

    return unique([queryApiBase, preferred, FORWARDED_SIGNALING_BASE_URL, origin, apiSubdomain, port3001]);
};

export const API_BASE_URL = explicitApiBaseUrl || readPreferredApiBase() || (typeof window !== "undefined" ? window.location.origin : "");

export const getCurrentApiBaseUrl = () => getApiBaseCandidates()[0] || API_BASE_URL;

export const buildApiUrl = (path: string, baseUrl?: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const base = baseUrl || getCurrentApiBaseUrl();
    return `${base}${normalizedPath}`;
};

const parseResponseBody = async (response: Response): Promise<ParsedBody> => {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        const text = await response.text();
        if (!text) return { value: null };

        try {
            return { value: JSON.parse(text) };
        } catch {
            throw new Error("Server returned invalid JSON response");
        }
    }

    const text = await response.text();
    return { value: text };
};

export async function fetchJson<T>(path: string, init: RequestInit, fallbackErrorMessage: string): Promise<T> {
    const candidates = getApiBaseCandidates();
    if (candidates.length === 0) {
        throw new Error("No API base URL candidates available");
    }

    let lastError: Error | null = null;
    const attempts: string[] = [];

    for (const baseUrl of candidates) {
        const url = buildApiUrl(path, baseUrl);
        attempts.push(url);

        let response: Response;
        try {
            response = await fetch(url, init);
        } catch (error) {
            const message = error instanceof Error ? error.message : fallbackErrorMessage;
            lastError = new Error(message);
            continue;
        }

        let body: ParsedBody;
        try {
            body = await parseResponseBody(response);
        } catch (error) {
            const message = error instanceof Error ? error.message : fallbackErrorMessage;
            lastError = new Error(message);
            continue;
        }

        if (response.ok) {
            storePreferredApiBase(baseUrl);

            if (body.value && typeof body.value === "object") {
                return body.value as T;
            }

            throw new Error(`${fallbackErrorMessage}: server did not return JSON`);
        }

        if (body.value && typeof body.value === "object") {
            const obj = body.value as JsonRecord;
            const maybeMessage = obj.error || obj.message;
            if (typeof maybeMessage === "string" && maybeMessage.trim()) {
                lastError = new Error(maybeMessage);
            } else {
                lastError = new Error(`${fallbackErrorMessage} (${response.status})`);
            }
        } else if (typeof body.value === "string" && body.value.trim()) {
            lastError = new Error(`${fallbackErrorMessage} (${response.status}) - ${extractTextPreview(body.value)}`);
        } else {
            lastError = new Error(`${fallbackErrorMessage} (${response.status})`);
        }

        if (!isRetriableStatus(response.status)) {
            throw lastError;
        }
    }

    const attempted = attempts.join(", ");
    const reason = lastError?.message || fallbackErrorMessage;
    throw new Error(`${reason}. Tried: ${attempted}`);
}

export const getSocketBaseUrl = () => {
    const explicitSocketBase = import.meta.env.VITE_SOCKET_BASE_URL?.trim();
    if (explicitSocketBase) return trimTrailingSlashes(explicitSocketBase);

    const candidates = getApiBaseCandidates();
    if (candidates.includes(FORWARDED_SIGNALING_BASE_URL)) return FORWARDED_SIGNALING_BASE_URL;

    return FORWARDED_SIGNALING_BASE_URL || candidates[0] || getCurrentApiBaseUrl();
};

const isPrivateHost = (hostname: string) => {
    const lower = hostname.toLowerCase();
    if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") return true;
    return /^10\./.test(lower)
        || /^192\.168\./.test(lower)
        || /^172\.(1[6-9]|2\d|3[01])\./.test(lower);
};

export const resolveMediaUrl = (value?: string | null) => {
    if (!value) return "";

    const mediaUrl = value.trim();
    if (!mediaUrl) return "";

    const apiBase = getCurrentApiBaseUrl();

    if (mediaUrl.startsWith("/")) {
        return `${trimTrailingSlashes(apiBase)}${mediaUrl}`;
    }

    try {
        const parsed = new URL(mediaUrl);
        const apiUrl = new URL(apiBase);

        if (isPrivateHost(parsed.hostname)) {
            return `${apiUrl.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
        }

        if (typeof window !== "undefined" && window.location.protocol === "https:" && parsed.protocol === "http:") {
            parsed.protocol = "https:";
            return parsed.toString();
        }

        return parsed.toString();
    } catch {
        return mediaUrl;
    }
};
