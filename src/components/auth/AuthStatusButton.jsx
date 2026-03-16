import { IconCloud, IconRefreshCw, IconUser } from "../ui/AppIcons.jsx";

function toneClass(status) {
  if (status === "conflict") return "is-conflict";
  if (status === "error") return "is-error";
  if (status === "pending") return "is-pending";
  if (status === "synced") return "is-synced";
  return "is-idle";
}

function getInitial(user) {
  const source =
    user?.user_metadata?.name ||
    user?.email ||
    user?.phone ||
    "";
  return String(source || "").trim().slice(0, 1).toUpperCase();
}

export default function AuthStatusButton({ session, status = "disabled", syncing = false, label, onClick }) {
  const initial = getInitial(session?.user);
  const icon = syncing
    ? <IconRefreshCw size={16} />
    : session?.user
      ? (initial || <IconUser size={16} />)
      : <IconCloud size={16} />;

  return (
    <button
      type="button"
      className={`data-menu-trigger auth-trigger ${toneClass(status)}${syncing ? " is-syncing" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <span className="data-menu-trigger-label auth-trigger__avatar" aria-hidden>
        {typeof icon === "string" ? <span className="auth-trigger__initial">{icon}</span> : icon}
      </span>
      <span className={`sync-dot ${toneClass(status)}`} aria-hidden />
    </button>
  );
}
