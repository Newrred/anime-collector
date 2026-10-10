# MOEMOA · 국가별 가입 실행 정책과 공식 근거

## 2026-10-10 — 한국·미국·유럽 재검토 결과

**검토일: 2026-10-10, Asia/Seoul. 상태: 실행 정책 근거 정리 완료 / 이 문서 작성은 운영 활성화가 아님.** 사용자 승인 `REGIONAL-SIGNUP-AND-ADMIN-PROD-20261010`과 [현재 ExecPlan](01_RELEASE_EXECUTION_PLAN.md)의 「국가별 운영 가입 조건과 관리자 화면」을 따른다. 승인·계획의 Git 기준은 `3ad6fd025808ebde7be2efb4425bbaf842d93272`이다.

### 1. 실행 정책

- 제품 최소연령은 **한국14세, 나머지 대상13세 이상**을 유지한다. 유럽 GDPR의 개인정보 동의연령13~16을 모든 계정의 가입연령으로 복사하지 않는다. 반대로13세라는 제품 기준이 성년·모든 계약의 독립적인 유효성·보호자 확인을 보증한다는 뜻도 아니다.
- 적용 서비스는 무료 개인 기록·비공개 이미지 보관·기기간 동기화다. 광고·광고용 행동분석·AI 학습·유료계약을 가입 필수 처리에 포함하지 않는다. 공개 보드·미니홈·팔로우 및 공개 이미지 권리는 별도 gate를 유지한다. 비공개 가입 조사로 Public을 활성화하지 않는다.
- 기존 **국가 → 중립 생년월일 → 약관 확인 → Google** 흐름을 유지한다. 전원 신분증·얼굴·보호자 메일·유료 인증을 추가하지 않는다. 생년월일·약관 체크를 본인 또는 보호자 인증이라고 기록하지 않는다. 실제 최소연령 미달이면 OAuth/계정 생성 전 진행을 중단하고, 통과 나이로 바꾸도록 유도하지 않는다.
- 약관에는 법률상 필요한 보호자 허가·동의, 제한적인 콘텐츠 이용 허락, 미성년 계약 취소권 등 강행법상 권리를 보존한다. “가입했으므로 보호자가 동의한 것으로 본다”는 간주 조항을 넣지 않는다. 필수 계정/저장 처리는 요청된 서비스 이행에 실제 필요한 범위로 한정하고, 개인정보 안내와 약관 수락을 모든 목적에 대한 포괄 동의로 합치지 않는다.
- **제품 대상 목록, 검토한 정책, 실제 활성 국가 목록은 서로 다르다.** 실제 운영 가능 여부는 배포된 불변 문서 묶음과 DB 정책·국가 row·서버 admission guard의 readback으로 확인한다. 이 문서에는 새 운영 활성 결과를 기록하지 않는다. 전체36개국의 계약능력 또는 미국50개 주 법률을 모두 보증했다고 표시하지 않는다.

| 범위 | 유지하는 최소연령 | 이번 판단과 실행 경계 |
|---|---:|---|
| 한국 KR | 14 | 14세 미만 동의 처리의 법정대리인 확인 경로를 이번 가입에 만들지 않는다.14세를 성년 기준으로 설명하지 않는다. |
| 미국 US | 13 | 일반 청소년·성인 대상의 중립 연령 판정과 비공개 아카이브 범위로 진행한다. 다른 서비스의 Florida14 같은 값을 자동 복사하지 않는다. |
| EU27 + IS/LI/NO | 13 | 동의연령표와 가입연령을 분리하고 필요한 미성년 계약 허가 조건을 보존한다. 지속적인 대상 서비스 제공에는 아래 EU/EEA 대표자 지정 결정을 마쳐야 한다. |
| 영국 GB | 13 | 현행 UK GDPR 동의 기준과 계약능력을 구분한다. 예정된 SNS16세 제한을 현재 개인 아카이브의 가입 제한으로 넣지 않는다. UK 대표자 지정은 별도 실제 운영 조건이다. |
| 스위스 CH | 13 | 서비스 정책값이다. 법정 고정13세라고 쓰지 않는다. 판단능력·필요한 법정대리인 허가와 스위스의 별도 대표자 적용요건을 따른다. |

