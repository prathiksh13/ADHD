import {
  ATTENTION_THRESHOLDS,
  type AffectState,
  type AttentionFrame,
  type AttentionState,
} from "@/features/attention/attention-types";

type Point = { x: number; y: number; z?: number };
type BlendshapeCategory = { categoryName?: string; score?: number };

const LEFT_EYE = {
  outer: 33,
  inner: 133,
  upper: 159,
  lower: 145,
  upper2: 158,
  lower2: 153,
  iris: [468, 469, 470, 471, 472],
} as const;

const RIGHT_EYE = {
  outer: 362,
  inner: 263,
  upper: 386,
  lower: 374,
  upper2: 385,
  lower2: 373,
  iris: [473, 474, 475, 476, 477],
} as const;

const BLENDSHAPE_NAMES = [
  "browDownLeft",
  "browDownRight",
  "mouthPressLeft",
  "mouthPressRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "eyeSquintLeft",
  "eyeSquintRight",
  "jawOpen",
  "eyeBlinkLeft",
  "eyeBlinkRight",
] as const;

type BlendshapeName = (typeof BLENDSHAPE_NAMES)[number];

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function distance(left: Point, right: Point): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return Math.hypot(dx, dy);
}

function averagePoint(points: readonly Point[], indexes: readonly number[]): Point {
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;

  for (const index of indexes) {
    const point = points[index];
    if (!point) continue;
    x += point.x;
    y += point.y;
    z += point.z ?? 0;
    count += 1;
  }

  return count > 0 ? { x: x / count, y: y / count, z: z / count } : { x: 0, y: 0, z: 0 };
}

/**
 * EAR uses the same upper/lower eyelid pairs requested by the product spec:
 * [159, 145] and [386, 374], with [158, 153] / [385, 373] as the second pair.
 * The horizontal eye width is the outer/inner corner distance.
 */
export function calculateEyeAspectRatio(points: readonly Point[]): {
  left: number;
  right: number;
  average: number;
} {
  const leftWidth = distance(points[LEFT_EYE.outer], points[LEFT_EYE.inner]);
  const rightWidth = distance(
    points[RIGHT_EYE.outer],
    points[RIGHT_EYE.inner],
  );

  const leftVertical =
    (distance(points[LEFT_EYE.upper], points[LEFT_EYE.lower]) +
      distance(points[LEFT_EYE.upper2], points[LEFT_EYE.lower2])) /
    2;
  const rightVertical =
    (distance(points[RIGHT_EYE.upper], points[RIGHT_EYE.lower]) +
      distance(points[RIGHT_EYE.upper2], points[RIGHT_EYE.lower2])) /
    2;

  const left = leftWidth > 1e-6 ? leftVertical / leftWidth : 0;
  const right = rightWidth > 1e-6 ? rightVertical / rightWidth : 0;

  return { left, right, average: (left + right) / 2 };
}

export function calculateIrisOffset(points: readonly Point[]): {
  horizontal: number;
  vertical: number;
} {
  const leftIris = averagePoint(points, LEFT_EYE.iris);
  const rightIris = averagePoint(points, RIGHT_EYE.iris);
  const leftCenter = averagePoint(points, [LEFT_EYE.outer, LEFT_EYE.inner]);
  const rightCenter = averagePoint(points, [RIGHT_EYE.outer, RIGHT_EYE.inner]);
  const leftWidth = distance(points[LEFT_EYE.outer], points[LEFT_EYE.inner]);
  const rightWidth = distance(points[RIGHT_EYE.outer], points[RIGHT_EYE.inner]);

  const leftVerticalCenter = averagePoint(points, [LEFT_EYE.upper, LEFT_EYE.lower]);
  const rightVerticalCenter = averagePoint(points, [RIGHT_EYE.upper, RIGHT_EYE.lower]);
  const leftHeight = distance(points[LEFT_EYE.upper], points[LEFT_EYE.lower]);
  const rightHeight = distance(points[RIGHT_EYE.upper], points[RIGHT_EYE.lower]);
  // Project onto each eye's local axes: camera/head roll must not become gaze.
  const project = (iris: Point, center: Point, outer: Point, inner: Point, scale: number, vertical: boolean) => {
    const width = distance(outer, inner);
    if (width < 1e-6 || scale < 1e-6) return 0;
    const x = (inner.x - outer.x) / width, y = (inner.y - outer.y) / width;
    return ((iris.x - center.x) * (vertical ? -y : x) + (iris.y - center.y) * (vertical ? x : y)) / (scale / 2);
  };
  const horizontalLeft = project(leftIris, leftCenter, points[33], points[133], leftWidth, false);
  const horizontalRight = project(rightIris, rightCenter, points[362], points[263], rightWidth, false);
  const verticalLeft = project(leftIris, leftVerticalCenter, points[33], points[133], leftHeight, true);
  const verticalRight = project(rightIris, rightVerticalCenter, points[362], points[263], rightHeight, true);

  return {
    horizontal: (horizontalLeft + horizontalRight) / 2,
    vertical: (verticalLeft + verticalRight) / 2,
  };
}

