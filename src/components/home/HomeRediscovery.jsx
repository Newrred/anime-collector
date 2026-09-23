import MemoryCardPreview from "../../features/memory/components/MemoryCardPreview.jsx";
import MemoryTitleLink from "../../features/titles/components/MemoryTitleLink.jsx";
import "./home-rediscovery.css";

export default function HomeRediscovery({ groups, base, locale }) {
  if (!groups) return null;
  const ko = locale === "ko";
  const sections = [
    ["recent", ko ? "최근 남긴 기억" : "Recent memories"],
    ["past", ko ? "다시 꺼내볼 기억" : "A memory to revisit"],
    ["sameTitle", ko ? "같은 작품, 다른 날의 기억" : "One title, different days"],
    ["lines", ko ? "남겨둔 한 줄" : "A reflection you left"],
  ];
  return <div className="home-rediscovery">
    {sections.map(([key, heading]) => groups[key]?.length ? <section key={key} aria-labelledby={`rediscovery-${key}`}>
      <h2 id={`rediscovery-${key}`}>{heading}</h2>
      <div className="home-rediscovery__grid">
        {groups[key].map((bundle) => <div key={bundle.card.id}><MemoryCardPreview
          href={`${base}memory/card/?id=${encodeURIComponent(bundle.card.id)}`}
          title={bundle.title.displayTitle} cue={bundle.card.note || ""} visual={bundle.visual}
          badge={bundle.asset.imageType === "CATALOG_COVER" ? (ko ? "공식 표지" : "Official cover") : ""}
          dateLabel={Number.isFinite(Date.parse(bundle.card.createdAt)) ? `${ko ? "기록일" : "Recorded"} · ${new Intl.DateTimeFormat(ko ? "ko-KR" : "en", { dateStyle: "medium" }).format(new Date(bundle.card.createdAt))}` : ""}
          systemCopy={{label: ko ? "시스템 디자인" : "System design", footer: ko ? "MOEMOA · 비공개 기억" : "MOEMOA · Private memory"}}
          visualFit={bundle.asset.imageType === "CATALOG_COVER" ? "contain" : "cover"}
          missingLabel={ko ? "이 기기에서 이미지를 볼 수 없어요" : "Image unavailable on this device"}
        /><MemoryTitleLink bundle={bundle} base={base} label={ko ? "이 작품 보기" : "View this title"} /></div>)}
      </div>
    </section> : null)}
  </div>;
}
