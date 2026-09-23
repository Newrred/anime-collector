# Title Hub Android Phase 7 ExecPlan

## 1. 목적과 사용자 결과
배포된 Web 수준의 Title Hub·My Titles·첫 Memory 안내를 Android 테스트 APK에 적용한다.

## 2. 관련 확정 결정
TECH-01 공통 Astro/React + Capacitor 구조와 Title Hub 결정을 유지한다. 2026-09-07 사용자는 Web을 간단히 직접 확인했고 기능상 큰 문제는 없지만 UI 개선은 많이 필요하다고 보고했다. Android 적용을 위한 기능 사용성 선행 확인은 완료로 기록한다. UI 완성도·정식 출시 승인을 뜻하지 않는다.

## 3. 현재 상태와 저장소 증거
`capacitor.config.ts`는 `dist`를 패키징한다. 공통 Memory runtime은 IndexedDB와 native image adapter를 사용한다. `scripts/verify-android-static-routes.mjs`는 `titles/index.html`을 dist에서만 확인하고 packaged 경로 계약에서는 빠뜨렸다. 기존 debug APK는 2026-08-26 산출물이다. JBR 21·SDK·Node 24가 있고 현재 adb 연결 기기는 없다.

## 4. 범위
경로 계약 보완, 검증된 Web/계정/catalog 설정의 Android 빌드, Capacitor sync, native unit test, debug APK 및 검증 기록. UI 재설계, production Web 재배포, Play Store, DB migration, Public·이미지 cloud 활성화는 제외한다.

## 5. 아키텍처·데이터 흐름
공통 source → Android build 환경 → dist → Capacitor assets → Gradle debug APK. 로컬 origin과 앱 ID는 기존 값을 유지하여 사용자 데이터 위치를 바꾸지 않는다.

## 6. 변경 파일 지도
`scripts/verify-android-static-routes.mjs`, 관련 unit test, 본 계획과 보고서/현재 상태 문서. Capacitor 생성 assets와 APK는 기존 ignored 경로를 사용한다.

## 7. 데이터·스키마 마이그레이션
없음. 기기 삭제·앱 제거·데이터 초기화는 수행하지 않는다.

## 8. 마일스톤
1. 사용자 기능 확인 기록 및 Android 경로 계약 보완.
2. public 환경값만 포함하는 Android build와 sync.
3. unit/native test, 패키징 경로 검증, debug APK 생성.
4. APK 내용/hash 검증과 실기기 확인 목록 전달.

## 9. 테스트와 검증
JS unit, Gradle testDebugUnitTest/assembleDebug, dist 및 packaged 15 routes, APK의 실제 assets 포함 여부. Web/native URL 모의 검사는 관련 기존 E2E를 재사용한다. 기기 미연결로 실기기 사진 선택·공유·로그인·재시작 검사는 별도 pending으로 명시한다.

## 10. 보안·개인정보·권리 영향
기존 운영과 동일 Supabase의 public anon/config만 빌드한다. secret/service-role은 금지한다. 테스트 APK에서는 analytics를 비활성화한다. 원본 이미지 업로드나 Public 활성화는 없다.

## 11. 관찰 가능성·분석 이벤트
빌드/테스트 결과와 SHA-256만 기록한다. 환경 키 원문과 사용자 기록을 로그로 출력하지 않는다.

## 12. 롤백·복구
기존 APK를 작업 전 별도 폴더에 복사한다. 기존 ID·서명·데이터 저장 경계를 유지한다. 앱 제거 없이 동일 debug 서명의 APK 재설치로 화면 버전을 바꿀 수 있으며 데이터 포맷은 변경하지 않는다.

## 13. 위험과 완화
새 경로 누락은 실제 패키지 검사로 방지한다. 로컬 기본 env가 운영과 다를 수 있으므로 검증된 public 값을 명시적으로 전달한다. 기기 동작은 APK 빌드 성공과 구분한다.

## 14. 필요한 사용자 결정
현재 테스트 APK 준비에는 추가 결정이 없다. 직접 설치 후 기능과 UI 확인이 다음 단계다.

## 15. 진행 기록
- 사용자 Web 기능 확인 수용. UI 개선은 미완료로 유지.
- toolchain·기존 APK·기기 연결 상태 확인.
- packaged My Titles 경로 계약 보완, 회귀 검사 추가.
- JS unit 222, native unit 31, native URL 모의 E2E 6 통과.
- Node 24 production build 및 Capacitor sync 성공, Gradle debug APK 생성.
- APK의 15개 HTML·앱 ID·서명 확인. 기존 APK와 동일 서명, 데이터 이관 없음.

## 16. 발견 사항과 계획 변경
packaged `titles` 경로 계약 누락을 보완한다. 물리 기기는 연결되어 있지 않다.

## 17. 완료 보고
테스트 APK 준비 완료. [보고서](../reports/2026-09-07-title-hub-android-phase7.md)에 APK 경로·SHA-256·검사 결과·설치 후 확인 목록을 기록했다. 물리 실기기 기능 확인과 UI 개선은 대기 상태이며 Phase 7 전체/정식 출시는 완료로 표시하지 않는다.
