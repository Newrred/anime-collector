const en = {
  update: "Review and update public content", changed: "Private sources have changed or need checking. Review the selected content before updating the public version.",
  revokeCard: "Stop sharing this memory everywhere", revokeCardConfirm: "Stop sharing this memory in every public Board and display? The private original stays. This action cannot be undone by publishing it again.",
  cardRevoked: "Sharing of this memory has stopped everywhere. The private original is unchanged.",
  start: "Share selected memories", title: "Public Board", intro: "Choose what visitors can see. Your private Board and memories stay unchanged.",
  publicTitle: "Public title", description: "Public description", select: "Include this memory", fields: "Optional details to include",
  included: "The memory title and visual are always included.", preview: "Preview selected memories", previewTitle: "Visitor preview",
  consent: "I have reviewed these memories and agree to publish this version under the current policy.",
  policy: "Policy version", publish: "Publish this version", cancel: "Back to selection", close: "Close sharing",
  published: "This version is published. Private edits will not update it automatically.", visit: "Open visitor page",
  withdraw: "Withdraw this Board", withdrawConfirm: "Withdraw this Board? Other explicitly published Boards may still show these memories. Private originals stay unchanged.",
  revoked: "This Board has been withdrawn.", preparing: "Preparing your preview…", publishing: "Publishing…", loading: "Loading…",
  imageReady: "The selected image copy is ready. Preview the Board before publishing.",
  file: "Select the original image file", imageConsent: "I agree to upload this selected image to prepare a public copy under the current policy.",
  upload: "Prepare selected image", imageHelp: "Choose the original file for this memory. The server checks that it matches and that public use is approved. Other photos stay on your device.",
  imagePolicyMissing: "Image preparation is not available until the publication policy is configured.",
  missing: "Visual unavailable", retry: "Try again", unavailable: "This Board is unavailable.", disabled: "Public Boards are not available yet.",
  failed: "Could not load this Board. Check your connection and try again.", empty: "There are no visible memories in this Board.",
  login: "Sign in and sync this Board before sharing it.", account: "Account and sync", sync: "Sync the selected memories and this Board before previewing. Resolve any pending changes first.",
  details: { note: "Reflection", watchedAt: "Watched date", episode: "Episode", sceneCue: "Scene", emotionTags: "Emotions", rewatchIntent: "Rewatch intent" },
};
const ko = {
  update: "공개 내용 검토·갱신", changed: "비공개 원본이 변경되었거나 확인이 필요합니다. 공개본을 갱신하려면 선택한 내용을 다시 검토하세요.",
  revokeCard: "이 기억 모든 곳에서 공개 중지", revokeCardConfirm: "모든 공개 보드와 전시 위치에서 이 기억의 공개를 중지할까요? 비공개 원본은 유지됩니다. 다시 게시해도 이 중지는 해제되지 않습니다.",
  cardRevoked: "이 기억의 공개를 모든 곳에서 중지했습니다. 비공개 원본은 유지됩니다.",
  start: "선택한 기억 공유", title: "공개 보드", intro: "방문자에게 보여줄 내용을 선택하세요. 비공개 보드와 기억 원본은 그대로 유지됩니다.",
  publicTitle: "공개 제목", description: "공개 설명", select: "이 기억 포함", fields: "함께 공개할 세부 내용",
  included: "기억의 제목과 이미지는 항상 포함됩니다.", preview: "선택한 기억 미리보기", previewTitle: "방문자 미리보기",
  consent: "이 기억들을 확인했으며 현재 정책에 따라 이 버전을 게시하는 데 동의합니다.",
  policy: "정책 버전", publish: "이 버전 게시", cancel: "선택으로 돌아가기", close: "공유 닫기",
  published: "이 버전이 게시되었습니다. 비공개 원본 수정은 자동으로 공개되지 않습니다.", visit: "방문자 화면 열기",
  withdraw: "이 보드 공개 철회", withdrawConfirm: "이 보드의 공개를 철회할까요? 다른 곳에 명시적으로 게시한 보드에서는 이 기억이 계속 보일 수 있습니다. 비공개 원본은 유지됩니다.",
  revoked: "이 보드의 공개를 철회했습니다.", preparing: "미리보기를 준비하고 있어요…", publishing: "게시하고 있어요…", loading: "불러오고 있어요…",
  imageReady: "선택한 이미지 사본이 준비되었습니다. 게시 전에 보드를 미리 확인하세요.",
  file: "이미지 원본 파일 선택", imageConsent: "현재 정책에 따라 선택한 이미지를 업로드하여 공개용 사본을 준비하는 데 동의합니다.",
  upload: "선택한 이미지 준비", imageHelp: "이 기억의 원본 파일을 선택하세요. 서버가 원본 일치와 공개 사용 승인을 확인합니다. 다른 사진은 기기에 남습니다.",
  imagePolicyMissing: "공개 정책이 설정된 후 이미지를 준비할 수 있습니다.",
  missing: "이미지를 표시할 수 없습니다", retry: "다시 시도", unavailable: "이 보드를 볼 수 없습니다.", disabled: "공개 보드는 아직 사용할 수 없습니다.",
  failed: "보드를 불러오지 못했습니다. 연결을 확인하고 다시 시도하세요.", empty: "이 보드에 공개된 기억이 없습니다.",
  login: "로그인하고 이 보드를 동기화한 뒤 공유할 수 있습니다.", account: "계정 및 동기화", sync: "미리보기 전에 선택한 기억과 보드를 동기화하세요. 대기 중인 변경을 먼저 해결해 주세요.",
  details: { note: "감상", watchedAt: "감상 날짜", episode: "에피소드", sceneCue: "장면", emotionTags: "감정", rewatchIntent: "재감상 의도" },
};
export const publicationCopy = (locale) => locale === "ko" ? ko : en;
export function publicationError(code, locale) {
  const ko = locale === "ko", copy = publicationCopy(locale);
  if (code === "AUTH_REQUIRED") return copy.login;
  if (code === "SYNC_REQUIRED") return copy.sync;
  if (["PUBLICATION_DISABLED", "PUBLIC_IMAGE_DISABLED", "CLIENT_REQUIRED"].includes(code)) return copy.disabled;
  if (["PREVIEW_CHANGED", "CONSENT_MISMATCH", "PUBLICATION_CONFLICT", "OPERATION_MISMATCH"].includes(code)) return ko ? "내용이나 정책이 변경되었습니다. 다시 미리보고 확인해 주세요." : "The content or policy changed. Create a new preview and review it again.";
  if (code === "PUBLICATION_RESTRICTED" || code === "IMAGE_RIGHTS_REQUIRED") return ko ? "이 항목의 공개가 승인되지 않았거나 제한되어 있습니다. 비공개 원본은 그대로 유지됩니다." : "Public use is not approved or is restricted. Your private originals are unchanged.";
  if (["PUBLIC_VISUAL_NOT_READY", "ORIGINAL_IMAGE_UNAVAILABLE", "SOURCE_IMAGE_MISMATCH"].includes(code)) return ko ? "이미지가 준비되지 않았거나 원본과 일치하지 않습니다. 원본 파일과 동기화 상태를 확인하세요." : "The visual is not ready or does not match the original. Check the original file and sync state.";
  if (["IMAGE_SIZE_LIMIT", "IMAGE_FORMAT_UNSUPPORTED", "IMAGE_DECODE_FAILED"].includes(code)) return ko ? "4MiB 이하의 정상적인 JPEG·PNG·WebP 원본이 필요합니다. 애니메이션과 과도한 해상도는 지원하지 않습니다." : "Use a valid original JPEG, PNG or WebP up to 4 MiB. Animated and oversized images are not supported.";
  if (code === "IMAGE_QUOTA_EXCEEDED" || code === "RATE_LIMITED") return ko ? "현재 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요." : "The current limit has been reached. Try again later.";
  if (code === "IMAGE_CONSENT_REQUIRED") return copy.imagePolicyMissing;
  if (code === "INVALID_SELECTION") return ko ? "공개 제목과 공개할 기억 1~100개를 선택하세요." : "Enter a public title and select 1–100 memories.";
  if (code === "REVIEW_REQUIRED") return ko ? "모든 이미지와 내용을 확인한 후 게시에 동의해 주세요." : "Review all visuals and content, then confirm publication.";
  return ko ? "요청 결과를 확인하지 못했습니다. 게시 중이었다면 같은 버튼으로 다시 시도하거나 화면을 다시 열어 상태를 확인하세요." : "The result could not be confirmed. If publishing, retry the same action or reopen sharing to check its status.";
}
