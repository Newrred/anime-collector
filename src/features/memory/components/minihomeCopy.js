const en = {
 invalid: "Enter a public nickname and choose 1–10 published Boards or representative memories.",
 title: "My public home", visitor: "Public home", nickname: "Public nickname", bio: "Public introduction",
 intro: "Choose up to 10 published Boards or one representative memory from each. Public Board updates appear here too; withdrawing a Board removes its display here.",
 empty: "Publish a Board first, then choose what to display here.", boards: "Manage Boards", choose: "Display this Board", whole: "Whole public Board", representative: "Display selection",
 up: "Move up", down: "Move down", more: "Load more Boards", preview: "Preview public home", consent: "I reviewed this public home and agree to publish this version.",
 publish: "Publish public home", cancel: "Back to selection", visit: "Open public home", published: "Your public home is published.",
 withdraw: "Make public home private", confirm: "Make your public home private? Separately published Boards remain public.", revoked: "Your public home is private. Separately published Boards remain public.",
 unavailable: "This public home is unavailable.", noEntries: "No memories are currently on display.", disabled: "Public homes are not available yet.",
 login: "Sign in to choose your public home.", failed: "Could not load this public home. Check your connection and try again.", loading: "Loading…", retry: "Try again",
};
const ko = {
 invalid: "공개 닉네임과 전시할 공개 보드 또는 대표 기억을 1~10개 선택하세요.",
 title: "내 공개 미니홈", visitor: "공개 미니홈", nickname: "공개 닉네임", bio: "공개 소개",
 intro: "공개한 보드 전체 또는 보드별 대표 기억 하나를 최대 10개 선택하세요. 보드의 공개본을 갱신하면 여기에도 반영되고, 보드를 철회하면 해당 전시도 사라집니다.",
 empty: "먼저 보드를 공개한 뒤 미니홈에 전시할 내용을 선택하세요.", boards: "보드 관리", choose: "이 보드 전시", whole: "공개 보드 전체", representative: "전시할 내용",
 up: "위로 이동", down: "아래로 이동", more: "보드 더 보기", preview: "미니홈 미리보기", consent: "이 공개 미니홈을 확인했으며 이 버전을 게시하는 데 동의합니다.",
 publish: "미니홈 게시", cancel: "선택으로 돌아가기", visit: "공개 미니홈 열기", published: "미니홈이 공개되었습니다.",
 withdraw: "미니홈 비공개로 전환", confirm: "미니홈을 비공개로 바꿀까요? 별도로 공개한 보드는 계속 공개됩니다.", revoked: "미니홈이 비공개로 전환되었습니다. 별도로 공개한 보드는 계속 공개됩니다.",
 unavailable: "이 미니홈을 볼 수 없습니다.", noEntries: "현재 전시 중인 기억이 없습니다.", disabled: "공개 미니홈은 아직 사용할 수 없습니다.",
 login: "로그인하고 공개 미니홈을 구성하세요.", failed: "미니홈을 불러오지 못했습니다. 연결을 확인하고 다시 시도하세요.", loading: "불러오고 있어요…", retry: "다시 시도",
};
export const minihomeCopy = (locale) => locale === "ko" ? ko : en;
