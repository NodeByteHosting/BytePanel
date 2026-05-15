import { FatalError, sleep } from "workflow";

import {
  stepCompileAgent,
  stepCreateBuilderVm,
  stepCreateSnapshot,
  stepDeleteAgentBlob,
  stepDeleteBuilder,
  stepDeletePreviousSnapshot,
  stepGetBuilderStatus,
  stepGetImageStatus,
  stepMarkFailed,
  stepMarkReady,
  stepNotifySuperAdmins,
  stepReadBuildState,
  stepSaveImageId,
  stepUpdateBuildStatus,
} from "./build-snapshot-steps";

const parsePositiveInt = (
  raw: string | undefined,
  fallback: number
): number => {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// 45 min: covers apt upgrade + Docker install on a fresh Ubuntu 24.04 VM,
// with headroom for slow apt mirrors. Game images are pulled lazily at
// per-server provision time, not baked into the snapshot.
const MAX_BUILD_WAIT_SECONDS = parsePositiveInt(
  process.env.SNAPSHOT_BUILDER_MAX_WAIT_SECONDS,
  45 * 60
);
const BUILD_POLL_SECONDS = parsePositiveInt(
  process.env.SNAPSHOT_BUILDER_POLL_SECONDS,
  15
);
const MAX_SNAPSHOT_WAIT_SECONDS = parsePositiveInt(
  process.env.SNAPSHOT_IMAGE_MAX_WAIT_SECONDS,
  15 * 60
);
const SNAPSHOT_POLL_SECONDS = parsePositiveInt(
  process.env.SNAPSHOT_IMAGE_POLL_SECONDS,
  10
);

const waitForBuilderOff = async (
  providerBuilderId: string,
  userId: string,
  buildId: string
) => {
  const deadline = Date.now() + MAX_BUILD_WAIT_SECONDS * 1000;
  let observedRunning = false;
  while (Date.now() < deadline) {
    const { status } = await stepGetBuilderStatus({
      providerBuilderId,
      userId,
    });
    if (status === "off") {
      return;
    }
    if (status === "unknown") {
      throw new FatalError("Builder VM disappeared mid-build");
    }
    if (status === "running" && !observedRunning) {
      observedRunning = true;
      await stepUpdateBuildStatus({ buildId, status: "installing" });
    }
    await sleep(`${BUILD_POLL_SECONDS}s`);
  }
  throw new FatalError(
    `Builder VM never reached 'off' status within ${MAX_BUILD_WAIT_SECONDS}s ` +
      `(provider id: ${providerBuilderId}). This usually means cloud-init ` +
      `failed before running shutdown. Inspect the VM console or SSH in and ` +
      `check: cloud-init status --long, journalctl -u cloud-init -u cloud-final, ` +
      `and /var/log/cloud-init-output.log`
  );
};

const waitForSnapshotReady = async (
  snapshotImageId: string,
  userId: string
) => {
  const deadline = Date.now() + MAX_SNAPSHOT_WAIT_SECONDS * 1000;
  while (Date.now() < deadline) {
    const { status } = await stepGetImageStatus({
      imageId: snapshotImageId,
      userId,
    });
    if (status === "available") {
      return;
    }
    if (status === "unavailable" || status === "unknown") {
      throw new Error(`Snapshot image entered status '${status}'`);
    }
    await sleep(`${SNAPSHOT_POLL_SECONDS}s`);
  }
  throw new Error("Snapshot never became available (timed out)");
};

const cleanupBuilderVm = async (
  providerBuilderId: string,
  userId: string
): Promise<void> => {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { deleted } = await stepDeleteBuilder({ providerBuilderId, userId });
    if (deleted) {
      return;
    }

    const { status } = await stepGetBuilderStatus({
      providerBuilderId,
      userId,
    });
    if (status === "unknown") {
      return;
    }

    if (attempt < maxAttempts) {
      await sleep(`${BUILD_POLL_SECONDS}s`);
    }
  }

  throw new Error(
    `Builder VM cleanup did not complete for provider id ${providerBuilderId}`
  );
};

export const buildSnapshot = async (input: {
  buildId: string;
  userId: string;
}) => {
  "use workflow";

  const { buildId, userId } = input;

  try {
    const { agentBlobUrl, agentDownloadUrl } = await stepCompileAgent({
      buildId,
    });

    const { providerBuilderId } = await stepCreateBuilderVm({
      agentDownloadUrl,
      buildId,
      userId,
    });

    await waitForBuilderOff(providerBuilderId, userId, buildId);

    await stepUpdateBuildStatus({ buildId, status: "snapshotting" });

    const { snapshotImageId } = await stepCreateSnapshot({
      providerBuilderId,
      userId,
    });

    await waitForSnapshotReady(snapshotImageId, userId);

    const { previousSnapshotId } = await stepSaveImageId({
      buildId,
      snapshotImageId,
      userId,
    });

    await cleanupBuilderVm(providerBuilderId, userId);

    await stepDeletePreviousSnapshot({
      newSnapshotId: snapshotImageId,
      previousSnapshotId,
      userId,
    });

    await stepDeleteAgentBlob({ agentBlobUrl });

    await stepNotifySuperAdmins({
      buildId,
      newSnapshotId: snapshotImageId,
      success: true,
    });

    await stepMarkReady({ buildId });
  } catch (error) {
    // Normalise: the workflow runner may wrap errors in non-standard objects
    // after retry exhaustion — extract the message defensively.
    let baseReason: string;
    if (error instanceof Error) {
      baseReason = error.message || error.constructor.name;
    } else if (error && typeof error === "object" && "message" in error) {
      baseReason =
        String((error as Record<string, unknown>).message) || "Unknown error";
    } else {
      baseReason = String(error) || "Unknown error";
    }
    const state = await stepReadBuildState({ buildId });

    // Leave the builder VM up on failure so the user can SSH in / use the
    // provider's web console to read cloud-init logs. Surface the VM id in
    // the error reason so they know what to delete once they're done.
    const reason = state?.providerBuilderId
      ? `${baseReason} (builder VM left for inspection — id: ${state.providerBuilderId})`
      : baseReason;

    await stepMarkFailed({ buildId, reason });

    await stepNotifySuperAdmins({
      buildId,
      errorReason: reason,
      success: false,
    });

    if (state?.agentBlobUrl) {
      await stepDeleteAgentBlob({ agentBlobUrl: state.agentBlobUrl });
    }

    if (error instanceof FatalError) {
      return;
    }
    throw error;
  }
};
