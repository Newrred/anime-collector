import MemoryVisual from "../../memory/components/MemoryVisual.jsx";
import PrivateMemoryCardPreview from "../../memory/components/PrivateMemoryCardPreview.jsx";
import TitleCover from "./TitleCover.jsx";

export default function TitleMemoryStack({ album, copy, locale }) {
  const memories = (album.previewMemories || []).slice(0, 3);
  return <div className={`title-cover-stack ${memories.length ? "has-memories" : ""}`}>
    <div className="title-cover-stack__backs" aria-hidden="true">
      {memories.map((memory, index) => (
        <PrivateMemoryCardPreview key={memory.card.id} bundle={memory} locale={locale} visual={memory.visual} title={album.displayTitle} missingLabel={copy.missingMemory}>
          {({ visual, missingLabel, elementRef }) => <div ref={elementRef} className="title-cover-stack__memory" data-memory-card-id={memory.card.id} style={{ "--memory-layer": index + 1 }}>
            <MemoryVisual visual={visual} fit="cover" missingLabel={missingLabel} systemCopy={{ fallbackTitle: album.displayTitle, label: copy.systemDesignLabel, footer: copy.systemDesignFooter }} />
          </div>}
        </PrivateMemoryCardPreview>
      ))}
    </div>
    <TitleCover album={album} copy={copy} className="title-cover-stack__front" />
  </div>;
}
