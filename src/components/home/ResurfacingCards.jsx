function renderAnimeRow({ base, anilistId, metaTop, metaBottom = "", mediaMap, titleById }) {
  const media = mediaMap.get(Number(anilistId));
  const title = titleById.get(Number(anilistId)) || `#${anilistId}`;
  const poster = media?.coverImage?.large || "";
  return (
    <a
      href={`${base}library/`}
      style={{
        display: "grid",
        gridTemplateColumns: "42px 1fr",
        gap: 8,
        alignItems: "center",
        textDecoration: "none",
        color: "inherit",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 8,
        padding: 6,
        background: "rgba(255,255,255,.02)",
      }}
    >
      {poster ? (
        <img
          src={poster}
          alt={title}
          loading="lazy"
          style={{ width: 42, height: 58, borderRadius: 6, objectFit: "cover" }}
        />
      ) : (
        <div
          aria-hidden
          style={{ width: 42, height: 58, borderRadius: 6, background: "rgba(255,255,255,.14)" }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div className="small" style={{ opacity: 0.82, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {metaTop}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        {metaBottom && (
          <div className="small" style={{ opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {metaBottom}
          </div>
        )}
      </div>
    </a>
  );
}

export default function ResurfacingCards({
  base,
  mediaMap,
  titleById,
  resurfacing,
  onOpenCharacter,
}) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
        <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>최근 기록</div>
          {resurfacing.recentLogs.length === 0 ? (
            <div className="small">아직 기록이 없습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {resurfacing.recentLogs.map((row) => (
                <div key={row.id}>
                  {renderAnimeRow({
                    base,
                    anilistId: row.anilistId,
                    metaTop: `${row.label} · ${row.eventType}`,
                    metaBottom: row.cue || "",
                    mediaMap,
                    titleById,
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>기억 없는 작품</div>
          {resurfacing.missingMemory.length === 0 ? (
            <div className="small">모든 작품에 최소 1개 이상의 기록이 있습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {resurfacing.missingMemory.map((row) => (
                <div key={row.anilistId}>
                  {renderAnimeRow({
                    base,
                    anilistId: row.anilistId,
                    metaTop: "기록 없음",
                    metaBottom: "바로 기록해 보세요",
                    mediaMap,
                    titleById,
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>최근 기록의 대표 캐릭터</div>
          {resurfacing.recentPrimaryCharacters.length === 0 ? (
            <div className="small">대표 캐릭터가 있는 로그를 아직 남기지 않았습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {resurfacing.recentPrimaryCharacters.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onOpenCharacter(row.characterId, row.name, row.image)}
                  style={{ border: "none", background: "transparent", color: "inherit", padding: 0, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "30px 1fr", gap: 8, alignItems: "center" }}>
                    {row.image ? (
                      <img
                        src={row.image}
                        alt={row.name}
                        loading="lazy"
                        style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }}
                      />
                    ) : (
                      <div aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.14)" }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.name} · {titleById.get(Number(row.anilistId)) || `#${row.anilistId}`}
                      </div>
                      <div className="small" style={{ opacity: 0.82, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.label}
                        {row.reasonTag ? ` · ${row.reasonTag}` : ""}
                        {row.cue ? ` · ${row.cue}` : ""}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {resurfacing.repeatedCharacters.length > 0 && (
          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>반복해서 남긴 캐릭터</div>
            <div style={{ display: "grid", gap: 8 }}>
              {resurfacing.repeatedCharacters.map((row) => (
                <button
                  key={row.characterId}
                  type="button"
                  onClick={() => onOpenCharacter(row.characterId, row.name, row.image)}
                  style={{ border: "none", background: "transparent", color: "inherit", padding: 0, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 8, alignItems: "center" }}>
                    {row.image ? (
                      <img
                        src={row.image}
                        alt={row.name}
                        loading="lazy"
                        style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                      />
                    ) : (
                      <div aria-hidden style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.14)" }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.name}
                      </div>
                      <div className="small" style={{ opacity: 0.82 }}>
                        최근 60일 {row.countRecent60}회 · 전체 {row.countTotal}회 · 관련 작품 {row.relatedAnimeCount}개
                        {Number.isFinite(Number(row.topAnimeId))
                          ? ` · 대표 작품 ${titleById.get(Number(row.topAnimeId)) || `#${row.topAnimeId}`}`
                          : ""}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {resurfacing.thisTime.length > 0 && (
          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>이맘때 본 작품</div>
            <div style={{ display: "grid", gap: 6 }}>
              {resurfacing.thisTime.map((row) => (
                <div key={row.id}>
                  {renderAnimeRow({
                    base,
                    anilistId: row.anilistId,
                    metaTop: `${row.label} · ${row.eventType}`,
                    mediaMap,
                    titleById,
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {resurfacing.pinnedHighlights.length > 0 && (
        <section style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: 10, background: "rgba(255,255,255,.03)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>핀 캐릭터</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
            {resurfacing.pinnedHighlights.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenCharacter(p.characterId, p.nameSnapshot, p.imageSnapshot)}
                style={{ border: "none", background: "transparent", color: "inherit", padding: 0, textAlign: "left", cursor: "pointer" }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 8, alignItems: "center" }}>
                  {p.imageSnapshot ? (
                    <img
                      src={p.imageSnapshot}
                      alt={p.nameSnapshot}
                      loading="lazy"
                      style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div aria-hidden style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.14)" }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.nameSnapshot}
                    </div>
                    <div className="small" style={{ opacity: 0.82, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {titleById.get(Number(p.mediaId)) || `#${p.mediaId}`}
                      {p.pinReason ? ` · ${p.pinReason}` : ""}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
