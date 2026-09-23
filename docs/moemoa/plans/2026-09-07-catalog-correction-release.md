# 교정 카탈로그 DB 및 웹 배포 ExecPlan

사용자의 DB 반영·웹 배포 승인(“ㅇㅋ ㄱ”)으로 실행한다. 기존 36개 제목 연결 검토와 검색 개선을 반영한다. 미확인 작품 자동 수집·사용자 데이터 변경은 범위 밖이다.

1. 현재 운영 release와 전체 catalog 행을 읽어 별도 snapshot으로 보존한다. 대상 프로젝트는 기존 배포의 catalog origin과 대조한다.
2. 기존 release 전체를 복제하고 검토 완료한 작품의 제목/별칭만 변경한다. 변경 전후와 hash를 검증하고 기존 표지·인물·미검토 필드를 유지한다. 운영에 없는 작품은 별도 미반영 목록에 명시한다.
3. 새 STAGING release를 업로드하고 행·hash·개수 비교 후 기존 activation RPC로 전환한다. 전환 직전 이전 active pointer가 같은지 확인한다.
4. 검증된 현재 웹 소스를 별도 snapshot으로 생성, 기존 production 환경을 재사용해 Vercel candidate 빌드 후 운영 도메인에 promote한다. DB 검색 및 실제 웹 검색을 확인한다.
5. 결과·미반영 범위·복구 식별자를 보고한다. DB 복구는 이전 release를 STAGING으로 되돌려 activation RPC를 호출한다. 웹 복구는 이전 Vercel deployment로 rollback한다. 기존 release/표지/사용자 기록은 삭제하지 않는다.

보안: 관리자 키는 로컬 환경에서 읽고 로그·업로드·브라우저 산출물에 포함하지 않는다. 새 schema migration과 Public UGC 활성화는 없다. 실패 시 결과를 숨기지 않고 staging 상태를 유지한다.

## 완료
35개 교정/16개 대표 제목 변경을 담은 새 DB 릴리스 활성화 및 웹 production 배포 완료. 3,998개 유지, 표지/인물/제목 외 필드 보존. 공개 조회 35개와 운영 브라우저 9개 흐름 검증 완료. 프리렌 미니 애니와 5등분 2기 신규 수록은 미완료 범위. 상세·복구는 [운영 보고서](../reports/2026-09-07-catalog-correction-production.md).
