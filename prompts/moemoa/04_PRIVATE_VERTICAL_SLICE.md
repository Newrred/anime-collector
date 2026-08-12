# Phase 4 프롬프트 — Private Vertical Slice 구현

승인된 ExecPlan과 `docs/moemoa/02_PRODUCT_SCOPE_AND_USER_FLOWS.md`, `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`, `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`를 따라라.

목표 흐름:

```text
Android Share Target/Photo Picker
→ 작품 검색 또는 PrivateTitle
→ 사용자 이미지 또는 시스템 디자인
→ Complete Memory Card
→ LOCAL_ONLY 저장
→ Archive
→ Board
→ 선택 로그인과 로컬 승격
→ metadata sync
→ Web Archive/Board
→ export/delete
```

Public publishing과 private cloud image upload는 이번 범위에서 켜지 마라.

각 milestone을 작게 나누고 테스트 후 진행 기록을 갱신하라. 저장 성공과 sync 성공을 UI와 state에서 분리하라. 로그인 실패 또는 sync 실패로 로컬 데이터가 손실되지 않게 하라.
