import { getMessageGroup } from "../../domain/messages.js";
import { IconArrowRight } from "../ui/AppIcons.jsx";

export default function HomeTierEntryCard({
  locale = "ko",
  base = "/",
  year = new Date().getUTCFullYear(),
  disabled = false,
}) {
  const copy = getMessageGroup(locale, "homeTierEntryCard");

  const href = disabled
    ? `${base}tier/`
    : `${base}tier/?preset=year-current`;

  return (
    <section className="surface-card home-tier-entry-card">
      <div className="home-tier-entry-card__copy">
        <h2 className="sectionTitle">{copy.title}</h2>
        <p className="sectionLead">{copy.lead}</p>
        <div className="small page-feedback">
          {disabled ? copy.empty : `${year}`}
        </div>
      </div>
      <a href={href} className="btn home-tier-entry-card__cta">
        <span className="btn__label">{copy.cta}</span>
        <span className="btn__icon"><IconArrowRight size={16} /></span>
      </a>
    </section>
  );
}
