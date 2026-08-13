import "server-only";

type CachedAccessToken = { value: string; expiresAt: number };

let cachedAccessToken: CachedAccessToken | null = null;

export async function fetchGoogleSheetValues(
  spreadsheetId: string,
  range: string,
): Promise<unknown[][]> {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
  );
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");

  const headers: HeadersInit = { Accept: "application/json" };
  const serviceEmail = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (serviceEmail && privateKey) {
    headers.Authorization = `Bearer ${await getServiceAccountToken(serviceEmail, privateKey)}`;
  } else if (apiKey) {
    url.searchParams.set("key", apiKey);
  } else {
    throw new Error(
      "Импорт Google Sheets ещё не подключён: добавьте сервисный аккаунт или API key в Vercel",
    );
  }

  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      throw new Error(
        "Google Sheets не дал доступ к таблице. Откройте чтение сервисному аккаунту Agency OS",
      );
    }
    throw new Error(`Google Sheets вернул ${response.status}`);
  }
  const payload = await response.json() as { values?: unknown[][] };
  return payload.values ?? [];
}

async function getServiceAccountToken(email: string, encodedPrivateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.value;
  }

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(encodedPrivateKey.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Не удалось авторизовать сервисный аккаунт Google Sheets");
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Google не вернул access token");
  cachedAccessToken = {
    value: payload.access_token,
    expiresAt: now + Math.max(60, Number(payload.expires_in ?? 3600)),
  };
  return payload.access_token;
}

function pemToBytes(value: string): ArrayBuffer {
  const body = value
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

function base64Url(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
