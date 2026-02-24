import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface MetricsPayload {
  speech_metrics?: {
    words_per_minute?: number;
    filler_word_rate?: number;
  };
  visual_signals?: {
    eye_contact_percentage?: number;
    posture_score?: number;
  };
}

function parseDate(value?: string) {
  if (!value) {
    return new Date();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
}

function readNumbers(metrics?: MetricsPayload) {
  return {
    averageWpm: metrics?.speech_metrics?.words_per_minute ?? null,
    fillerWordRate: metrics?.speech_metrics?.filler_word_rate ?? null,
    eyeContactAverage: metrics?.visual_signals?.eye_contact_percentage ?? null,
    postureScore: metrics?.visual_signals?.posture_score ?? null
  };
}

export async function GET() {
  const sessions = await prisma.sessionRecord.findMany({
    orderBy: { startedAt: "desc" },
    take: 50
  });

  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const sessionId = String(body.sessionId ?? "");

  if (!action || !sessionId) {
    return NextResponse.json({ error: "Missing action or sessionId" }, { status: 400 });
  }

  if (action === "start") {
    const startedAt = parseDate(body.startedAt ? String(body.startedAt) : undefined);
    const exerciseType = String(body.exerciseType ?? "free_talk");

    const session = await prisma.sessionRecord.upsert({
      where: { id: sessionId },
      update: {
        startedAt,
        exerciseType
      },
      create: {
        id: sessionId,
        startedAt,
        exerciseType
      }
    });

    return NextResponse.json({ session });
  }

  if (action === "metric") {
    const occurredAt = parseDate(body.occurredAt ? String(body.occurredAt) : undefined);
    const metrics = (body.metrics ?? undefined) as MetricsPayload | undefined;
    const values = readNumbers(metrics);

    await prisma.sessionRecord.upsert({
      where: { id: sessionId },
      update: {},
      create: {
        id: sessionId,
        exerciseType: "free_talk",
        startedAt: occurredAt
      }
    });

    const metric = await prisma.sessionMetric.create({
      data: {
        sessionId,
        occurredAt,
        wordsPerMin: values.averageWpm,
        fillerRate: values.fillerWordRate,
        eyeContactPct: values.eyeContactAverage,
        postureScore: values.postureScore,
        payload: metrics ? JSON.stringify(metrics) : null
      }
    });

    return NextResponse.json({ metric });
  }

  if (action === "end") {
    const endedAt = parseDate(body.endedAt ? String(body.endedAt) : undefined);
    const notes = body.notes ? String(body.notes) : null;
    const metrics = (body.metrics ?? undefined) as MetricsPayload | undefined;
    const values = readNumbers(metrics);

    const aggregate = await prisma.sessionMetric.aggregate({
      where: {
        sessionId
      },
      _avg: {
        wordsPerMin: true,
        fillerRate: true,
        eyeContactPct: true
      }
    });

    const session = await prisma.sessionRecord.upsert({
      where: { id: sessionId },
      update: {
        endedAt,
        notes,
        averageWpm: aggregate._avg.wordsPerMin ?? values.averageWpm,
        fillerWordRate: aggregate._avg.fillerRate ?? values.fillerWordRate,
        eyeContactAverage: aggregate._avg.eyeContactPct ?? values.eyeContactAverage
      },
      create: {
        id: sessionId,
        startedAt: endedAt,
        endedAt,
        exerciseType: "free_talk",
        notes,
        averageWpm: values.averageWpm,
        fillerWordRate: values.fillerWordRate,
        eyeContactAverage: values.eyeContactAverage
      }
    });

    return NextResponse.json({ session });
  }

  return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
}
