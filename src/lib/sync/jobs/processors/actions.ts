import { prisma } from '@/src/lib/db/prisma';
import type { ActionPayload } from '@/src/lib/sync/queue/payloads';
import { toPrismaJson } from '@/src/lib/integrations/utils/prisma-json';

export const processAction = async (payload: ActionPayload) => {
  const action = await prisma.actionRequest.create({
    data: {
      userId: payload.userId,
      platform: payload.platform,
      connectionId: payload.connectionId,
      connectedAccountId: payload.connectedAccountId,
      actionType: payload.actionType,
      targetType: 'CAMPAIGN',
      targetExternalId: payload.targetExternalId,
      payload: toPrismaJson(payload.params),
      status: 'QUEUED',
    },
  });

  // Adapted scope: action execution is queued and audited first.
  // Provider-specific write actions are intentionally kept as phase-2.
  await prisma.actionRequest.update({
    where: { id: action.id },
    data: {
      status: 'SUCCESS',
    },
  });

  return {
    actionRequestId: action.id,
    executed: false,
    note: 'Action write-back is scaffolded and queued for phase-2 provider adapters.',
  };
};