필리핀·태국의 기존13세 목표는 변경하지 않는다. 해당 지역의 민감정보/계약 판단을 이번 KR/US/Europe 조사에서 대신 완료했다고 주장하지 않는다. 기존 지역별 기록은 [가입 행동 계약](02_ACCEPTANCE_CONTRACTS.md)의 2026-10-10 절에 보존한다.

### 2. 공식 근거와 서비스 적용 판단

아래는 본문을 직접 열람한 공식 자료다. 법률상 사실과 MOEMOA에 대한 적용 판단을 구분한다. 확인일은 모두2026-10-10이다.

| 출처·조문 | 확인한 사실 | MOEMOA 적용 |
|---|---|---|
| [한국 개인정보 보호법22조의2](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1020398523), 시행2026-09-11 | 법에 따른 동의가 필요한14세 미만 처리에는 법정대리인 동의와 확인이 필요하다. | KR14 유지. 무료 서비스라는 이유로 모든 미성년 계약의 허가가 면제된다고 해석하지 않는다. |
| [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), 일반 대상 서비스·중립 age screen 설명 | 일반 대상 서비스의 중립 연령입력과 실제13세 미만임을 알게 된 뒤의 의무를 구분한다. 통과 연령만 선택하게 하거나 거짓 입력을 유도하는 화면은 중립적이지 않다. | US13 유지. 애니 소재만으로 아동 대상 여부를 단정하지 않고 실제 화면·마케팅·이용대상을 함께 본다. Google 성공은 연령 증명이 아니다. |
| [GDPR Art6·8](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) | Art8은 Art6(1)(a) 동의 근거에 따른 정보사회서비스 처리의 조건이다. Art8(3)은 국내 계약법을 별도로 보존한다. | 필수 개인 보관과 선택 공개/광고를 구분한다. 동의연령으로 전체 가입을 막지도, 계약이라는 명칭으로 계약능력을 우회하지도 않는다. |
| [ICO 아동 개인정보 처리근거](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/children-and-the-uk-gdpr/how-do-the-lawful-bases-apply-to-children-s-personal-information/), ISS 동의·계약 절 | UK ISS의 본인 동의 기준은13세이며 다른 적법 근거도 가능하다. 계약능력·취소 가능성 및 목적별 필요성은 별도로 고려한다. | 약관 수락을 모든 개인정보 동의로 재해석하지 않는다. 법정 권리·거부/탈퇴 동작을 보존한다. |
| [독일 BGB107](https://www.gesetze-im-internet.de/bgb/__107.html) | 미성년자가 단순한 법적 이익만 얻는 경우가 아닌 의사표시는 법정대리인 동의를 필요로 한다. | 무료라는 이유만으로 모든 콘텐츠 허락·계약이 예외라고 쓰지 않는다. 필요한 허가 조건과 실제 인증 기록은 구분한다. |
| [프랑스 CNIL 권고4](https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans), 2021-06-09 | 동의 근거 처리의15세 기준과 온라인 계약을 구분한다. 선택적인 공개 프로필 같은 추가 처리에 별도 동의 문제가 있다. | 개인 보관의13세 제품 목표를 공개 기능의 자동 허가로 확대하지 않는다. |
| [스위스 연방 소비자국 FAQ3](https://www.konsum.admin.ch/en/frequently-asked-questions-faq) | 미성년자의 판단능력과 계약에 필요한 법정대리인 허가를 구분한다. | CH13은 제품 기준이며 법률상 일률적 독립 계약 연령이라고 표시하지 않는다. |

### 3. 최신 소셜 규제를 가입 제한으로 잘못 옮기지 않음

- **프랑스:** [헌법위원회2026-911 DC, §22·주문1](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054743009), 2026-08-14 결정은15세 미만 SNS 일괄금지 조항을 위헌으로 판단했다. 이를 시행 중인 일괄금지로 넣지 않는다. 기존 개인정보 동의15세까지 없어졌다는 뜻은 아니다.
- **영국:** [정부 안내 §3·5](https://www.gov.uk/government/publications/fact-sheet-new-rules-to-protect-children-online/fact-sheet-new-rules-to-protect-children-online), 2026-09-18 갱신은 첫 시행규정의 연말 전 제출과 **2027년 봄 적용 예정**을 명시한다. 이번 가입의16세 제한으로 소급하지 않는다. 공개 소셜 기능 확장/규정 확정 시 다시 대조한다.
- **EU:** [EU KIDS Act 공식 설명](https://digital-strategy.ec.europa.eu/en/news/eu-kids-act-restrict-social-media-platforms-access-children-eu), 2026-09-17 발표·09-30 갱신은 제안을 설명한다. Commission이 제안을 채택했다는 문장을 이미 시행되는15세 계정법으로 읽지 않는다.
- **미국 Florida:** [2026 Florida Statutes501.1736(1)(e)1–4](https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0501/Sections/0501.1736.html)는 플랫폼 정의의 네 기준 모두를 요구하고, 네 번째는 열거된 기능 중 하나라도 해당하는 구조다. 현재 개인 회고 점수화는 존재하므로 알고리즘이 없다는 주장은 하지 않는다. 확인한 유한 목록·이미지 지연로딩을 무한 피드로 오인하지 않고, 미측정 이용시간을0으로 기록하지 않는다. 현재 private-only 기능에 경쟁사의 Florida14를 자동 적용할 근거는 발견하지 못했다. 이 결과는 모든 주법·소송 상태의 완전 검토가 아니다.
- **미국 Texas:** [HB18 확정 법문 §509.002](https://capitol.texas.gov/tlodocs/88R/billtext/html/HB00018F.HTM)는 사회적 상호작용·공개/반공개 프로필·다른 이용자가 보는 게시를 함께 적용요소로 둔다. 현재 비공개 저장과 향후 공개 소셜 기능을 분리할 근거로 사용하며, 새 공개 기능의 법률 검토 완료로 확대하지 않는다.
- **미국 California:** [주지사2026-09-10 공식 발표](https://www.gov.ca.gov/2026/09/10/governor-newsom-signs-the-strongest-child-safety-chatbot-and-social-media-laws-in-the-nation/)에서 AB1709 서명과16세 미만 중독적 기능 제한의 취지를 직접 확인했다. 초기 법안의 일괄 가입금지 설명을 최종 법으로 복사하지 않는다. 최종 법문 직접 열기는403이므로 상세 정의·시행일 전문 확인 PASS로 기록하지 않았고, 이 발표만으로 새 연령 제한이나 인증 기능을 도입하지 않았다. 공개 피드/참여 유도 기능 확장 때 최종 조문을 다시 확인한다.

### 4. 두 차례 반례 검토

**1차 — 더 높은 나이나 전원 인증이 필요한가?** 한국 조문·FTC·GDPR/ICO·CNIL과 실제 비공개 서비스 기능을 대조했다. 개인정보 동의연령을 모든 계정의 가입연령으로 복사하는 것은 잘못이며, 이번 범위에서 전원 신분증/보호자 메일을 추가할 직접 근거는 없었다. 비교서비스는 참고사례일 뿐 MOEMOA의 법적 허가를 대신하지 않는다. [Pinterest 현행 약관 §2(a)](https://policy.pinterest.com/en/terms-of-service)은2025-04-30판의13세·지역 조건·13~18세 보호자 허가를 확인했고 상단2026-11-12 예정판은 현행으로 사용하지 않았다. [Meta 한국 공식 안내](https://about.fb.com/ko/news/2025/07/expanding-teen-account-protections-and-child-safety-features/amp/)의 한국14·글로벌13도 전원 인증 요구와는 다르다. TikTok 현행 약관 재열기는 실패했으므로 기존 저장소의 과거 직접열람을 이번 확인으로 합산하지 않았다.

**2차 — 낮은 위험·무료·약관 한 줄이면 모두 해결되는가?** 그렇지 않다. BGB107·ICO의 계약능력 설명, 프랑스 [불공정약관위원회2017-02 권고 §2](https://www.economie.gouv.fr/files/files/directions_services/dgccrf/boccrf/2018/18_02/Recommandation-SMAD-17-02.pdf)를 반례로 대조했다. 이 권고는 영상서비스 대상이므로 MOEMOA 직접 적용을 단정하지 않지만, 필요한 부모 허가를 가입 사실로 간주하는 조항이 안전한 해결책이라는 가정을 반박한다. 따라서 허가의 필요성과 법정 취소권을 보존하고, 체크를 보호자 확인으로 기록하지 않는다. 또한 EU/UK 대표자 예외에는 낮은 위험뿐 아니라 비정기 처리 조건이 함께 필요하므로 소규모라는 이유만으로 면제라고 쓰지 않는다.

### 5. 남은 실제 사용자 결정 — EU/UK 대표자 지정

유럽 대상13세 정책을 폐기하거나16/18세로 바꾸는 안건이 아니다. **EU/EEA와 UK에서 지속적으로 계정·백업 서비스를 제공하기 위한 연락·대응 주체 지정**이다. 제품 목표는 유지하며 이 외부 지정이 없는 상태를 운영 활성 완료로 포장하지 않는다. 이 안건은 독립적인 코드·관리자·검증·나머지 적용 작업을 중단시킬 이유가 아니다.

1. **근거:** [GDPR Art27(1)–(3)](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)과 [EDPB3/2018 v2.1 p25, Exemptions from the designation obligation](https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines_3_2018_territorial_scope_after_public_consultation_en_1.pdf). 공식 안내 페이지의 다운로드 링크를 따라 최종 PDF 본문까지 확인했다. 예외는 비정기 처리·대규모 민감정보 처리 아님·위험이 발생할 가능성이 낮음을 함께 요구한다. EDPB는 정규 활동 밖에서 반복되지 않는 처리를 비정기로 설명한다. 지속 계정·보관은 이용자가 적다는 이유만으로 여기에 해당하지 않는다.
2. **UK 교차 확인:** [ICO의 EU/UK 대표자 안내](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/receiving-personal-information-from-the-eea/)는 국외 사업자의 대상 서비스 제공과 정규 고객 기반에 같은 구분을 적용한다. 대표자는 해당 지역에 있는 개인·기업·단체일 수 있으며 서면 지정과 연락처 안내가 필요하다. 반드시 유료 인증회사 또는 변호사를 고용하라는 뜻은 아니다.
3. **저장소 확인:** `rg`로 `docs/`, `src/` 및 추적 대상 본문의 `대표자`, `대리인`, `representative`, `Art27`, `EU/UK representative`를 두 차례 검색했다. `02_ACCEPTANCE_CONTRACTS.md:199,279` 및 `src/pages/legal/review.astro:114`에는 필요한 대표자에 대한 잔여 메모만 있다. **실제 대표자 이름·주소·서면 위임·지정 완료 기록은 발견하지 못했다.** 저장소 밖에 계약이 전혀 없다고 단정한 것은 아니다. 서비스 운영자 또는 Supabase/Vercel을 별도 위임 없이 EU/UK 대표자로 표시하지 않는다.
4. **필요한 결정의 정확한 내용:** EU/EEA 대상 국가 중 한 곳에 있는 대표자와 UK 대표자의 실제 지정 상대·공개 연락처·서면 위임을 확정한다. 신규 비용/외부 계약이 수반되면 그 부분만 사용자가 선택한다. 일반 배포 승인을 다시 받거나 법률자료 전체 제출을 요구하는 안건으로 바꾸지 않는다.
5. **스위스는 별도:** [FDPIC의 FADP14 설명](https://www.edoeb.admin.ch/en/representatives-in-accordance-with-article-14-fadp)은 대상 제공·대규모·반복·높은 위험 네 조건을 모두 요구한다. EU의 대표자 결정을 CH에 자동 복사하지 않는다. 소규모 비공개 서비스의 실제 규모·전체 처리의 본래 위험을 평가하고, 공개 또는 규모 확대 때 다시 검토한다.

#### 5.1 해외 법인 없이 대표자를 지정하는 실행안

사용자의 추가 지시(“없다면 보류가 아니라 현재 상황의 해결 방법을 찾기”)에 따라 **대표자 지정만** 비교했다. 확인일은2026-10-10이며, 아래 금액은 업체가 공개한 가격이지 MOEMOA 수임 확정이나 결제 완료가 아니다. DPO·법률 자문·인증·다른 규제 패키지를 필수 구매로 묶지 않는다.

| 방법 | 공개 비용 | 현재 가능한 방식과 확인할 조건 |
|---|---|---|
| 기존 현지 개인·단체 | 무상 수임에 실제 동의하면 대표자 수수료0 | [ICO 공식 안내](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/receiving-personal-information-from-the-eea/)는 해당 지역의 개인·기업·단체를 허용한다. EU/EEA 대상 국가 내 연락 주체와 UK 내 연락 주체가 각각 필요하며, 한 단체가 양쪽에 기반을 가지면 두 지정을 맡을 수 있다. 이름만 빌리는 것이 아니라 서면 위임·공개 연락처·민원/당국 연락 전달·처리기록 접근/제공을 실제 수행해야 한다. 무조건 무료로 맡아주는 기관이 확인됐다는 뜻은 아니다. |
| **DataRep — 우선 비교 대상** | **12개월 €150**, 민감정보 포함 옵션 **€250** | [공식 상품](https://www.datarep.com/product/small-company-package/)의 Small은 EU/EEA/UK 대상자 합계1,000명 이하 조건이다. [공식 서비스 설명](https://www.datarep.com/service/eu-gdpr-article-27-representative-service/)은 UK 대표자 지정을 추가금 없이 포함한다고 명시하므로 EU 요금에 UK 단독 상품을 다시 더하지 않는다. [공식 상점](https://www.datarep.com/shop/)의12개월/합리적 사용정책 조건도 확인했다. 세금·서비스 약관/수임 확인 전 최종 결제액을 확정하지 않는다. |
| Janus Compliance — 인원 구간 없는 대안 | EU **€349/년** + UK **£249/년** | [EU 공식 안내](https://www.januscompliance.co.uk/services/eu-gdpr-representative)와 [UK 공식 안내](https://www.januscompliance.co.uk/services/uk-gdpr-representative): 서면 지정·연락 전달·처리기록 보관·안내 문구를 포함한다. UK는 VAT 추가 없음, 매년 갱신 여부를 선택한다. 영어 대응이며 실질적인 답변 대필·번역은 별도 사전 합의 비용이다. 홈페이지 약관만으로 계약되는 것이 아니라 별도 지정계약을 체결한다. EU 세금 및 MOEMOA 수임조건은 실제 견적에 명시해야 한다. |

DataRep의1,000명은 가입자 수만이 아니다. [공식 FAQ](https://www.datarep.com/faq/)는 기존 보관·백업 대상자, 이후12개월 예상 처리 대상자, 대신 처리하는 정보주체와 IP/위치를 처리하는 방문자도 산정한다고 설명한다. 따라서 계정 수가 적다는 이유만으로 €150 구간을 확정하지 않는다. 자유 이미지·메모를 저장하므로 민감정보가 절대로 없다고 대신 선언하지 않고 실제 범위를 밝혀 €150/€250 또는 상위 구간을 정한다. 상품/FAQ는 검색 서비스가 반환한 공식 본문을 확인했고, 직접 열기는 사이트 보안 확인으로 제한됐다. 서비스 계약 전문·상대방의13세 이상 서비스 수임 승인은 아직 받지 않았다.

**가격만 보고 제외하지 못했던 반례도 확인:** [REP27 공식 가격·수임조건](https://www.gdprrepresentative.com/pricing/)은 모든 플랜에서16세 미만을 대상으로 하는 서비스를 거절한다고 명시한다. 그러므로 저가 EU+UK 상품이 있어도 MOEMOA13세 목표의 후보로 추천하지 않는다. 다른 업체도 낮은 요금이 자동 수임을 뜻하지 않으므로, 문의에는 “한국의 개인 운영자, 무료 비공개 애니 기록,13세 이상(한국14세), 광고·판매 없음, 사용자 이미지/메모 저장”을 숨김없이 적어 수임 범위와 총액을 확인한다.

**권장 다음 동작:** (1) 기존 현지 수임자가 없다면 DataRep의 해당 범위·총액 확인을 우선한다. (2) 운영자는 필요한 계약 상대/지출만 선택하고 서명한다. (3) 발급된 EU/UK 위임서와 공개 연락처를 인계 기록·개인정보 안내에 반영한다. (4) 그 사실과 배포 문서/서버 정책을 확인해 유럽 가입 활성 작업을 마친다. 조사만으로 임의 계약·결제·문의 전송·타인 연락처 공개는 하지 않았다. 서비스 이름을 바꾸거나 대상 지역을 숨겨 비정기 처리 예외로 우회하는 안도 제안하지 않는다.

### 6. 저장소 증거와 첫 조사 문서 변경의 검증

- `src/features/auth/simpleSignup.js:7–15`의 `COUNTRIES`와 `signupAvailability`: 총36개 대상(KR/PH/TH/US + 유럽32). 명단에 있어도 실제 정책 row/최소연령이 없으면 가입 준비 완료로 취급하지 않는다. `:33–51`의 `validateDeclaration`/`createDeclaration`은 정책·문서·나이·명시 수락을 검증한다.
- `src/domain/showcase/showcaseSelectors.js:308–351`의 `buildResonanceShelf`: 개인 감상·재시청·메모 길이 등을 점수화한다. 알고리즘 부재를 법률 판단의 전제로 사용하지 않았다. `src/features/memory/components/BoardCollectionGrid.tsx:19–35`의 IntersectionObserver는 이미지 로딩이며 무한 피드 증거가 아니다.
- 기존 고정 문서 `src/components/legal/Terms20261010Test.astro:24–30`은 조건부 보호자 허가와 체크의 인증 한계를 구분한다. 이 테스트 문서를 운영에 그대로 쓰거나 과거 영수증에 새 의미를 붙이지 않는다.
- 확인 명령: `git show 3ad6fd0 -- ...`, 위 경로의 `Get-Content`, 관련 `rg` 검색 및 문서 diff/참조 경로 검사. 문서 전용 변경으로 앱/unit/DB 검사를 재실행하지 않는다. 웹 검색 결과 요약만으로2026 법문 전문을 읽었다고 기록하지 않는다.
- 변경 범위는 이 문서1개다. 코드·UI·README·DB·국가 row·flags·운영 설정·외부 계약·원격 Git 변경은 없다. 개인정보·키·사용자 이미지 수집도 없다. 문서 원복으로 되돌릴 수 있으며, 이 조사 완료를 실제 가입 활성/운영 배포 완료로 표시하지 않는다.

### 7. 2026-10-10 후속 — 운영 문서 후보의 별도 등록

- 같은 `REGIONAL-SIGNUP-AND-ADMIN-PROD-20261010`/ExecPlan M3에 따라 `src/components/legal/Terms20261010.astro`, `Privacy20261010.astro`와 새 고정 route `/legal/terms-2026-10-10/`, `/legal/privacy-2026-10-10/`를 준비했다. `src/features/auth/signupDocuments.js`에 정확한 `simple-signup-2026-10-10`/`terms-2026-10-10`/`privacy-2026-10-10` 묶음 및 `guardianNotice:true`를 추가했다. 등록 자체는 국가 row·정책 활성이나 약관 수락이 아니다.
- 기존10/9 두 문서와10/10-test 두 문서는 그대로 보존했다. 부모가 함께 읽고 동일 항목을 직접 선택한다는 PH13~17 안내는 실제 허가 요청이며, 체크를 신원·관계·권한 인증으로 기록하는 새 flag를 만들지 않았다. root가 소유한 가입 UI와 별도로 독립 문서/registry만 수정했다.
- 읽은 근거: 시작 문서·결정·06/07/08/09·PLANS·현재 ExecPlan/가입 행동 계약, 기존 고정 문서4개·registry·서버/가입 검사·`vercel.json`, [Supabase2026-10-06 지역 FAQ](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq), [Supabase DPA](https://supabase.com/legal/customer-resources/data-processing-addendum), [Vercel DPA](https://vercel.com/legal/dpa), [Google 방침](https://policies.google.com/privacy). 운영 Supabase의 Singapore/Free 설정은 root의 실제 관리화면 확인이며, 이 문서 작성자가 별도 배포를 검증한 결과로 표현하지 않는다.
- 고지는 Supabase의 싱가포르 주 저장과 미국 등의 지원/EU 로그/글로벌 전송, Vercel의 sin1 함수 설정과 글로벌 웹·미국 운영, 수동 암호화 재해복구 사본을 구분한다. 제공처가 공개한 DPA의 존재를 모든 요금제·모든 처리의 계약 허용 보증으로 쓰지 않는다. 특히 Vercel DPA §1·4의 Pro/Enterprise 적용 범위 및 Schedule1 §6(a)의 민감정보 제한은 root에 정확한 잔여 확인으로 전달했다. PH 연령정보의 경로에 대한 해당 조건의 실제 적용을 대조해야 하며, 새 유료플랜을 자동 결정하거나 외부 문의를 무단 발송하지 않았다.
- **수동 보존 관리의 최소 실행안(후보, 새 자동화·확정 기한 아님):** 백업마다 생성일·대상 범위·사본 위치·해시·삭제 반영 기준시점을 기록한다. 새 복구본을 검증할 때 기존 사본의 보존 필요도 함께 검토하고 필요가 끝난 사본은 안전하게 정리한다. 복원 전 최신 계정/콘텐츠 삭제 내역과 대조하고 확인 전 서비스를 재개하지 않는다. 종료된 지원·신고 사건과 삭제 처리 식별 기록은 목적·법적 보존 필요를 검토해 불필요한 내용을 삭제/비식별화한다. 운영에 없는7일 자동회전이나 모든 제공처의 동일 삭제 기한을 공표하지 않는다. 실제 사본 삭제·회전 설정·복구 검증을 이번 문구 작성으로 완료했다고 기록하지 않는다.
- 검증: `node --test tests/unit/productionSignupDocuments.test.mjs` **7 PASS**(정확한 조합/혼합 거부/PH만 목적 동의/옛4문서 LF정규화 SHA256/새 route·본문4소스 Astro 컴파일/필수 문구). 새 검사·`simpleSignup.test.mjs`·`signupServer.test.mjs` 동시 실행 **28 PASS**, `git diff --check` PASS. 컴파일 검사는 실제 렌더·Google 왕복·운영 동작 검사가 아니며 전체 빌드/화면 검증은 통합 단계에서 수행한다.
- DB/data migration·외부 전송·비밀정보·로그 수집 변경은 없다. 되돌릴 때 새 정책을 비활성 상태로 두고 새 registry 항목을 제거할 수 있지만, 이미 수락된 문서/영수증을 덮어쓰거나 제거하는 방식은 사용하지 않는다. 운영 활성 전 실제 문서 묶음·서버 정책·지역 조건과 공개 연락처를 확인한다. 대표자가 아직 없는데 가짜 EU/UK 연락처를 넣지 않았다.
