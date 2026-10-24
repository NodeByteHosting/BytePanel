export const MAX_PORTS_PER_REQUEST = 1000;

// Parses "25565, 27015-27020" into a sorted, de-duplicated port list (same
// syntax as Pterodactyl's allocation form). Throws on invalid input.
export const parsePorts = (input: string): number[] => {
  const ports = new Set<number>();
  for (const raw of input.split(/[\s,]+/u)) {
    const part = raw.trim();
    if (!part) {
      continue;
    }
    const match = /^(\d{1,5})(?:-(\d{1,5}))?$/u.exec(part);
    if (!match) {
      throw new Error(`"${part}" is not a port or port range`);
    }
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (start < 1024 || end > 65_535 || end < start) {
      throw new Error(`"${part}" must be within 1024-65535`);
    }
    for (let port = start; port <= end; port += 1) {
      ports.add(port);
      if (ports.size > MAX_PORTS_PER_REQUEST) {
        throw new Error(
          `At most ${MAX_PORTS_PER_REQUEST} ports can be added at once`
        );
      }
    }
  }
  if (ports.size === 0) {
    throw new Error("Enter at least one port");
  }
  return [...ports].toSorted((a, b) => a - b);
};

// Prefers a run of consecutive ports on one IP (many Steam games query
// port+1), falling back to the lowest free ports.
export const pickAllocations = (
  free: { id: string; ip: string; port: number }[],
  count: number
): string[] => {
  for (let start = 0; start + count <= free.length; start += 1) {
    const run = free.slice(start, start + count);
    const consecutive = run.every(
      (a, i) =>
        i === 0 ||
        (a.ip === run[0]?.ip && a.port === (run[i - 1]?.port ?? 0) + 1)
    );
    if (consecutive) {
      return run.map((a) => a.id);
    }
  }
  return free.slice(0, count).map((a) => a.id);
};
