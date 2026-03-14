import { prisma } from '@/src/lib/db/prisma';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { BaseGoogleProvider } from '@/src/lib/integrations/providers/google-shared/provider-base';
import type { DiscoveredAccount, ProviderCapability, TestResult } from '@/src/lib/integrations/core/types';
import { ExternalApiError, NoAccountsFoundError, PlatformPermissionError } from '@/src/lib/integrations/core/errors';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

type GmailProfileResponse = {
  emailAddress?: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
};

type GmailListResponse = {
  messages?: Array<{ id?: string; threadId?: string }>;
  resultSizeEstimate?: number;
};

export class GmailProvider extends BaseGoogleProvider {
  readonly platform = 'GMAIL' as const;
  readonly oauthScopes = integrationsEnv.ENABLE_GMAIL_SEND_SCOPE
    ? (['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'] as const)
    : (['https://www.googleapis.com/auth/gmail.readonly'] as const);

  readonly capabilities: readonly ProviderCapability[] = integrationsEnv.ENABLE_GMAIL_SEND_SCOPE
    ? (['ACCOUNT_DISCOVERY', 'REPORTING_TEST', 'TOKEN_REFRESH', 'SEND_EMAIL'] as const)
    : (['ACCOUNT_DISCOVERY', 'REPORTING_TEST', 'TOKEN_REFRESH'] as const);

  private async requestGmail<T>(connectionId: string, path: string, init?: RequestInit): Promise<T> {
    const accessToken = await this.getValidAccessToken(connectionId);
    const response = await fetch(`${GMAIL_API_BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};

    if (!response.ok) {
      if (response.status === 403) {
        throw new PlatformPermissionError('Gmail permission is insufficient.');
      }
      throw new ExternalApiError('Gmail API request failed.', { status: response.status, response: parsed });
    }
    return parsed as T;
  }

  async discoverAccounts(connectionId: string): Promise<DiscoveredAccount[]> {
    const profile = await this.requestGmail<GmailProfileResponse>(connectionId, '/users/me/profile');
    if (!profile.emailAddress) {
      throw new NoAccountsFoundError('No Gmail mailbox is available for this user.');
    }

    return [
      {
        externalAccountId: profile.emailAddress,
        name: profile.emailAddress,
        status: 'active',
        metadata: {
          messagesTotal: profile.messagesTotal ?? 0,
          threadsTotal: profile.threadsTotal ?? 0,
          historyId: profile.historyId ?? null,
        },
      },
    ];
  }

  async testConnection(connectionId: string): Promise<TestResult> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      include: { connectedAccounts: true },
    });
    if (!connection) {
      throw new ExternalApiError('Gmail connection not found.');
    }

    const profile = await this.requestGmail<GmailProfileResponse>(connectionId, '/users/me/profile');
    const recent = await this.requestGmail<GmailListResponse>(
      connectionId,
      '/users/me/messages?maxResults=10&includeSpamTrash=false'
    );

    return {
      ok: true,
      message: 'Gmail connection is valid.',
      summary: {
        emailAddress: profile.emailAddress ?? null,
        messagesTotal: profile.messagesTotal ?? 0,
        threadsTotal: profile.threadsTotal ?? 0,
        recentMessageRefs: (recent.messages ?? []).map((item) => ({
          id: item.id ?? '',
          threadId: item.threadId ?? '',
        })),
      },
    };
  }
}
