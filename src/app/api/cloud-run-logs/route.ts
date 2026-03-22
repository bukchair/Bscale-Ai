import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';

const CLOUD_RUN_SERVICE = process.env.CLOUD_RUN_SERVICE_NAME || 'bscale';
const CLOUD_RUN_REGION = process.env.CLOUD_RUN_REGION || 'europe-west1';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';

function sanitizeFilterFragment(value: string) {
  return value.replace(/["\\]/g, '');
}

async function getAccessToken(): Promise<string> {
  // In Cloud Run, use the metadata server for ADC token
  const metadataRes = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } }
  );
  if (!metadataRes.ok) {
    throw new Error('Failed to get access token from metadata server. Is this running on Cloud Run?');
  }
  const { access_token } = await metadataRes.json();
  return access_token as string;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    if (user.role !== 'admin') {
      return NextResponse.json({ message: 'Admin access required.' }, { status: 403 });
    }

    if (!PROJECT_ID) {
      return NextResponse.json(
        { message: 'GOOGLE_CLOUD_PROJECT environment variable is not set.' },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const severity = url.searchParams.get('severity') || '';
    const search = url.searchParams.get('search') || '';
    const userEmail = (url.searchParams.get('userEmail') || '').trim();
    const errorsOnly =
      url.searchParams.get('errorsOnly') === '1' || url.searchParams.get('errorsOnly') === 'true';
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '100', 10), 500);
    const pageToken = url.searchParams.get('pageToken') || undefined;

    let filter = `resource.type="cloud_run_revision" resource.labels.service_name="${CLOUD_RUN_SERVICE}" resource.labels.location="${CLOUD_RUN_REGION}"`;
    if (errorsOnly) {
      filter += ' severity>=ERROR';
    } else if (severity) {
      filter += ` severity=${severity}`;
    }
    if (search) {
      const safeSearch = sanitizeFilterFragment(search);
      filter += ` textPayload:"${safeSearch}"`;
    }
    if (userEmail) {
      const safeEmail = sanitizeFilterFragment(userEmail);
      filter += ` (textPayload:"${safeEmail}" OR jsonPayload.userEmail="${safeEmail}" OR jsonPayload.user_email="${safeEmail}")`;
    }

    const accessToken = await getAccessToken();

    const body: Record<string, unknown> = {
      resourceNames: [`projects/${PROJECT_ID}`],
      filter,
      orderBy: 'timestamp desc',
      pageSize,
    };
    if (pageToken) body.pageToken = pageToken;

    const loggingRes = await fetch('https://logging.googleapis.com/v2/entries:list', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!loggingRes.ok) {
      const errText = await loggingRes.text();
      return NextResponse.json(
        { message: `Cloud Logging API error: ${errText}` },
        { status: loggingRes.status }
      );
    }

    const data = await loggingRes.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to fetch Cloud Run logs.' },
      { status: 500 }
    );
  }
}
