import { getMessageGroup } from "../../domain/messages.js";
import ShowcaseGrid from "../showcase/ShowcaseGrid.jsx";
import { DEFAULT_SHOWCASE_LAYOUT } from "../../repositories/showcaseRepo.js";

const PREVIEW_LAYOUT = {
  ...DEFAULT_SHOWCASE_LAYOUT,
  widgets: DEFAULT_SHOWCASE_LAYOUT.widgets.filter((row) =>
    ["tasteFingerprint", "thisTimeCapsule", "genreWordHeatmap"].includes(row.id)
  ),
};

export default function HomeShowcasePreview({ locale = "ko", base = "/", model }) {
  const copy = getMessageGroup(locale, "homeShowcasePreview");

  return (
    <section className="surface-card ui-panel-stack">
      <div className="showcase-preview-head">
        <div className="pageHeader showcase-preview-head__copy">
          <h2 className="sectionTitle">{copy.title}</h2>
          <p className="sectionLead">{copy.lead}</p>
        </div>
        <a href={`${base}profile/`} className="btn btn--subtle">
          {copy.cta}
        </a>
      </div>

      <ShowcaseGrid locale={locale} model={model} layout={PREVIEW_LAYOUT} compact />
    </section>
  );
}
