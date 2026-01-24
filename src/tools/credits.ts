/**
 * Credits Tool
 * 
 * Tool for checking credit balance.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { FramlitClient } from '../api/client.js';

export const getCreditsTool: Tool = {
  name: 'framlit_get_credits',
  description: 'Check your current credit balance and plan.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function handleGetCredits(client: FramlitClient) {
  const userInfo = await client.getUserInfo();

  const planInfo = getPlanInfo(userInfo.planTier);
  
  let message = `**Credit Balance**\n\n`;
  message += `Remaining: ${userInfo.creditsRemaining} / ${userInfo.creditsTotal} credits\n`;
  message += `Used: ${userInfo.creditsUsed} credits\n\n`;
  message += `**Plan: ${planInfo.name}**\n`;
  message += `- Max projects: ${userInfo.limits.maxProjects}\n`;
  message += `- Max render duration: ${userInfo.limits.maxRenderDuration}s\n`;
  message += `- Watermark: ${userInfo.limits.hasWatermark ? 'Yes' : 'No'}\n`;

  if (userInfo.creditsRemaining <= 10) {
    message += `\n⚠️ Low credits! Get more at https://framlit.app/pricing`;
  }

  if (userInfo.planTier === 'free' || userInfo.planTier === 'hobby') {
    message += `\n\n💡 Upgrade to Pro for 500 credits/month and no watermark: https://framlit.app/pricing`;
  }

  return {
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
  };
}

function getPlanInfo(tier: string): { name: string } {
  switch (tier) {
    case 'free':
      return { name: 'Free' };
    case 'hobby':
      return { name: 'Hobby' };
    case 'pro':
      return { name: 'Pro' };
    case 'team':
      return { name: 'Team' };
    default:
      return { name: tier };
  }
}
