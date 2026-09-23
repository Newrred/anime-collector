# 2026-09-08 누락 작품 검토 및 운영 수록

225개 후보를 검토해 **131개를 운영에 추가**, 기존 4,161개를 보존해 **4,292개**가 됐다. 우선 24개 중 23개, 나머지 TV 후보 201개 중 108개 추가.

- 이전 release: `catalog-add-cfd7de57fd596c974547fb15`
- 운영 release: `catalog-add-7e982253b551b92984460a5e`
- 활성화: 2026-09-08T04:46:58.064Z
- 신규 표지 131개 구조 검사·Chromium decode·승인된 source identity 검증·운영 다운로드 SHA-256 일치.
- assets/search/details 각 4,292행, people 5028행 staging 전체 재조회 hash 일치. 기존 행은 release_id 외 모든 값 불변.
- 신규 131개 전부 익명 권한 검색과 상세를 검증하고 니세코이 1·2기 검색 유지도 확인.
- 관련 회귀 테스트 29/29 통과. 131개 projection 재생성 결과 일치 및 변경된 제목 검토 hash 거부 확인.
- 운영 브라우저에서 카구야 1·2·3기 분리 검색, 2기 12화/2020-04-11/A-1 Pictures 상세와 460×655 표지 로드, AniList 외부 링크 0개, 오버로드 3기 검색을 확인했다. 04:49 UTC 최종 익명 재조회에서 active release 및 테이블 건수 일치. `final-verification.json`에 기록.

## 검토 범위와 한계

AniList 공개 페이지의 보이는 원제·독립 ID·방영일·형식·제작사·관계·표지와 기존 snapshot의 제목/별칭/ID를 대조했다. API 응답으로 가장하지 않고 REVIEWED_PUBLIC_RENDERED_PAGE로 보존했다. 자동 검사는 모든 개별 제목의 국내 정식 배급명 검증과 동일하지 않다. 한국어 제목은 기존 시리즈명 및 원제를 기반으로 구별 가능한 **서비스 편집 표기**이며 공식 배급명이라는 주장이 아니다. Suzuka와 A3! Season Spring & Summer는 원제를 유지하고 한국어 제목 검토 상태를 남겼다.

READY 120개, 한국어 제목 검토 2개, 권장 필드 일부 누락 9개. 필수 필드는 131개 모두 충족한다. 등장인물·성우와 공식 사이트 링크는 이번에 수집하지 않았다. 저해상도 표지만 제공된 과거 작품은 관찰된 원본을 사용했으며 주소를 추정해 큰 이미지를 만들지 않았다.

이번 검토는 앞서 발견한 225개 후보 범위다. 모든 애니메이션의 완전 수록을 보장하지 않으며 나머지 기타 관련작 2,302개와 별도 동일 제목/다른 ID 후보 24개는 이 작업의 범위 밖이다.

## 제외·보류

방영 전 87개, 이미 수록 1개, 기존 합본/겹침 판단 보류 5개, 공개 페이지 근거 부족 1개.

| ID | 작품 | 판단 |
|---|---|---|
| 849 | Suzumiya Haruhi no Yuuutsu | 기존 합본·겹치는 시즌 항목과의 수록 범위 검토 필요 |
| 8577 | Aki-Sora: Yume no Naka | 공개 페이지에 작품 정보 미표시, 미수록 |
| 20181 | Aikatsu! 2 | 기존 합본·겹치는 시즌 항목과의 수록 범위 검토 필요 |
| 21004 | Kaitou Joker 2 | 기존 합본·겹치는 시즌 항목과의 수록 범위 검토 필요 |
| 21307 | Aikatsu! 4 | 기존 합본·겹치는 시즌 항목과의 수록 범위 검토 필요 |
| 149939 | Ranma 1/2: Nettou-hen | 기존 합본·겹치는 시즌 항목과의 수록 범위 검토 필요 |
| 197824 | Isekai Nonbiri Nouka 2 | 기존 자체 ID로 수록됨 |

## 추가 작품

