import { NextResponse } from "next/server";

import { decrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { listSlackChannels } from "@/lib/slack/client";
import { requireAdmin } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    const previewToken = new URL(request.url).searchParams.get("accessToken");

    let accessToken = previewToken?.trim();

    if (!accessToken) {
      const integration = await prisma.integration.findUnique({
        where: {
          agencyId_provider: {
            agencyId: user.agencyId,
            provider: "SLACK",
          },
        },
      });

      if (!integration?.accessToken || integration.status !== "CONNECTED") {
        return NextResponse.json({ error: "Slack is not connected" }, { status: 404 });
      }

      accessToken = decrypt(integration.accessToken);
    }

    const result = await listSlackChannels(accessToken);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ channels: result.channels });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
