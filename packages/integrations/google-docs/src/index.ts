// ---------------------------------------------------------------------------
// Inlined stubs for @/lib/errors
// ---------------------------------------------------------------------------

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ---------------------------------------------------------------------------
// Inlined stubs for @/lib/db/queries
// ---------------------------------------------------------------------------

export type PlatformAccount = {
  id: string;
};

export type BotWithAccount = {
  userId: string;
  platformAccount?: PlatformAccount | null;
};

export type IntegrationAccountWithBot = {
  id: string;
  userId: string;
  platform: string;
  platformAccount?: PlatformAccount | null;
};

type LoadIntegrationCredentialsResult = Record<string, unknown> | null;

function loadIntegrationCredentials<T = Record<string, unknown>>(
  _account: IntegrationAccountWithBot,
): LoadIntegrationCredentialsResult | null {
  // Stub: returns null, actual implementation loads from DB
  return null;
}

async function getIntegrationAccountByPlatform(_options: {
  userId: string;
  platform: string;
}): Promise<IntegrationAccountWithBot | null> {
  // Stub: returns null, actual implementation queries DB
  return null;
}

type UpdateIntegrationAccountOptions = {
  userId: string;
  platformAccountId: string;
  credentials: Record<string, unknown>;
};

async function updateIntegrationAccount(
  _options: UpdateIntegrationAccountOptions,
): Promise<void> {
  // Stub: no-op, actual implementation persists to DB
}

// ---------------------------------------------------------------------------
// Google Docs adapter
// ---------------------------------------------------------------------------

import { google, type docs_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export const GOOGLE_DOCS_SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
] as const;

export type GoogleDocsStoredCredentials = {
  accessToken?: string | null;
  refreshToken?: string | null;
  scope?: string | null;
  tokenType?: string | null;
  expiryDate?: number | null;
};

type DocsClientContext = {
  account: IntegrationAccountWithBot;
  oauth2Client: OAuth2Client;
  storedCredentials: GoogleDocsStoredCredentials;
};

export type GoogleDocSummary = {
  id: string;
  name: string;
  modifiedTime: Date;
  owners: string[];
  webViewLink?: string | null;
};

function resolveCredentialsUpdate(
  previous: GoogleDocsStoredCredentials,
  next: OAuth2Client["credentials"],
): GoogleDocsStoredCredentials {
  return {
    accessToken: next.access_token ?? previous.accessToken ?? null,
    refreshToken: next.refresh_token ?? previous.refreshToken ?? null,
    scope: next.scope ?? previous.scope ?? null,
    tokenType: next.token_type ?? previous.tokenType ?? null,
    expiryDate: next.expiry_date ?? previous.expiryDate ?? null,
  };
}

function credentialsChanged(
  a: GoogleDocsStoredCredentials,
  b: GoogleDocsStoredCredentials,
): boolean {
  return (
    (a.accessToken ?? null) !== (b.accessToken ?? null) ||
    (a.refreshToken ?? null) !== (b.refreshToken ?? null) ||
    (a.scope ?? null) !== (b.scope ?? null) ||
    (a.tokenType ?? null) !== (b.tokenType ?? null) ||
    (a.expiryDate ?? null) !== (b.expiryDate ?? null)
  );
}

async function resolveDocsClient(userId: string): Promise<DocsClientContext> {
  const account = await getIntegrationAccountByPlatform({
    userId,
    platform: "google_docs",
  });

  if (!account) {
    throw new AppError(
      "forbidden:api",
      "Google Docs is not connected. Connect your account to continue.",
    );
  }

  const storedCredentials =
    loadIntegrationCredentials<GoogleDocsStoredCredentials>(account) ?? {};

  const clientId =
    process.env.GOOGLE_DOCS_CLIENT_ID ??
    process.env.GOOGLE_DRIVE_CLIENT_ID ??
    process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_DOCS_CLIENT_SECRET ??
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ??
    process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new AppError(
      "bad_request:api",
      "Google Docs integration is not configured. Please contact support.",
    );
  }

  const refreshToken =
    storedCredentials.refreshToken ?? process.env.GOOGLE_DOCS_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new AppError(
      "forbidden:auth",
      "Google Docs authorization has expired. Reconnect your account to continue.",
    );
  }

  const redirectUri =
    process.env.GOOGLE_DOCS_REDIRECT_URI ??
    process.env.GOOGLE_DRIVE_REDIRECT_URI ??
    "";

  const oauth2Client = new google.auth.OAuth2({
    clientId,
    clientSecret,
    redirectUri,
  });

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: storedCredentials.accessToken ?? undefined,
    scope: storedCredentials.scope ?? undefined,
    token_type: storedCredentials.tokenType ?? undefined,
    expiry_date: storedCredentials.expiryDate ?? undefined,
  });

  return { account, oauth2Client, storedCredentials };
}