| ID (내부 검증용) | 서비스 표시명 | 형식 | 방영 시작 |
|---|---|---|---|
| 67 | 바질리스크 ~코우가인법첩~ | TV | 2005-04-13 |
| 94 | 기동전사 건담 SEED DESTINY | TV | 2004-10-09 |
| 97 | 라스트 엑자일 | TV | 2003-04-07 |
| 298 | 닷핵 황혼의 팔찌 전설 | TV | 2003-01-09 |
| 352 | 꼬마마법사 레미 3기 | TV | 2001-02-04 |
| 390 | Suzuka | TV | 2005-07-07 |
| 551 | 그래플러 바키 최대 토너먼트 편 | TV | 2001-07-24 |
| 878 | 제가페인 | TV | 2006-04-06 |
| 1018 | 마술사 오펜 리벤지 | TV | 1999-10-02 |
| 1088 | 초시공요새 마크로스 | TV | 1982-10-03 |
| 1104 | 신혼합체 고단나 2기 | TV | 2004-04-05 |
| 1186 | 배틀 애슬리테스 대운동회 (1997 TV) | TV | 1997-10-03 |
| 1519 | 블랙 라군 The Second Barrage (2기) | TV | 2006-10-03 |
| 1534 | 두 사람은 프리큐어 Splash Star | TV | 2006-02-05 |
| 1546 | 네기마!? (2006 TV) | TV | 2006-10-04 |
| 1565 | 포켓몬스터 DP | TV | 2006-09-28 |
| 2213 | 블랙잭 (2004 TV) | TV | 2004-10-11 |
| 2684 | 버저비터 (2007) | TV | 2007-07-04 |
| 2819 | 드래곤 퀘스트 아벨 용자전설 | TV | 1989-12-02 |
| 3281 | 근육맨 근육별 왕위쟁탈 편 | TV | 1991-10-06 |
| 3579 | 겟타로보 (1974) | TV | 1974-04-04 |
| 3667 | 스트라이크 위치스 (2008 TV) | TV | 2008-07-04 |
| 3692 | Yes! 프리큐어 5 GoGo! | TV | 2008-02-03 |
| 4192 | 하야테처럼!! (2기) | TV | 2009-04-04 |
| 4814 | 순정 로맨티카 2기 | TV | 2008-10-12 |
| 5967 | 쾌걸 근육맨 2세 ULTIMATE MUSCLE (2004) | TV | 2004-04-07 |
| 6165 | 화이트 앨범 후반부 | TV | 2009-10-03 |
| 6444 | 레터 비 (1기) | TV | 2009-10-03 |
| 6676 | 아수라 크라잉 2기 | TV | 2009-10-01 |
| 8158 | 게게게의 키타로 지옥 편 | TV | 1988-02-08 |
| 9203 | 케이온!! 우라온!! | SPECIAL | 2010-07-30 |
| 9883 | 오소마츠 군 (1988) | TV | 1988-02-13 |
| 9969 | 은혼' (2011) | TV | 2011-04-04 |
| 10378 | 침략!? 오징어 소녀 (2기) | TV | 2011-09-27 |
| 10447 | 아쿠에리온 EVOL | TV | 2012-01-09 |
| 10507 | 이나즈마 일레븐 GO | TV | 2011-05-04 |
| 10521 | WORKING'!! (2기) | TV | 2011-10-01 |
| 10620 | 미래일기 (2011 TV) | TV | 2011-10-09 |
| 10924 | 퀸즈 블레이드 OVA (2011) | OVA | 2011-10-29 |
| 11021 | 마브러브 얼터너티브 토탈 이클립스 | TV | 2012-07-02 |
| 11179 | 아빠 말 좀 들어라! (2012 TV) | TV | 2012-01-11 |
| 11341 | 탐정 오페라 밀키홈즈 제2막 | TV | 2012-01-05 |
| 11741 | 페이트 제로 2기 | TV | 2012-04-08 |
| 14093 | 포켓몬스터 베스트 위시 시즌 2 | TV | 2012-06-21 |
| 14645 | 비색의 조각 2기 | TV | 2012-09-30 |
| 15417 | 은혼' 연장전 | TV | 2012-10-04 |
| 16385 | DOG DAYS'' (3기) | TV | 2015-01-11 |
| 17389 | 킹덤 2기 | TV | 2013-06-08 |
| 18055 | 팔견전 -동방팔견이문- 2기 | TV | 2013-07-07 |
| 18295 | 혁명기 발브레이브 2기 | TV | 2013-10-10 |
| 19613 | 이니셜 D Final Stage | TV | 2014-05-16 |
| 19703 | 쿄소기가 (2013 TV) | TV | 2013-10-10 |
| 20474 | 죠죠의 기묘한 모험 스타더스트 크루세이더즈 (2014) | TV | 2014-04-05 |
| 20593 | 하나모노가타리 | TV | 2014-08-16 |
| 20666 | 스페이스 댄디 2기 | TV | 2014-07-06 |
| 20762 | 시도니아의 기사 제9행성전역 | TV | 2015-04-11 |
| 20792 | 페이트/스테이 나이트 Unlimited Blade Works 2기 | TV | 2015-04-05 |
| 20801 | 오늘부터 신령님 2기 | TV | 2015-01-06 |
| 20848 | 탐정 가극 밀키홈즈 TD | TV | 2015-01-03 |
| 20853 | 알드노아. 제로 Part 2 | TV | 2015-01-11 |
| 20879 | 듀라라라!!×2 전 | TV | 2015-07-04 |
| 20996 | 은혼° (2015) | TV | 2015-04-08 |
| 21094 | 아이돌 마스터 신데렐라 걸즈 2nd SEASON | TV | 2015-07-18 |
| 21170 | 암살교실 2기 | TV | 2016-01-08 |
| 21180 | 시원찮은 그녀를 위한 육성방법 ♭ (2기) | TV | 2017-04-06 |
| 21241 | 요괴소년 호야 2기 (2016) | TV | 2016-04-01 |
| 21258 | 빨강머리 백설공주 2기 | TV | 2016-01-12 |
| 21287 | 창궁의 파프너 EXODUS Part 2 | TV | 2015-10-03 |
| 21300 | 테라포마스 리벤지 (2016 TV) | TV | 2016-04-02 |
| 21364 | 게이트 - 자위대. 그의 땅에서, 이처럼 싸우며 Part 2 | TV | 2016-01-09 |
| 21390 | 학전도시 애스터리스크 2기 | TV | 2016-04-02 |
| 21394 | 마기 신드바드의 모험 (2016 TV) | TV | 2016-04-16 |
| 21476 | 쇼 바이 락!!# (2기) | TV | 2016-10-02 |
| 21506 | 마법사 프리큐어! | TV | 2016-02-07 |
| 21679 | 문호 스트레이독스 2기 | TV | 2016-10-06 |
| 21733 | 쇼와 겐로쿠 라쿠고 심중 2기 | TV | 2017-01-07 |
| 21745 | 오와리모노가타리 (하) | TV | 2017-08-12 |
| 21799 | 아인 2기 | TV | 2016-10-08 |
| 21839 | 12세 ~작은 가슴의 두근거림~ 2기 | TV | 2016-10-03 |
| 87496 | 케모노 프렌즈 1기 | TV | 2017-01-11 |
| 87498 | 최유기 RELOAD BLAST | TV | 2017-07-05 |
| 87539 | 용의 치과의사 (2017) | SPECIAL | 2017-02-18 |
| 97904 | 츠키프로 디 애니메이션 1기 | TV | 2017-10-04 |
| 98421 | 리루리루 페어리루 ~마법의 거울~ | TV | 2017-04-07 |
| 98436 | 마법사의 신부 (2017 TV) | TV | 2017-10-08 |
| 98438 | 호오즈키의 냉철 2기 | TV | 2017-10-07 |
| 99476 | 겁쟁이 페달 GLORY LINE | TV | 2018-01-09 |
| 99557 | Thunderbolt Fantasy 동리검유기 2기 | TV | 2018-10-01 |
| 100298 | 메갈로 복스 | TV | 2018-04-06 |
| 100745 | 캡틴 츠바사 (2018) | TV | 2018-04-03 |
| 100773 | 식극의 소마 세 번째 접시 토오츠키 열차 편 | TV | 2018-04-09 |
| 100790 | 엉덩이 탐정 (2018) | TV | 2018-05-03 |
| 100791 | 유우키 유우나는 용사다 와시오 스미의 장 (TV) | TV | 2017-10-07 |
| 100957 | 루팡 3세 PART 5 | TV | 2018-04-04 |
| 101046 | 미남고교 지구방위부 HAPPY KISS! | TV | 2018-04-09 |
| 101228 | 조이드 와일드 | TV | 2018-07-07 |
| 101340 | 무효와 로지의 마법률 상담 사무소 1기 | TV | 2018-08-03 |
| 101474 | 오버로드 3기 | TV | 2018-07-10 |
| 101925 | 은혼. 은빛 영혼 편 후반부 | TV | 2018-07-09 |
| 102351 | 도쿄 구울:re Part 2 | TV | 2018-10-09 |
| 102974 | 그라제니 2기 | TV | 2018-10-05 |
| 103713 | 미소녀전사 세일러문 Eternal 전편 | MOVIE | 2021-01-08 |
| 104578 | 진격의 거인 3기 Part 2 | TV | 2019-04-29 |
| 105749 | 다이아몬드 A act II | TV | 2019-04-02 |
| 107447 | 아이카츠 프렌즈! 빛나는 보석 | TV | 2019-04-04 |
| 107651 | A3! Season Spring & Summer | TV | 2020-01-14 |
| 107666 | 요리왕 비룡 더 마스터 1기 | TV | 2019-10-12 |
| 108039 | 기동전사 건담 디 오리진 전야 붉은 혜성 (TV) | TV | 2019-04-29 |
| 108631 | 일하는 세포!! (2기) | TV | 2021-01-08 |
| 111048 | 켄간 아슈라 1기 파트 2 | ONA | 2019-10-31 |
| 112641 | 카구야 님은 고백받고 싶어 2기 | TV | 2020-04-11 |
| 113242 | 듀얼 마스터즈!! (2019) | TV | 2019-04-07 |
| 113538 | 하이큐!! TO THE TOP Part 2 | TV | 2020-10-03 |
| 114308 | 소드 아트 온라인 앨리시제이션 War of Underworld Part 2 | TV | 2020-07-12 |
| 119661 | Re: 제로부터 시작하는 이세계 생활 2기 Part 2 | TV | 2021-01-06 |
| 127721 | 아이돌리쉬 세븐 Third BEAT! 파트 1 | TV | 2021-07-04 |
| 128827 | 카드파이트!! 뱅가드 overDress 시즌 2 | TV | 2021-10-05 |
| 129608 | 더 빅 오 (2003) | TV | 2003-01-02 |
| 130584 | 듀얼 마스터즈 킹! (2021) | TV | 2021-04-04 |
| 130777 | 뮤클드리미 믹스! | TV | 2021-04-11 |
| 155158 | 기동전사 건담 수성의 마녀 2기 | TV | 2023-04-09 |
| 155168 | 알바 뛰는 마왕님!! 2nd Season | TV | 2023-07-13 |
| 155211 | 던전에서 만남을 추구하면 안 되는 걸까 4기 재액 편 | TV | 2023-01-05 |
| 162314 | 진격의 거인 The Final Season 완결편 후편 | SPECIAL | 2023-11-05 |
| 163256 | 듀얼 마스터즈 WIN 듀얼 워즈 | TV | 2023-04-02 |
| 164440 | 어~이! 톤보 1기 | TV | 2024-04-06 |
| 177880 | 오소마츠 씨 4기 | TV | 2025-07-09 |
| 182434 | 5억 년 버튼 Part 2 | TV | 2024-09-30 |
| 183159 | 신비아파트 고스트볼X의 탄생 | TV | 2017-11-09 |
| 185644 | 엉덩이 탐정 8 | TV | 2024-04-06 |
| 209800 | 개진전 사무라이 트루퍼 Part 2 | TV | 2026-07-07 |

