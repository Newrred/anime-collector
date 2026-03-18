import { getMessageGroup } from "../../domain/messages.js";
import ShowcaseGrid from "../showcase/ShowcaseGrid.jsx";

const PREVIEW_LAYOUT = {
  version: 2,
  widgets: [
    { id: "characterGravity", enabled: true, size: "wide" },
    { id: "memoryLineShelf", enabled: true, size: "wide" },
    { id: "logDensityCalendar", enabled: true, size: "wide" },
  ],
};

export default function HomeShowcasePreview({ locale = "ko", base = "/", model }) {
  const copy = getMessageGroup(locale, "homeShowcasePreview");

  return (
    <section className="home-section-block">
      <div className="pageHeader">
        <h2 className="sectionTitle home-section-title">{copy.title}</h2>
        <p className="sectionLead">{copy.lead}</p>
      </div>
      <section className="home-showcase-preview surface-card ui-panel-stack">
        <ShowcaseGrid locale={locale} model={model} layout={PREVIEW_LAYOUT} compact />
        <div className="action-row">
          <a href={`${base}profile/`} className="btn btn--subtle">
            {copy.cta}
          </a>
        </div>
      </section>
    </section>
  );
}