async function persistDocsCredentials(context: DocsClientContext) {
  const { oauth2Client, storedCredentials, account } = context;
  const nextCredentials = resolveCredentialsUpdate(
    storedCredentials,
    oauth2Client.credentials,
  );

  if (credentialsChanged(storedCredentials, nextCredentials)) {
    await updateIntegrationAccount({
      userId: account.userId,
      platformAccountId: account.id,
      credentials: nextCredentials,
    });
    context.storedCredentials = nextCredentials;
  }
}

export async function listRecentDocuments({
  userId,
  sinceMs,
  limit = 20,
}: {
  userId: string;
  sinceMs?: number;
  limit?: number;
}): Promise<GoogleDocSummary[]> {
  const context = await resolveDocsClient(userId);

  const drive = google.drive({
    version: "v3",
    auth: context.oauth2Client,
  });

  const qParts = [`mimeType='application/vnd.google-apps.document'`];
  if (sinceMs) {
    qParts.push(`modifiedTime > '${new Date(sinceMs).toISOString()}'`);
  }
  const q = qParts.join(" and ");

  const response = await drive.files.list({
    q,
    orderBy: "modifiedTime desc",
    pageSize: limit,
    fields:
      "files(id,name,modifiedTime,owners(emailAddress,displayName),webViewLink)",
  });

  const files = response.data.files ?? [];
  const results: GoogleDocSummary[] = files
    .map((file: any) => {
      const modified = file.modifiedTime
        ? new Date(file.modifiedTime)
        : new Date();
      const owners =
        file.owners
          ?.map((owner: any) => owner.displayName ?? owner.emailAddress ?? null)
          .filter(Boolean) ?? [];
      return {
        id: file.id ?? "",
        name: file.name ?? "Untitled document",
        modifiedTime: modified,
        owners: owners as string[],
        webViewLink: file.webViewLink ?? null,
      };
    })
    .filter((item: any) => item.id);

  await persistDocsCredentials(context);
  return results;
}

export async function appendToDocument({
  userId,
  documentId,
  text,
}: {
  userId: string;
  documentId: string;
  text: string;
}): Promise<{ updated: boolean }> {
  const context = await resolveDocsClient(userId);
  const docs = google.docs({
    version: "v1",
    auth: context.oauth2Client,
  });

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            endOfSegmentLocation: {},
            text,
          },
        },
      ],
    },
  });

  await persistDocsCredentials(context);
  return { updated: true };
}

export async function fetchDocumentSummary({
  userId,
  documentId,
}: {
  userId: string;
  documentId: string;
}): Promise<{ title: string; body: string }> {
  const context = await resolveDocsClient(userId);
  const docs = google.docs({
    version: "v1",
    auth: context.oauth2Client,
  });

  const response = await docs.documents.get({
    documentId,
  });

  const title = response.data.title ?? "Untitled document";
  const bodyContent = response.data.body?.content ?? [];
  const bodyText = extractPlainText(bodyContent);

  await persistDocsCredentials(context);
  return { title, body: bodyText };
}

function extractPlainText(
  elements: docs_v1.Schema$StructuralElement[],
): string {
  const lines: string[] = [];

  for (const element of elements) {
    if (element.paragraph?.elements) {
      for (const paraEl of element.paragraph.elements) {
        if (paraEl.textRun?.content) {
          lines.push(paraEl.textRun.content);
        }
      }
    }
  }

  return lines.join("");
}