/**
 * Reads the rotation out of MediaPipe's 4x4 facial transformation matrix.
 * MediaPipe serialises MatrixData in column-major order; the third column is
 * the face's forward axis.
 */
export function headPoseFromMatrix(matrix: readonly number[] | undefined): {
  yawDeg: number;
  pitchDeg: number;
} | null {
  if (!matrix || matrix.length < 16 || !matrix.slice(0, 16).every(Number.isFinite)) return null;

  const forwardX = matrix[8];
  const forwardY = matrix[9];
  const forwardZ = matrix[10];
  const planar = Math.hypot(forwardX, forwardZ);

  if (!Number.isFinite(planar) || planar < 1e-6) return null;

  return {
    yawDeg: (Math.atan2(forwardX, forwardZ) * 180) / Math.PI,
    pitchDeg: (Math.atan2(-forwardY, planar) * 180) / Math.PI,
  };
}

/** Landmark fallback used only when the transformation matrix is unavailable. */
export function headPoseFromLandmarks(points: readonly Point[]): {
  yawDeg: number;
  pitchDeg: number;
} {
  const leftOuter = points[33];
  const rightOuter = points[263];
  const nose = points[1];
  const forehead = points[10];
  const chin = points[152];

  if (!leftOuter || !rightOuter || !nose || !forehead || !chin) {
    return { yawDeg: 0, pitchDeg: 0 };
  }

  const eyeMidX = (leftOuter.x + rightOuter.x) / 2;
  const eyeMidY = (leftOuter.y + rightOuter.y) / 2;
  const eyeDistance = Math.abs(rightOuter.x - leftOuter.x) || 1e-6;
  const faceHeight = distance(forehead, chin) || 1e-6;

  return {
    yawDeg: (Math.atan2(nose.x - eyeMidX, eyeDistance / 2) * 180) / Math.PI,
    pitchDeg:
      (Math.atan2(nose.y - eyeMidY, faceHeight / 2) * 180) / Math.PI,
  };
}

export function blendshapeMap(
  categories: readonly BlendshapeCategory[] | undefined,
): Record<BlendshapeName, number> {
  const scores = Object.fromEntries(
    BLENDSHAPE_NAMES.map((name) => [name, 0]),
  ) as Record<BlendshapeName, number>;

  for (const category of categories ?? []) {
    const name = category.categoryName as BlendshapeName | undefined;
    if (name && name in scores) {
      scores[name] = clampUnit(category.score ?? 0);
    }
  }

  return scores;
}

