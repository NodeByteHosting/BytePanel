import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { SETTINGS_ID } from "@/lib/settings";

export const UPDATE_CHECK_TAG = "update-check";
const REVALIDATE_SECONDS = 60 * 60;

export const REPOS = {
  agent: env.UPDATE_CHECK_AGENT_REPO,
  panel: env.UPDATE_CHECK_PANEL_REPO,
} as const;
export type Component = keyof typeof REPOS;

export const PANEL_BUILD = {
  commit: process.env.BYTEPANEL_COMMIT_SHA || null,
  version: process.env.BYTEPANEL_PANEL_VERSION ?? "0.0.0",
};

export interface CommitInfo {
  sha: string;
  message: string;
  date: string | null;
  url: string;
}

export interface LatestRelease {
  version: string;
  name: string;
  url: string;
  publishedAt: string | null;
  prerelease: boolean;
  commit: CommitInfo;
}

export const getUpdateBeta = async (): Promise<boolean> => {
  const row = await prisma.panelSettings.findUnique({
    select: { updateBeta: true },
    where: { id: SETTINGS_ID },
  });
  return row?.updateBeta ?? false;
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type UpdateStatus = "current" | "outdated" | "ahead" | "unknown";

export const shortSha = (sha: string | null | undefined) =>
  sha ? sha.slice(0, 7) : null;

export const commitUrl = (component: Component, sha: string) =>
  `https://github.com/${REPOS[component]}/commit/${sha}`;

const github = async (path: string, accept = "application/vnd.github+json") => {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: accept,
      ...(env.GITHUB_TOKEN && { Authorization: `Bearer ${env.GITHUB_TOKEN}` }),
      "X-GitHub-Api-Version": "2022-11-28",
    },
    next: { revalidate: REVALIDATE_SECONDS, tags: [UPDATE_CHECK_TAG] },
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        env.GITHUB_TOKEN
          ? "no published release found"
          : "no published release found (private repo? set GITHUB_TOKEN)"
      );
    }
    throw new Error(`GitHub ${res.status} for ${path}`);
  }
  return res;
};

const githubJson = async <T>(path: string): Promise<T> => {
  const res = await github(path);
  return (await res.json()) as T;
};

const toError = (error: unknown) =>
  error instanceof Error ? error.message : "update check failed";

const parse = (v: string) => {
  const [core = "", pre] = v.trim().replace(/^v/u, "").split("-", 2);
  const nums = core.split(".").map((n) => Math.trunc(Number(n)) || 0);
  return { nums: [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0], pre };
};

const comparePre = (a: string | undefined, b: string | undefined) => {
  if (a === b) {
    return 0;
  }
  if (a === undefined) {
    return 1;
  }
  if (b === undefined) {
    return -1;
  }
  return a.localeCompare(b, undefined, { numeric: true });
};

export const compareVersions = (a: string, b: string) => {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0);
    if (diff !== 0) {
      return Math.sign(diff);
    }
  }
  return Math.sign(comparePre(pa.pre, pb.pre));
};

interface GithubRelease {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
}

const fetchRelease = async (
  repo: string,
  beta: boolean
): Promise<GithubRelease> => {
  if (!beta) {
    return githubJson<GithubRelease>(`/repos/${repo}/releases/latest`);
  }
  const releases = await githubJson<GithubRelease[]>(
    `/repos/${repo}/releases?per_page=30`
  );
  const [newest] = releases
    .filter((r) => !r.draft)
    .toSorted((a, b) => compareVersions(b.tag_name, a.tag_name));
  if (!newest) {
    throw new Error("no published release found");
  }
  return newest;
};

export const getLatestRelease = async (
  component: Component,
  { beta = false }: { beta?: boolean } = {}
): Promise<Result<LatestRelease>> => {
  const repo = REPOS[component];
  try {
    const release = await fetchRelease(repo, beta);
    const commit = await githubJson<{
      sha: string;
      html_url: string;
      commit: { message: string; committer?: { date?: string } };
    }>(`/repos/${repo}/commits/${encodeURIComponent(release.tag_name)}`);
    return {
      data: {
        commit: {
          date: commit.commit.committer?.date ?? null,
          message: commit.commit.message.split("\n")[0] ?? "",
          sha: commit.sha,
          url: commit.html_url,
        },
        name: release.name || release.tag_name,
        prerelease: release.prerelease,
        publishedAt: release.published_at,
        url: release.html_url,
        version: release.tag_name.replace(/^v/u, ""),
      },
      ok: true,
    };
  } catch (error) {
    return { error: toError(error), ok: false };
  }
};

export const updateStatus = (
  current: { version: string },
  latest: LatestRelease | null
): UpdateStatus => {
  if (!latest) {
    return "unknown";
  }
  const cmp = compareVersions(current.version, latest.version);
  if (cmp < 0) {
    return "outdated";
  }
  return cmp > 0 ? "ahead" : "current";
};
