import { IconArchiveBox, IconArrowRight, IconBoard, IconBookOpen, IconHome } from "./ui/AppIcons.jsx";

const routes = [
  { path: "", route: "home", label: "home", Icon: IconHome },
  { path: "titles/", route: "titles", label: "library", Icon: IconBookOpen },
  { path: "archive/", route: "archive", label: "archive", Icon: IconArchiveBox },
  { path: "boards/", route: "boards", label: "boards", Icon: IconBoard },
];

export default function PrimaryNavigationLinks({ base, currentRoute, copy, locale = "ko", mobile = false, onNavigate }) {
  const activeRoute = ["title", "library"].includes(currentRoute) ? "titles" : currentRoute;
  const linkClass = mobile ? "btn btn--subtle data-menu-link" : "top-nav__link top-nav__link--primary";
  return (
    <div className={mobile ? "top-nav-mobile-links" : "top-nav__links top-nav__links--routes"}>
      {routes.filter(row => mobile || row.route !== "boards").map(({ path, route, label, Icon }) => (
        <a key={route} href={`${base}${path}`} data-astro-reload
          className={`${linkClass}${activeRoute === route ? " is-active" : ""}`}
          aria-current={activeRoute === route ? "page" : undefined} onClick={onNavigate}>
          {mobile ? <><span className="data-menu-action-label"><Icon size={17} /><span>{route === "home" ? (locale === "ko" ? "컬렉션" : "Collection") : copy[label]}</span></span><IconArrowRight size={14} /></> : ({ home: locale === "ko" ? "컬렉션" : "Collection", titles: locale === "ko" ? "작품" : "Titles", archive: locale === "ko" ? "기억" : "Memories" }[route] || copy[label])}
        </a>
      ))}
    </div>
  );
}
