import {
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
  type FaceLandmarkerResult
} from "@mediapipe/tasks-vision";

export type DetectedExpression = "neutral" | "smiling" | "tense" | "animated";

export interface FaceSignalSample {
  eyeContact: boolean;
  headPose: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  expression: DetectedExpression;
  postureScore: number;
  landmarks: NormalizedLandmark[];
}

const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

function safePoint(landmarks: NormalizedLandmark[], index: number): NormalizedLandmark | null {
  return landmarks[index] ?? null;
}

function distance(a: NormalizedLandmark | null, b: NormalizedLandmark | null): number {
  if (!a || !b) {
    return 0;
  }

  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

export function detectEyeContact(landmarks: NormalizedLandmark[]): boolean {
  const leftIrisCenter = safePoint(landmarks, 468);
  const rightIrisCenter = safePoint(landmarks, 473);
  const leftEyeInner = safePoint(landmarks, 133);
  const leftEyeOuter = safePoint(landmarks, 33);
  const rightEyeInner = safePoint(landmarks, 362);
  const rightEyeOuter = safePoint(landmarks, 263);

  if (!leftIrisCenter || !rightIrisCenter || !leftEyeInner || !leftEyeOuter || !rightEyeInner || !rightEyeOuter) {
    return false;
  }

  const leftDenominator = leftEyeInner.x - leftEyeOuter.x;
  const rightDenominator = rightEyeInner.x - rightEyeOuter.x;

  if (Math.abs(leftDenominator) < 0.001 || Math.abs(rightDenominator) < 0.001) {
    return false;
  }

  const leftRatio = (leftIrisCenter.x - leftEyeOuter.x) / leftDenominator;
  const rightRatio = (rightIrisCenter.x - rightEyeOuter.x) / rightDenominator;
  const avgRatio = (leftRatio + rightRatio) / 2;

  return avgRatio > 0.35 && avgRatio < 0.65;
}

function detectExpression(landmarks: NormalizedLandmark[]): DetectedExpression {
  const mouthLeft = safePoint(landmarks, 61);
  const mouthRight = safePoint(landmarks, 291);
  const mouthTop = safePoint(landmarks, 13);
  const mouthBottom = safePoint(landmarks, 14);
  const browLeft = safePoint(landmarks, 105);
  const browRight = safePoint(landmarks, 334);
  const eyeLeft = safePoint(landmarks, 159);
  const eyeRight = safePoint(landmarks, 386);

  const mouthWidth = distance(mouthLeft, mouthRight);
  const mouthOpen = distance(mouthTop, mouthBottom);
  const browEyeDistance = (distance(browLeft, eyeLeft) + distance(browRight, eyeRight)) / 2;

  if (mouthWidth > 0.085 && mouthOpen > 0.02) {
    return "smiling";
  }

  if (browEyeDistance < 0.03) {
    return "tense";
  }

  if (mouthOpen > 0.055) {
    return "animated";
  }

  return "neutral";
}

function estimateHeadPose(landmarks: NormalizedLandmark[]) {
  const noseTip = safePoint(landmarks, 1);
  const chin = safePoint(landmarks, 152);
  const leftTemple = safePoint(landmarks, 234);
  const rightTemple = safePoint(landmarks, 454);

  if (!noseTip || !chin || !leftTemple || !rightTemple) {
    return {
      pitch: 0,
      yaw: 0,
      roll: 0
    };
  }

  const yaw = (noseTip.x - (leftTemple.x + rightTemple.x) / 2) * 220;
  const pitch = (chin.y - noseTip.y - 0.25) * 200;
  const roll = Math.atan2(rightTemple.y - leftTemple.y, rightTemple.x - leftTemple.x) * (180 / Math.PI);

  return {
    pitch,
    yaw,
    roll
  };
}

function estimatePostureScore(landmarks: NormalizedLandmark[], headPose: { pitch: number; yaw: number; roll: number }) {
  const noseTip = safePoint(landmarks, 1);
  const forehead = safePoint(landmarks, 10);

  if (!noseTip || !forehead) {
    return 0.5;
  }

  const uprightScore = 1 - Math.min(Math.abs(headPose.roll) / 35, 1);
  const pitchScore = 1 - Math.min(Math.abs(headPose.pitch) / 30, 1);
  const centeredScore = 1 - Math.min(Math.abs(noseTip.x - 0.5) * 2.5, 1);
  const foreheadAlignment = 1 - Math.min(Math.abs(forehead.x - noseTip.x) * 4, 1);

  const score = (uprightScore + pitchScore + centeredScore + foreheadAlignment) / 4;
  return Number(Math.max(0, Math.min(1, score)).toFixed(2));
}

export async function createFaceLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: FACE_MODEL_URL,
      delegate: "GPU"
    },
    numFaces: 1,
    outputFaceBlendshapes: false,
    runningMode: "VIDEO"
  });
}

export function runFaceAnalysis(
  faceLandmarker: FaceLandmarker,
  videoElement: HTMLVideoElement,
  nowMs: number
): FaceSignalSample | null {
  const result: FaceLandmarkerResult = faceLandmarker.detectForVideo(videoElement, nowMs);
  const landmarks = result.faceLandmarks?.[0];

  if (!landmarks) {
    return null;
  }

  const eyeContact = detectEyeContact(landmarks);
  const headPose = estimateHeadPose(landmarks);
  const expression = detectExpression(landmarks);
  const postureScore = estimatePostureScore(landmarks, headPose);

  return {
    eyeContact,
    headPose,
    expression,
    postureScore,
    landmarks
  };
}
