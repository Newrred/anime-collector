# 2026-10-18 GPT Pro 검토 자료 — 참고 원문

상태: **첨부 제안 / 현행 정책·실행 승인 아님**. 분석 기준은 `dfa642661467f5169021de8baf2ebb27e29350a6`이며 인수 시 HEAD는 `9d151dd0cd27300500062eddc75bac7fe0fe9f44`다.

- 판단과 최소 후속은 [인수 보고](../../reports/2026-10-18-pro-legal-operations-intake.md)를 읽는다. 실행 원장은 기존 [release-v2/03](../../release-v2/03_RELEASE_WORKBOARD.md) 하나다.
- 원본 3개는 사용자 Downloads의 `MOEMOA_Legal_Review_20261018.docx`, `MOEMOA_Legal_Corrections_20261018.md`, `MOEMOA_Service_Operations_Pack_20261018.zip`이다. 원본 SHA256·ZIP 33개 entry·보존 파일 해시는 [PROVENANCE.json](PROVENANCE.json)에 기록했다.
- DOCX 3개는 표의 셀을 포함한 문단 순서의 `.txt`로 보존했다. 페이지 배치·이미지·링크 target을 재현하는 사본은 아니며 원본 Word를 편집하지 않았다. 그 외 ZIP 텍스트 31개와 Corrections Markdown은 바이트를 그대로 보존했다.
- 이 참고 폴더는 `.gitattributes`로 줄바꿈 자동 변환을 끄므로 다른 PC에서도 보존 파일의 SHA256을 대조할 수 있다. 앱 소스의 줄바꿈 규칙은 변경하지 않는다.
- JavaScript 샘플3개는 자동 테스트 탐색/실행을 피하도록 `.mjs.txt` 이름으로 보관한다. 내용은 원본 바이트와 같으며 manifest의 `sourcePath`가 원래 이름이다. 첨부 README의 실행 명령은 이 참고 사본에서 실행하지 않는다.
- `operations-pack/README.txt`의 `.docx` 안내는 원본 ZIP 기준이다. 여기서는 해당 문서의 `.txt`를 읽는다. 원본 manifest의 바이너리 해시와 추출 텍스트 해시는 서로 다르다.
- `research/dataflow_audit.md`, `research/legal.md` 및 대화형 관리자 mock은 원본 ZIP에 없다. 누락 파일을 읽었다고 주장하지 않는다. 지적된 실행 경로는 현재 저장소에서 별도 대조했다.
- `operations-pack/code/`는 미연결 샘플, `patches/`는 미적용 patch, `public-documents/`는 미게시 초안이다. 앱 import·스크립트 실행·정책 게시·발신 인증·예약 설치 대상으로 자동 채택하지 않는다.
- 첨부 `verification.json`의 PASS는 Pro 측 검토 기록이다. 이번 PC에서 동일 테스트·메일 발송·운영 검증을 했다는 근거로 재사용하지 않는다.
- 공급자/보관 변수, 새 계정 제재, 8주 홍보·모집 가정은 확정 결정이 아니다. 현재 국가·연령·요금·공개 권리와 과거 수락 문서를 유지한다.

이번 보존은 텍스트 참고자료 35개(684,201bytes), ZIP CRC PASS, 고신뢰 credential 패턴 일치 0건을 확인했다. 실제 env·복구키·운영 DB·사용자 이미지·비공개 사건 기록을 추가하지 않았다. 패턴 검사가 모든 민감정보의 부재를 보증하는 것은 아니다.
