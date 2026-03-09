# anime-collector

서버 없이 브라우저 저장소만으로 동작하는 개인 애니 기록 앱입니다.  
기능 축은 `회상 / 목록 / 티어 / 데이터 센터`이며, 검색-기록-회고 루프를 중심으로 설계되어 있습니다.

## 핵심 화면

- `/` : 회상 홈
- `/library/` : 목록(검색/추가/상세/기록/통계)
- `/tier/` : 티어 보드
- `/data/` : 데이터 센터(저장 상태/용량/보호)

상단 내비게이션은 `회상 | 목록 | 티어` + 우측 `유틸` 메뉴 구조입니다.

## 주요 기능

### 1) 목록/검색
- 한글 강화 검색: `aliases + AniList + Wikidata` 조합
- 검색 단계 표시 및 로딩 점(.) 애니메이션
- 라이브러리 필터: 텍스트/장르/상태
- 정렬 + 카드 밀도 슬라이더 + 포스터/메타 뷰 전환

### 2) 상세/기록(WatchLog)
- 작품 상세 모달에서 상태/메모/점수/정주행 관리
- 별점: 5점 만점, 0.5 단위
- 퀵 로그: `day/month/season/year/unknown` 정밀도 지원
- 캐릭터 로그: 최대 3명 + 대표 캐릭터 1명 + affinity/reasonTags/note
- 상태 변경(시작/완료/하차) 및 정주행 +1 시 로그 생성

### 3) 회상 홈
- 최근 기록
- 기억 없는 작품
- 최근 기록의 대표 캐릭터
- 반복 기록 캐릭터
- 이맘때 본 작품
- 핀 캐릭터
- 연말 리캡(연도별): Top 작품/Top 캐릭터/시즌 분포
- 공유 기능: 리캡 텍스트 복사, Web Share, PNG 카드 저장

### 4) 티어
- Drag & Drop 티어 편집
- 로그 기반 필터(연도/시즌/재시청/대표 캐릭터/이유 태그/핀 포함 작품)

### 5) 데이터/백업
- JSON 내보내기/불러오기(병합/덮어쓰기)
- 모바일 공유/클립보드 불러오기 대응
- 저장 엔진/사용량/persist 상태 표시
- PWA 설치(가능 환경에서 버튼 노출)

## 데이터 모델 요약

- `LibraryItem`: 현재 상태(snapshot)
- `WatchLog`: 시점 이벤트 로그(eventType, watchedAtPrecision/value/start/end/sort, cue, note, characterRefs...)
- `CharacterPin`: 전역 캐릭터 핀
- `TierState`: 글로벌 현재 티어 배치

백업 포맷은 현재 `version: 3` 입니다.

```json
{
  "app": "ani-site",
  "version": 3,
  "exportedAt": "2026-03-10T00:00:00.000Z",
  "list": [],
  "tier": {},
  "watchLogs": [],
  "characterPins": [],
  "preferences": {
    "cardsPerRowBase": 5,
    "cardView": "meta"
  }
}
```

- `v1`(배열 또는 `{list,tier}`) import 호환
- 캐시 데이터(media/search)는 export 대상 아님

## 저장소 구조

### localStorage keys
- `anime:list:v1`
- `anime:tier:v1`
- `anime:watchLogs:v1`
- `anime:characterPins:v1`
- `anime:searchCache:v1`
- `anime:lastBackupAt:v1`
- `anime:autoBackup:v1`
- `anime:autoBackup:meta:v1`
- `anime:grid:perRowBase:v1`

### IndexedDB stores
- `library_items`
- `watch_logs`
- `character_pins`
- `tier_state`
- `media_cache`
- `search_cache`
- `meta`

앱 시작 시 legacy localStorage 데이터는 마이그레이션 로직으로 IDB에 이행됩니다.

## 기술 스택

- Astro 5
- React 19 (`client:only`)
- AniList GraphQL API
- Wikidata / WDQS
- Playwright(E2E)
- PWA(manifest + service worker)

## 로컬 실행

```bash
npm install
npm run dev
```

기본 주소: `http://localhost:4321`

```bash
npm run build
npm run preview
```

## 테스트

```bash
npm run test:e2e
```

- 라이브 외부 API 품질 측정(선택):

```bash
npm run test:e2e:live
```

## 배포

GitHub Pages Actions 워크플로 사용:

- 파일: `.github/workflows/astro.yml`
- 기본 브랜치 push 시 빌드/배포

## 데이터 수집/별칭 스크립트

```bash
npm run collect:anilife:first-season
npm run collect:anilife:2010-2027
npm run build:aliases:auto
npm run build:aliases:auto:sample
```

## 디렉터리 가이드

- `src/components` : 페이지/뷰 컴포넌트
- `src/components/home` : 회상 홈 세부 컴포넌트
- `src/domain` : 도메인 셀렉터/정규화
- `src/services` : 공유/유틸 서비스 로직
- `src/repositories` : 데이터 접근 계층
- `src/storage` : IDB + legacy/localStorage 계층
- `src/pages` : Astro 라우트 엔트리
