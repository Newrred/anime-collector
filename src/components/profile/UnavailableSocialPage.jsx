import MemoryRouteShell, { useMemoryRouteUi } from "../../features/memory/components/MemoryRouteShell.jsx";

function Content({ base, account }) {
  const { locale } = useMemoryRouteUi();
  const ko = locale === "ko";
  return <section className="page-shell surface-card">
    <h1>{account ? (ko ? "계정 및 데이터" : "Account and data") : (ko ? "공개 프로필" : "Public profile")}</h1>
    <p>{account
      ? (ko ? "로그인과 백업은 데이터 관리에서 확인할 수 있어요." : "Manage sign-in and backups in Data management.")
      : (ko ? "공개 프로필은 아직 제공하지 않습니다." : "Public profiles are not available yet.")}</p>
    <a className="btn" href={`${base}${account ? "data/" : "titles/"}`}>
      {account ? (ko ? "데이터 관리" : "Data management") : (ko ? "내 작품으로" : "My Titles")}
    </a>
  </section>;
}

export default function UnavailableSocialPage({ account = false }) {
  const base = import.meta.env.BASE_URL;
  return <MemoryRouteShell base={base} currentRoute="profile"><Content base={base} account={account} /></MemoryRouteShell>;
}
