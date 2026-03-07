# 애니 라이브러리 (Ani Library)

Astro + React 기반 개인용 애니 목록/티어 관리 웹앱입니다.  
서버 DB 없이 브라우저 `localStorage`만으로 동작하며, AniList + Wikidata 조합으로 한글 검색을 보강합니다.

## 기술 스택

- Astro 5
- React 19 (`client:only`)
- AniList GraphQL API
- Wikidata API + WDQS(SPARQL)
- Playwright E2E
- PWA (Web App Manifest + Service Worker)

## 현재 구현 기능

- 상단 Sticky 네비게이션: `목록 | 티어` + `내보내기/불러오기` 팝오버 메뉴
- 목록 페이지
- 애니 검색 추가(영문/한글 강화 검색)
- 상태별 분류 / 시청 장르 상위 5 / 정주행 TOP 5 / 평균 점수
- 라이브러리 정렬(추가/제목/점수/연도/장르)
- 라이브러리 검색(제목/장르), 장르 다중 선택, 상태 필터 칩
- 카드 뷰 모드 전환(포스터/정보, 포스터만)
- 반응형 카드 그리드 + 줄당 포스터 수 슬라이더
- 카드 하단 상태 배지 + 별점 미니 표시 + 장르 태그(최대 3개)
- 포스터 클릭 모달 상세 편집
- 별점 5점 만점(0.5 단위), 별 UI 클릭/드래그 입력, 호버 프리뷰
- 상태/메모/정주행 횟수/마지막 정주행 날짜 수정
- `정주행 완료! +1` 버튼(횟수 증가 + 오늘 날짜 기록)
- 캐릭터 얼굴/이름 표시(한글 우선 시도)
- 티어 페이지
- S/A/B/C/D + 미분류 Drag & Drop
- 목록 변경사항과 티어 데이터 동기화
- 목록/티어 공통 데이터 메뉴
- JSON 내보내기/불러오기(파일 + 모바일 붙여넣기)
- 불러오기 모드: `병합` / `덮어쓰기`
- PWA 설치 버튼(브라우저 `beforeinstallprompt` 지원 시)
- 자동 로컬 백업 스냅샷 + 마지막 수동 백업 리마인드

## 검색 로직 요약

`src/components/AddAnime.jsx`

- 디바운스: `200ms`
- 로딩 상태 텍스트 + 점 애니메이션(`. .. ...`)
- 검색 결과 캐시: `anime:searchCache:v1` (localStorage, TTL 3일)
- 한글 검색
- alias 사전 매칭
- Wikidata 확장 탐색(쿼리 길이에 따라 깊이 조절)
- AniList 직접 검색 병렬 실행으로 빠른 1차 결과 선표시
- 후보 상위 먼저 조회 후 tail 보강
- 비한글 검색
- AniList 결과를 먼저 즉시 표시
- 이후 Wikidata 기반 한글 제목 보강 반영

## 점수/정주행 규칙

- 점수 범위: `0 ~ 5` (step `0.5`)
- 레거시 10점 데이터는 로드 시 자동 5점 스케일로 보정
- 정주행 횟수: 정수(최대 999)
- 마지막 정주행 날짜: `YYYY-MM-DD`

## 데이터 모델

목록 아이템(`anime:list:v1`)

```ts
{
  anilistId: number;
  koTitle: string | null;
  status: "완료" | "보는중" | "보류" | "하차" | "미분류";
  score: number | null;        // 0~5, step 0.5
  memo: string;
  rewatchCount: number;        // 0~999
  lastRewatchAt: string | null; // YYYY-MM-DD
  addedAt: number;
}
```

## 로컬 저장 키

- `anime:list:v1`: 목록 데이터
- `anime:tier:v1`: 티어 데이터
- `anime:mediaCache:v1`: AniList 메타 캐시(TTL 7일)
- `anime:searchCache:v1`: 검색 결과 캐시(TTL 3일)
- `anime:lastBackupAt:v1`: 마지막 수동 내보내기 시각
- `anime:autoBackup:v1`: 자동 로컬 스냅샷
- `anime:autoBackup:meta:v1`: 자동 스냅샷 메타
- `anime:grid:perRowBase:v1`: 카드 열 수 기본값

## 실행

```bash
npm install
npm run dev
```

- 개발 서버: `http://localhost:4321`

```bash
npm run build
npm run preview
```

## 테스트

```bash
npm run test:e2e
```

라이브 외부 API 측정 테스트

```bash
# PowerShell
$env:LIVE_E2E='1'; npm run test:e2e:live
```

- `tests/library.spec.ts`: 목록 페이지 UI/기능 회귀
- `tests/tier.spec.ts`: 티어 페이지 UI/기능 회귀
- `tests/live-search.spec.ts`: 실시간 AniList/Wikidata 응답 품질/지연 측정

## 프로젝트 성격

- 이 프로젝트는 서버 없는 클라이언트 사이드 웹 애플리케이션(PWA)입니다.
- 계정/프로필 공유 기능(멀티유저, 서버 DB)은 아직 미구현입니다.