## 방영 전 제외 목록

- 106541: Nora to Oujo to Noraneko Heart 2
- 138511: Fate/kaleid liner Prisma☆Illya: FINALE
- 152677: Tantei wa mou, Shindeiru. Season 2
- 153676: SK∞ 2nd Season
- 160803: Mahou Shoujo Ikusei Keikaku: restart
- 165523: BORUTO: NARUTO NEXT GENERATIONS Part 2
- 167151: Sabikui Bisco 2nd Season
- 169579: Sekai Saikou no Ansatsusha, Isekai Kizoku ni Tensei suru 2nd Season
- 172192: Kikansha no Mahou wa Tokubetsu desu 2nd Season
- 176314: Sasaki to Pii-chan Season 2
- 177704: MASHLE: Sanma Taisou Shinkakusha Saishuu Shiken-hen
- 178083: Tokyo Revengers: Santen Sensou-hen
- 178467: Tsuki ga Michibiku Isekai Douchuu 3rd Season
- 179981: Chiyu Mahou no Machigatta Tsukaikata 2nd Season
- 181641: Tokidoki Bosotto Rossiya-go de Dereru Tonari no Alya-san Season 2
- 181951: Ookami to Koushinryou: MERCHANT MEETS THE WISE WOLF 2nd Season
- 182544: Mahou Shoujo ni Akogarete 2nd Season
- 184072: Yuru Camp△ SEASON 4
- 184141: Boukyaku Battery (TV) 2nd Season
- 184376: Death March Kara Hajimaru Isekai Kyousoukyoku (Zoku-hen)
- 185515: 2.5-jigen no Ririsa 2nd Season
- 185657: Skip to Loafer 2nd Season
- 185699: Ramen Aka Neko: Sono ni
- 185756: Tensei Kizoku, Kantei Skill de Nariagaru 3rd Season
- 186336: IDOLiSH7 4th Season
- 186712: Bocchi the Rock! 2nd Season
- 186743: Toaru Kagaku no Railgun 4th Season
- 187924: Kono Subarashii Sekai ni Shukufuku wo! 4
- 188665: Rurouni Kenshin: Meiji Kenkaku Romantan 3rd Season
- 188892: Kuroiwa Medaka ni Watashi no Kawaii ga Tsuujinai 2nd Season
- 189121: BanG Dream! It's MyGO!!!!! / Ave Mujica (Zoku-hen)
- 189123: Ao no Hako Season 2
- 189323: Shangri-La Frontier 3rd Season
- 189796: Make Heroine ga Oosugiru! 2nd Season
- 191788: Aoashi 2nd Season
- 194453: Ninja Kamui: Red Vendetta
- 195210: A-Rank Party wo Ridatsu Shita Ore wa, Moto Oshiegotachi to Meikyuu Shinbu wo Mezasu. 2nd Season
- 195516: Kusuriya no Hitorigoto 3rd Season
- 196893: Kinnikuman: Kanpeki Choujin Shiso-hen Season 3
- 198692: Izure Saikyou no Renkinjutsushi? 2nd Season
- 198727: Chitose-kun wa Ramune Bin no Naka Part 2
- 198966: Dandadan 3rd Season
- 199068: Shin Tennis no Ouji-sama: U-17 WORLD CUP Kesshou Member Ketteisen
- 199185: Tate no Yuusha no Nariagari Season 5
- 199217: Re:Monster 2nd Season
- 199337: Shin Samurai-den YAIBA 2
- 199342: Hikaru ga Shinda Natsu 2nd Season
- 199404: Blue Lock: NEO EGOIST LEAGUE
- 199426: Hotel Inhumans 2nd Season
- 199793: Witch Watch 2nd Season
- 201388: Dark Gathering 2nd Season
- 203855: Saijaku Tamer wa Gomi Hiroi no Tabi wo Hajimemashita. 2nd Season
- 204286: Taiyou yori mo Mabushii Hoshi 2
- 204363: SAKAMOTO DAYS 2nd Season
- 204389: Yasei no Last Boss ga Arawareta! 2nd Season
- 204436: Gachiakuta 2nd Season
- 204604: Undead Unluck 2nd Season
- 204650: Tougen Anki: Nikko・Kegon no Taki-hen
- 204688: Kingdom (Zoku-hen)
- 204747: One Punch Man 3 Part 2
- 205432: Isshun de Chiryou Shiteita no ni Yakutatazu to Tsuihou Sareta Tensai Chiyushi, Yami Healer Toshite Tanoshiku Ikiru 2nd Season
- 206814: Dragon Ball Super: Beerus
- 207385: Dungeon ni Deai wo Motomeru no wa Machigatteiru Darou ka VI
- 209032: Mahou no Shimai LuluttoLilly Part 2
- 209247: Boku no Kokoro no Yabai Yatsu 3rd Season
- 209670: Yuusha Party wo Oidasareta Kiyou Binbou 2nd Season
- 209762: Mayonaka Heart Tune 2nd Season
- 209827: [Oshi no Ko] Final Season
- 209872: Ranma 1/2 (2024) 3rd Season
- 209876: MF Ghost Final Season
- 209939: Sousou no Frieren 3rd Season
- 209963: Yuusha Kei ni Shosu: Choubatsu Yuusha 9004-tai Keimu Kiroku 2nd Season
- 209984: Fate/strange Fake (Zoku-hen)
- 210199: The Fable 2nd Season
- 210483: Isekai Maou to Shoukan Shoujo no Dorei Majutsu ULT
- 211495: Boushoku no Berserk 2nd Season
- 212503: Hyouken no Majutsushi ga Sekai wo Suberu II
- 213360: Akane-banashi 2nd Season
- 213579: Snowball Earth 2nd Season
- 213656: Tsue to Tsurugi no Wistoria Season 3
- 213657: Yozakura-san Chi no Daisakusen 2nd Season Part 2
- 213805: Koori no Jouheki 2nd Season
- 213860: Lv2 Kara Cheat datta Moto Yuusha Kouho no Mattari Isekai Life 2nd Season
- 213872: Hitoribocchi no Isekai Kouryaku 2nd Season
- 214536: Cardfight!! Vanguard Divinez Unmei Seisen-hen
- 214650: Mato Seihei no Slave 3
- 216272: Tefuda ga Oome no Victoria 2

