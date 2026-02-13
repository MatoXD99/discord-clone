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

type JsonRecord = Record<string, unknown>;

const extractTextPreview = (value: string) => {
    const compact = value.replace(/\s+/g, " ").trim();
    return compact.length > 140 ? `${compact.slice(0, 140)}...` : compact;
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        const text = await response.text();
        if (!text) return null;

        try {
            return JSON.parse(text);
        } catch {
            throw new Error("Server returned invalid JSON response");
        }
    }

    const text = await response.text();
    return text;
};

export async function fetchJson<T>(path: string, init: RequestInit, fallbackErrorMessage: string): Promise<T> {
    const response = await fetch(buildApiUrl(path), init);
    const body = await parseResponseBody(response);

    if (!response.ok) {
        if (body && typeof body === "object") {
            const obj = body as JsonRecord;
            const maybeMessage = obj.error || obj.message;
            if (typeof maybeMessage === "string" && maybeMessage.trim()) {
                throw new Error(maybeMessage);
            }
        }

        if (typeof body === "string" && body.trim()) {
            throw new Error(`${fallbackErrorMessage} (${response.status}) - ${extractTextPreview(body)}`);
        }

        throw new Error(`${fallbackErrorMessage} (${response.status})`);
    }

    if (body && typeof body === "object") {
        return body as T;
    }

    throw new Error(`${fallbackErrorMessage}: server did not return JSON`);
}