export function buildAttentionFrame(input: {
  aspectRatio?: number;
  landmarks: readonly Point[] | undefined;
  blendshapes: readonly BlendshapeCategory[] | undefined;
  matrix: readonly number[] | undefined;
  performanceNow: number;
  timestamp: string;
}): AttentionFrame {
  const points = input.landmarks ?? [];
  const blendshapes = blendshapeMap(input.blendshapes);
  const facePresent = points.length >= 478 && [1, 10, 33, 133, 152, 159, 145, 263, 362, 386, 374, 468, 473]
    .every((index) => Number.isFinite(points[index]?.x) && Number.isFinite(points[index]?.y));
  // Normalised x/y coordinates have different scales in a 640x480 frame.
  const metricPoints = points.map((p) => ({ ...p, x: p.x * (input.aspectRatio ?? 4 / 3) }));
  const eyeRatios = facePresent ? calculateEyeAspectRatio(metricPoints) : { left: 0, right: 0, average: 0 };
  const ear = eyeRatios.average;
  const iris = facePresent
    ? calculateIrisOffset(metricPoints)
    : { horizontal: 0, vertical: 0 };
  const pose =
    headPoseFromMatrix(input.matrix) ??
    (facePresent ? headPoseFromLandmarks(points) : { yawDeg: 0, pitchDeg: 0 });

  return {
    ear,
    leftEar: eyeRatios.left,
    rightEar: eyeRatios.right,
    blinkLeft: blendshapes.eyeBlinkLeft,
    blinkRight: blendshapes.eyeBlinkRight,
    browDownLeft: blendshapes.browDownLeft,
    browDownRight: blendshapes.browDownRight,
    mouthPressLeft: blendshapes.mouthPressLeft,
    mouthPressRight: blendshapes.mouthPressRight,
    mouthFrownLeft: blendshapes.mouthFrownLeft,
    mouthFrownRight: blendshapes.mouthFrownRight,
    eyeSquintLeft: blendshapes.eyeSquintLeft,
    eyeSquintRight: blendshapes.eyeSquintRight,
    jawOpen: blendshapes.jawOpen,
    yawDeg: pose.yawDeg,
    pitchDeg: pose.pitchDeg,
    irisHorizontal: iris.horizontal,
    irisVertical: iris.vertical,
    facePresent,
    performanceNow: input.performanceNow,
    timestamp: input.timestamp,
  };
}

export function gazeState(frame: AttentionFrame): {
  state: AttentionState;
  irisAverted: boolean;
  reason: string;
} {
  if (!frame.facePresent) {
    return { state: "OFF_SCREEN", irisAverted: false, reason: "face-not-visible" };
  }

  if (Math.abs(frame.yawDeg) > ATTENTION_THRESHOLDS.yawDeg) {
    return { state: "OFF_SCREEN", irisAverted: false, reason: "head-yaw" };
  }

  if (Math.abs(frame.pitchDeg) > ATTENTION_THRESHOLDS.pitchDeg) {
    return { state: "OFF_SCREEN", irisAverted: false, reason: "head-pitch" };
  }

  const irisAverted =
    Math.abs(frame.irisHorizontal) > ATTENTION_THRESHOLDS.irisHorizontal ||
    Math.abs(frame.irisVertical) > ATTENTION_THRESHOLDS.irisVertical;

  return {
    state: irisAverted ? "OFF_SCREEN" : "ON_SCREEN",
    irisAverted,
    reason: irisAverted ? "iris-averted" : "on-target",
  };
}

/** Deliberately descriptive, non-diagnostic UX states. */
export function classifyAffect(
  frame: AttentionFrame,
  drowsy: boolean,
  state: AttentionState,
): AffectState {
  const browDown = (frame.browDownLeft + frame.browDownRight) / 2;
  const mouthPress = (frame.mouthPressLeft + frame.mouthPressRight) / 2;
  const squint = (frame.eyeSquintLeft + frame.eyeSquintRight) / 2;

  if (!frame.facePresent) return "Neutral";

  const frustration = 0.45 * browDown + 0.3 * mouthPress + 0.25 * squint;
  const fatigue =
    0.55 * (drowsy ? 1 : 0) +
    0.25 * frame.jawOpen +
    0.2 * clampUnit((ATTENTION_THRESHOLDS.closedEar - frame.ear) * 4);

  if (drowsy || fatigue >= 0.5) return "Fatigued";
  if (frustration >= 0.36) return "Frustrated";
  if (state === "ON_SCREEN" && frustration < 0.22 && mouthPress < 0.55) {
    return "Engaged";
  }

  return "Neutral";
}