## 재생성·복구

작업 증거와 재실행 파일: `D:/hong/Web/Anime/.moemoa-missing-batch-2026-09-08`. dom-captures.json은 224개 관찰 기록, decisions.json은 225개 판단, items는 131개 target/capture/canonical/materialized, lab은 원본·정규화·canonical·표지, before/prepared/upload-verified/activation/public-verification.json은 운영 검증 증거다.

**다음 전체 카탈로그 생성에는 이 보충 lab/target 131개와 기존 니세코이·5등분 보충본을 포함해야 한다.** 기본 seed manifest에 자동 합쳐진 상태가 아니다. 새 수집으로 canonical hash가 바뀌면 제목 검토도 다시 해야 한다.

롤백: 같은 관리 환경에서 `node D:/hong/Web/Anime/.moemoa-missing-batch-2026-09-08/db-batch.mjs rollback`. 직전 release를 보존했다. 사용자 데이터·계정·스키마 변경 없음. Web 소스의 배포 변경 없이 동적 운영 카탈로그에 적용했다. 커밋/push 없음.

## 기존 표기 후속 검토

기존 `anime:6f35de11-7c3f-4082-a321-9bf82c09e67d`는 표시명 테라포마스 리벤지지만 AniList 20630/2014년 2화 OVA로 연결돼 있다. 이번 신규 21300은 별도 2016 TV이며 표시명을 테라포마스 리벤지 (2016 TV)로 구별했다. 기존 작품의 한국어 표시명 수정은 이 비파괴 추가 release에 포함하지 않았다.
