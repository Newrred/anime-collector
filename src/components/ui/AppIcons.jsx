function IconBase({ children, size = 16, strokeWidth = 2, fill = "none" }) {
  return (
    <span
      aria-hidden="true"
      className="ui-icon"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} stroke="currentColor" strokeWidth={strokeWidth}>
        {children}
      </svg>
    </span>
  );
}

function IconChevronDown(props) {
  return (
    <IconBase {...props}>
      <path d="M6 9.5 12 15l6-5.5" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

function IconGear(props) {
  return (
    <IconBase {...props}>
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
    </IconBase>
  );
}

function IconDownload(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </IconBase>
  );
}

function IconUpload(props) {
  return (
    <IconBase {...props}>
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </IconBase>
  );
}

function IconFile(props) {
  return (
    <IconBase {...props}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
    </IconBase>
  );
}

function IconClipboard(props) {
  return (
    <IconBase {...props}>
      <rect x="8" y="4" width="8" height="4" rx="1" />
      <path d="M16 6h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
    </IconBase>
  );
}

function IconMobile(props) {
  return (
    <IconBase {...props}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </IconBase>
  );
}

function IconDatabase(props) {
  return (
    <IconBase {...props}>
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v10c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
      <path d="M5 10c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </IconBase>
  );
}

function IconHelp(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9.4a2.6 2.6 0 0 1 5.2 0c0 1.4-.8 2.1-1.8 2.7-.8.5-1.2.9-1.2 1.7" />
      <circle cx="12" cy="17.2" r="0.8" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

function IconSun(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5" />
      <path d="M12 19v2.5" />
      <path d="m4.9 4.9 1.8 1.8" />
      <path d="m17.3 17.3 1.8 1.8" />
      <path d="M2.5 12H5" />
      <path d="M19 12h2.5" />
      <path d="m4.9 19.1 1.8-1.8" />
      <path d="m17.3 6.7 1.8-1.8" />
    </IconBase>
  );
}

function IconMoon(props) {
  return (
    <IconBase {...props}>
      <path d="M20 14.2A7.8 7.8 0 1 1 9.8 4 6.4 6.4 0 0 0 20 14.2Z" />
    </IconBase>
  );
}

function IconGlobe(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13.5 13.5 0 0 1 0 18" />
      <path d="M12 3a13.5 13.5 0 0 0 0 18" />
    </IconBase>
  );
}

function IconCopy(props) {
  return (
    <IconBase {...props}>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    </IconBase>
  );
}

function IconShare(props) {
  return (
    <IconBase {...props}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 11 7.4-4.4" />
      <path d="m8.2 13 7.4 4.4" />
    </IconBase>
  );
}

function IconImage(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m21 16-4.5-4.5L8 20" />
    </IconBase>
  );
}

function IconPlus(props) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

function IconX(props) {
  return (
    <IconBase {...props}>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </IconBase>
  );
}

function IconShield(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3 5 6v5c0 4.3 2.8 8.3 7 10 4.2-1.7 7-5.7 7-10V6l-7-3Z" />
      <path d="m9.5 12 1.7 1.7L15 10" />
    </IconBase>
  );
}

function IconSortAsc(props) {
  return (
    <IconBase {...props}>
      <path d="M8 17V7" />
      <path d="m5 10 3-3 3 3" />
      <path d="M13 17h6" />
      <path d="M13 12h4" />
      <path d="M13 7h2" />
    </IconBase>
  );
}

function IconSortDesc(props) {
  return (
    <IconBase {...props}>
      <path d="M8 7v10" />
      <path d="m5 14 3 3 3-3" />
      <path d="M13 17h2" />
      <path d="M13 12h4" />
      <path d="M13 7h6" />
    </IconBase>
  );
}

export {
  IconBase,
  IconChevronDown,
  IconClipboard,
  IconCopy,
  IconDatabase,
  IconDownload,
  IconFile,
  IconGear,
  IconGlobe,
  IconHelp,
  IconImage,
  IconMobile,
  IconMoon,
  IconPlus,
  IconShare,
  IconShield,
  IconSortAsc,
  IconSortDesc,
  IconSun,
  IconUpload,
  IconX,
};
