export type SlackChannel = {
  id: string;
  name: string;
  isPrivate: boolean;
};

type SlackApiResponse = {
  ok: boolean;
  error?: string;
};

async function slackRequest<T extends SlackApiResponse>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`https://slack.com/api/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
      ...init?.headers,
    },
  });

  return response.json() as Promise<T>;
}

export async function validateSlackAccessToken(accessToken: string) {
  const data = await slackRequest<SlackApiResponse & { team?: string }>(
    "auth.test",
    accessToken.trim(),
  );

  if (!data.ok) {
    return {
      success: false as const,
      message: data.error ?? "Invalid Slack token",
    };
  }

  return { success: true as const, team: data.team ?? "Slack Workspace" };
}

export async function listSlackChannels(accessToken: string) {
  const auth = await validateSlackAccessToken(accessToken);
  if (!auth.success) {
    return { success: false as const, message: auth.message };
  }

  const data = await slackRequest<
    SlackApiResponse & {
      channels?: Array<{ id: string; name: string; is_private?: boolean }>;
    }
  >(
    `conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200`,
    accessToken.trim(),
  );

  if (!data.ok) {
    return {
      success: false as const,
      message: data.error ?? "Failed to list Slack channels",
    };
  }

  const channels = (data.channels ?? [])
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      isPrivate: Boolean(channel.is_private),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { success: true as const, channels };
}

export async function validateSlackChannelSelection(
  accessToken: string,
  channelId: string,
) {
  const listed = await listSlackChannels(accessToken);
  if (!listed.success) {
    return { success: false as const, message: listed.message };
  }

  const channel = listed.channels.find((item) => item.id === channelId);
  if (!channel) {
    return {
      success: false as const,
      message: "Selected Slack channel was not found for this token",
    };
  }

  return { success: true as const, channelName: channel.name };
}

export async function sendSlackChannelMessage(input: {
  accessToken: string;
  channelId: string;
  text: string;
}) {
  const data = await slackRequest<SlackApiResponse>("chat.postMessage", input.accessToken, {
    method: "POST",
    body: JSON.stringify({
      channel: input.channelId,
      text: input.text,
      mrkdwn: true,
    }),
  });

  if (!data.ok) {
    return {
      success: false as const,
      message: data.error ?? "Failed to send Slack message",
    };
  }

  return { success: true as const };
}
