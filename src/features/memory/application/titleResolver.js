const sourceKey = (candidate) => (
  candidate?.sourceBinding?.externalId
    ? `${candidate.sourceBinding.provider}:${candidate.sourceBinding.externalId}`
    : candidate?.animeId
);

const uniqueAliases = (displayTitle, values) => {
  const seen = new Set([String(displayTitle || "").toLocaleLowerCase("en-US")]);
  return values.flatMap((value) => {
    const text = String(value || "").normalize("NFKC").trim().replace(/\s+/gu, " ");
    const key = text.toLocaleLowerCase("en-US");
    if (!text || seen.has(key)) return [];
    seen.add(key);
    return [text];
  });
};

const HAS_HANGUL = /[ㄱ-ㅎㅏ-ㅣ가-힣]/u;

const mergeCandidates = (localResults, remoteResults, query) => {
  if (remoteResults.length === 0) return structuredClone(localResults);
  const localBySource = new Map(localResults.map((candidate) => [sourceKey(candidate), candidate]));
  const merged = new Map();
  for (const remote of remoteResults) {
    const key = sourceKey(remote);
    const local = localBySource.get(key);
    const preferLocalDisplay = Boolean(
      local && HAS_HANGUL.test(query) && HAS_HANGUL.test(local.displayTitle),
    );
    const displayTitle = preferLocalDisplay ? local.displayTitle : remote.displayTitle;
    merged.set(key, {
      ...structuredClone(remote),
      displayTitle,
      aliases: uniqueAliases(displayTitle, [
        remote.displayTitle,
        ...(remote.aliases || []),
        ...(local ? [local.displayTitle, ...(local.aliases || [])] : []),
      ]),
    });
  }
  return [...merged.values()];
};

export function createCombinedTitleResolver({ localResolver, remoteResolver, remoteTimeoutMs = 2500 }) {
  if (!localResolver || !remoteResolver) throw new TypeError("Local and remote title resolvers are required");
  const timeoutMs = Math.max(1, Number(remoteTimeoutMs) || 2500);

  return Object.freeze({
    async search(query) {
      const normalizedQuery = String(query || "").normalize("NFKC").trim().replace(/\s+/gu, " ");
      if (normalizedQuery.length < 2) return { results: [], remoteStatus: "SKIPPED" };

      const localResults = await localResolver.search(normalizedQuery).catch(() => []);
      const timeoutToken = Symbol("remote-timeout");
      let timeoutId;
      let remoteResults = [];
      let remoteStatus = "READY";
      try {
        const remoteOutcome = await Promise.race([
          remoteResolver.search(normalizedQuery),
          new Promise((resolve) => {
            timeoutId = setTimeout(() => resolve(timeoutToken), timeoutMs);
          }),
        ]);
        if (remoteOutcome === timeoutToken) {
          remoteStatus = "TIMED_OUT";
        } else {
          remoteResults = Array.isArray(remoteOutcome) ? remoteOutcome : [];
        }
      } catch {
        remoteStatus = "UNAVAILABLE";
      } finally {
        clearTimeout(timeoutId);
      }

      return {
        results: mergeCandidates(localResults, remoteResults, normalizedQuery),
        remoteStatus,
      };
    },
    resolveCover(ref) {
      return typeof remoteResolver.resolveCover === "function"
        ? remoteResolver.resolveCover(ref)
        : Promise.resolve(null);
    },
  });
}
