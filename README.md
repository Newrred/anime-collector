# anime-collector

개인용 애니 라이브러리 웹앱입니다.  
서버 없이 브라우저 저장소(IndexedDB + localStorage mirror)로 동작하며, 회상/목록/티어/데이터 센터를 제공합니다.

## 주요 기능

- 상단 공통 IA: `회상 | 목록 | 티어 | 데이터`
- 데이터 메뉴: 내보내기/불러오기(병합/덮어쓰기), 모바일 공유/복사, PWA 설치
- 회상 홈(`/`): 최근 기록, 이맘때 본 작품, 기억 없는 작품, 최근 자주 기록한 캐릭터, 핀 캐릭터
- 목록(`/library`):
  - 한글 강화 검색(aliases + AniList + Wikidata 보강)
  - 정렬/필터(텍스트, 장르, 상태), 카드 밀도 슬라이더, 포스터/정보 뷰 전환
  - 상세 모달 편집(별점 0~5, 0.5 단위, 메모, 정주행 횟수/마지막 날짜)
  - 정주행 완료 버튼 자동 기록(+1)
  - 퀵 로그(일/월/분기/연도/미상 정밀도 + 캐릭터 최대 3명 + 태그/메모)
  - 통계 대시보드(상태, 장르 TOP5, 정주행 TOP5, 평균 점수)
- 티어(`/tier`):
  - Drag & Drop 티어 편집
  - 로그 기반 필터(연도/시즌/재시청/캐릭터 기록)
- 데이터 센터(`/data`):
  - 저장 엔진, 용량 사용량, 저장 보호(persist) 상태 확인

## 라우트

- `/` : 회상 홈
- `/library/` : 목록/검색/상세/통계
- `/tier/` : 티어 보드
- `/data/` : 데이터 센터

## 기술 스택

- Astro 5
- React 19 (`client:only`)
- AniList GraphQL API
- Wikidata API / WDQS(SPARQL)
- PWA (`public/manifest.webmanifest`, `public/sw.js`)

## 저장 구조

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

## 백업 포맷

현재 내보내기 포맷은 `version: 2`입니다.

```json
{
  "app": "ani-site",
  "version": 2,
  "exportedAt": "2026-03-09T12:34:56.000Z",
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

- `v1`(list/tier 중심 구버전) import 호환
- import 모드:
  - `merge`: 기존 데이터와 병합
  - `overwrite`: 기존 데이터 덮어쓰기

## 실행

```bash
npm install
npm run dev
```

- 기본 개발 서버: `http://localhost:4321`

```bash
npm run build
npm run preview
```

## 배포

GitHub Pages 배포 워크플로:

- 파일: `.github/workflows/astro.yml`
- 트리거: `master` 브랜치 push 시 자동 빌드/배포

## 데이터 수집/별칭 스크립트

- `npm run collect:anilife:first-season`
- `npm run collect:anilife:2010-2027`
- `npm run build:aliases:auto`
- `npm run build:aliases:auto:sample`

관련 데이터 파일은 `src/data` 아래 JSON으로 관리됩니다.

## 디렉터리 가이드

- `src/components`: 화면 컴포넌트
- `src/pages`: 라우트 엔트리
- `src/domain`: 정규화/도메인 로직
- `src/storage`: IndexedDB/localStorage 계층
- `src/repositories`: 저장소 접근 API

