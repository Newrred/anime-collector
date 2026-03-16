function ProfileAvatar({ profile, size = 64, className = "" }) {
  const label = String(profile?.displayName || profile?.handle || "?").trim();

  return (
    <div
      className={`profile-avatar profile-avatar--fallback${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {label.slice(0, 1).toUpperCase() || "?"}
    </div>
  );
}

function ProfileMetric({ label, value }) {
  return (
    <div className="metric-card profile-metric-card">
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}</div>
    </div>
  );
}

function ProfilePeopleList({ title, emptyText, people = [], base = "/" }) {
  return (
    <section className="surface-card profile-people-card">
      <div className="pageHeader profile-people-card__header">
        <h2 className="sectionTitle">{title}</h2>
      </div>
      {people.length ? (
        <div className="profile-people-list">
          {people.map((person) => (
            <a
              key={person.userId}
              href={`${base}u/?handle=${encodeURIComponent(person.handle)}`}
              className="profile-person-link"
            >
              <ProfileAvatar profile={person} size={40} />
              <span className="profile-person-copy">
                <span className="profile-person-name">{person.displayName}</span>
                <span className="small profile-person-handle">@{person.handle}</span>
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="small page-feedback">{emptyText}</div>
      )}
    </section>
  );
}

export { ProfileAvatar, ProfileMetric, ProfilePeopleList };
