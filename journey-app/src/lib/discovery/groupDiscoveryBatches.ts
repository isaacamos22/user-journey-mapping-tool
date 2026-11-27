export type DiscoveryBatchMeta = {
  id: string;
  label: string;
  createdAt: Date | null;
  requirementIds: string[];
};

const GAP_MS = 120_000;

function parseCreatedAt(value?: string): number {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

export function formatDiscoveryBatchLabel(createdAt: Date | null, index: number): string {
  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    return createdAt.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  return `Generation ${index + 1}`;
}

function clusterLegacy(items: { id: string; createdAt?: string }[]): DiscoveryBatchMeta[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => parseCreatedAt(a.createdAt) - parseCreatedAt(b.createdAt));
  const batches: { ids: string[]; createdAt: Date | null; lastMs: number }[] = [];
  const undated: string[] = [];

  for (const item of sorted) {
    const ms = parseCreatedAt(item.createdAt);
    if (ms <= 0) {
      if (!undated.includes(item.id)) undated.push(item.id);
      continue;
    }
    const last = batches[batches.length - 1];
    if (last && last.lastMs > 0 && ms - last.lastMs <= GAP_MS) {
      if (!last.ids.includes(item.id)) last.ids.push(item.id);
      last.lastMs = ms;
    } else {
      batches.push({ ids: [item.id], createdAt: new Date(ms), lastMs: ms });
    }
  }

  if (undated.length) {
    if (batches.length === 0) {
      batches.push({ ids: undated, createdAt: null, lastMs: 0 });
    } else {
      const last = batches[batches.length - 1]!;
      for (const id of undated) {
        if (!last.ids.includes(id)) last.ids.push(id);
      }
    }
  }

  return batches.map((b, i) => ({
    id: `legacy:${b.ids[0]}`,
    label: formatDiscoveryBatchLabel(b.createdAt, i),
    createdAt: b.createdAt,
    requirementIds: b.ids,
  }));
}

export function groupDiscoveryBatches(
  requirements: { id: string; createdAt?: string; synthesisBatchId?: string | null }[]
): DiscoveryBatchMeta[] {
  const seenReq = new Set<string>();
  const unique = requirements.filter((r) => {
    if (seenReq.has(r.id)) return false;
    seenReq.add(r.id);
    return true;
  });

  const byBatch = new Map<string, { id: string; createdAt?: string }[]>();
  const legacy: { id: string; createdAt?: string }[] = [];

  for (const r of unique) {
    const batchKey = r.synthesisBatchId?.trim();
    if (batchKey) {
      const list = byBatch.get(batchKey) ?? [];
      if (!list.some((x) => x.id === r.id)) list.push({ id: r.id, createdAt: r.createdAt });
      byBatch.set(batchKey, list);
    } else {
      legacy.push({ id: r.id, createdAt: r.createdAt });
    }
  }

  const explicit: DiscoveryBatchMeta[] = Array.from(byBatch.entries()).map(([id, reqs]) => {
    const earliest = reqs.reduce((min, r) => {
      const t = parseCreatedAt(r.createdAt);
      return t > 0 && (min === 0 || t < min) ? t : min;
    }, 0);
    const createdAt = earliest ? new Date(earliest) : null;
    return {
      id,
      label: formatDiscoveryBatchLabel(createdAt, 0),
      createdAt,
      requirementIds: [...new Set(reqs.map((r) => r.id))],
    };
  });

  const merged = [...explicit, ...clusterLegacy(legacy)].sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  );

  const byId = new Map<string, DiscoveryBatchMeta>();
  for (const batch of merged) {
    const existing = byId.get(batch.id);
    if (!existing) {
      byId.set(batch.id, { ...batch, requirementIds: [...new Set(batch.requirementIds)] });
      continue;
    }
    byId.set(batch.id, {
      ...existing,
      requirementIds: [...new Set([...existing.requirementIds, ...batch.requirementIds])],
    });
  }

  return [...byId.values()].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}