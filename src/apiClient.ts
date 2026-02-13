const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");
const PREFERRED_API_BASE_STORAGE_KEY = "preferredApiBaseUrl";

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const explicitApiBaseUrl = rawApiBaseUrl ? trimTrailingSlashes(rawApiBaseUrl) : null;

type JsonRecord = Record<string, unknown>;

type ParsedBody = {
    contentType: string;
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

const storePreferredApiBase = (baseUrl: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PREFERRED_API_BASE_STORAGE_KEY, trimTrailingSlashes(baseUrl));
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

export const getApiBaseCandidates = () => {
    if (typeof window === "undefined") {
        return explicitApiBaseUrl ? [explicitApiBaseUrl] : [];
    }

    const { protocol, hostname, port, origin } = window.location;
    const preferred = readPreferredApiBase();

    const apiSubdomain = hostname.startsWith("api.") ? null : `${protocol}//api.${hostname}${port ? `:${port}` : ""}`;
    const port3001 = port ? null : `${protocol}//${hostname}:3001`;

    if (explicitApiBaseUrl) {
        return unique([explicitApiBaseUrl, preferred]);
    }

    return unique([preferred, origin, apiSubdomain, port3001]);
};

export const API_BASE_URL = explicitApiBaseUrl || readPreferredApiBase() || (typeof window !== "undefined" ? window.location.origin : "");

export const buildApiUrl = (path: string, baseUrl?: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const base = baseUrl || API_BASE_URL;
    return `${base}${normalizedPath}`;
};

const parseResponseBody = async (response: Response): Promise<ParsedBody> => {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        const text = await response.text();
        if (!text) return { contentType, value: null };

        try {
            return { contentType, value: JSON.parse(text) };
        } catch {
            throw new Error("Server returned invalid JSON response");
        }
    }

    const text = await response.text();
    return { contentType, value: text };
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

export const getSocketBaseUrl = () => getApiBaseCandidates()[0] || API_BASE_URL;
