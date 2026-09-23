import { IconArchiveBox, IconArrowRight, IconBoard, IconBookOpen, IconHome } from "./ui/AppIcons.jsx";

const routes = [
  { path: "", route: "home", label: "home", Icon: IconHome },
  { path: "archive/", route: "archive", label: "archive", Icon: IconArchiveBox },
  { path: "titles/", route: "titles", label: "library", Icon: IconBookOpen },
  { path: "boards/", route: "boards", label: "boards", Icon: IconBoard },
];

export default function PrimaryNavigationLinks({ base, currentRoute, copy, mobile = false, onNavigate }) {
  const activeRoute = ["title", "library"].includes(currentRoute) ? "titles" : currentRoute;
  const linkClass = mobile ? "btn btn--subtle data-menu-link" : "top-nav__link top-nav__link--primary";
  return (
    <div className={mobile ? "top-nav-mobile-links" : "top-nav__links top-nav__links--routes"}>
      {routes.map(({ path, route, label, Icon }) => (
        <a key={route} href={`${base}${path}`} data-astro-reload
          className={`${linkClass}${activeRoute === route ? " is-active" : ""}`}
          aria-current={activeRoute === route ? "page" : undefined} onClick={onNavigate}>
          {mobile ? <><span className="data-menu-action-label"><Icon size={17} /><span>{copy[label]}</span></span><IconArrowRight size={14} /></> : copy[label]}
        </a>
      ))}
    </div>
  );
}
