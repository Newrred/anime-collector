# 유사 누락 후보 감사 — 2026-09-08

대상 release: catalog-add-cfd7de57fd596c974547fb15. 운영 반영된 4,161개 작품의 저장된 애니메이션 관계 6,868개를 대조했다. 실제 운영 반영 결과는 복원 보고서를 참조한다.

## 우선 검토: 제거한 별칭의 대상 미수록 24건

교정 기록의 제외 별칭과 관련작 원제가 일치하며, 해당 AniList ID 및 다른 작품의 동일 제목/별칭이 현재 카탈로그에서 발견되지 않은 후보다. 제목의 콜론·물음표·기호는 보존했다. 아래는 자동 탐지 결과이며, 정식 제목·시즌·표지 및 다른 공급자 ID의 중복을 검토하기 전에는 자동 추가하지 않는다.

| 검토용 ID | 관련작 원제 | 형식 | 운영에 있는 연결 작품 |
| --- | --- | --- | --- |
| 6444 | Tegami Bachi | TV | 레터 비 리버스, Letter Bee: Light and Blue Night Fantasy |
| 6676 | Asura Cryin' 2 | TV | 아수라 크라잉 1기 |
| 8577 | Aki-Sora: Yume no Naka | OVA | 아키소라 |
| 9203 | K-ON!!: Ura-On!! | SPECIAL | 케이온!! (2기), 케이온! 스페셜 |
| 10378 | Shinryaku!? Ika Musume | TV | 침략!! 오징어 소녀 OVA, 침략! 오징어 소녀 |
| 10924 | Queen's Blade OVA | OVA | 퀸즈 블레이드: 아름다운 투사들, 퀸즈 블레이드 리벨리온 |
| 16385 | Dog Days'' | TV | DOG DAYS'(2기) |
| 18055 | Hakkenden: Touhou Hakken Ibun 2 | TV | 팔견전 -동방팔견이문- |
| 19703 | Kyousougiga (TV) | TV | 쿄소기가, 쿄소기가 특별편 |
| 20801 | Kamisama Hajimemashita◎ | TV | [OAD]오늘부터 신령님 2기, 오늘부터 신령님 1기 |
| 21180 | Saenai Heroine no Sodatekata ♭ | TV | 시원찮은 그녀를 위한 육성방법, [극장판]시원찮은 그녀를 위한 육성방법 피날레 |
| 21679 | Bungou Stray Dogs 2nd Season | TV | 문호 스트레이독스 3기, 문호 스트레이독스, [극장판]문호 스트레이독스 DEAD APPLE |
| 21733 | Shouwa Genroku Rakugo Shinjuu: Sukeroku Futatabi-hen | TV | 쇼와 겐로쿠 라쿠고 심중 |
| 21799 | Ajin 2 | TV | 아인 1기 |
| 21839 | 12-sai.: Chiccha na Mune no Tokimeki 2 | TV | 12세 ~작은 가슴의 두근거림~ |
| 87539 | Ryuu no Haisha | SPECIAL | Japan Anima(tor)’s Exhibition |
| 98436 | Mahoutsukai no Yome | TV | The Ancient Magus' Bride: Those Awaiting a Star, 마법사의 신부: 서쪽의 소년과 청람의 기사 |
| 101474 | Overlord III | TV | 플레플레 플레이아데스 3, 오버로드 2기, 오버로드 IV |
| 103713 | Bishoujo Senshi Sailor Moon: Eternal - Zenpen | MOVIE | Pretty Guardian Sailor Moon Eternal The Movie Part 2, 미소녀전사 세일러문 Crystal - 3부 |
| 108631 | Hataraku Saibou!! | TV | 일하는 세포 |
| 111048 | Kengan Ashura Part 2 | ONA | 겐간 아슈라 2기 파트 1, 켄간 아슈라 1기 파트 1 |
| 112641 | Kaguya-sama wa Kokurasetai?: Tensaitachi no Renai Zunousen | TV | [OVA]카구야 님은 고백받고 싶어 ~천재들의 연애 두뇌전~ (2기), 카구야 님은 고백받고 싶어 -울트라 로맨틱-, 카구야 님은 고백받고 싶어 ~천재들의 연애 두뇌전~ |
| 130584 | DUEL MASTERS King! | TV | 듀얼 마스터즈 킹 |
| 162314 | Shingeki no Kyojin: The Final Season - Kanketsu-hen Kouhen | SPECIAL | Attack on Titan Final Season THE FINAL CHAPTERS Special 1 |

## 추가 분류

- TV 전후 시즌 관계의 미수록 후보: 201건
- ID는 없지만 다른 작품에 같은 제목이 있어 중복 검토가 필요한 후보: 24건
- OVA·극장판·특별편 등을 포함한 나머지 관련작: 2302건

위 범주는 서로 배타적이다. 모든 작품이 수록 대상 또는 이미 방영된 작품이라는 의미는 아니다. 이 검사는 운영에 저장된 관계만 대조하므로 관계 자체가 빠진 작품, 한국어만으로 등록된 같은 작품, 최신 미수집 시즌은 별도 검증이 필요하다.

전체 기계 판독 결과: D:/hong/Web/Anime/.moemoa-nisekoi-s2-2026-09-08/missing-after.json

재실행: tools/catalog-lab/reports/missing-related-works.mjs 에 최신 release snapshot, title-identity-reviews.json, 출력 JSON 경로를 전달한다. 네트워크 수집이나 DB 쓰기를 하지 않는다.

## TV 시즌 후보 전체

| 검토용 ID | 관련작 원제 | 형식 | 운영에 있는 연결 작품 |
| --- | --- | --- | --- |
| 67 | Basilisk: Kouga Ninpouchou | TV | 바질리스크 ~오우카인법첩~ |
| 94 | Kidou Senshi Gundam SEED DESTINY | TV | 기동전사 건담 SEED FREEDOM, 기동전사 건담 SEED |
| 97 | Last Exile | TV | 라스트 엑자일-은빛날개의 팜 |
| 298 | .hack//Tasogare no Udewa Densetsu | TV | 닷핵 루츠! |
| 352 | Motto! Ojamajo Doremi | TV | 꼬마마법사 레미 ƒ 스페셜 -개구리 바위의 비밀-, 꼬마마법사 레미 # |
| 390 | Suzuka | TV | 후우카 |
| 551 | Grappler Baki: Saidai Tournament-hen | TV | 바키 1기 |
| 849 | Suzumiya Haruhi no Yuuutsu | TV | 스즈미야 하루히의 우울 1~2기, 러키 스타, [극장판]스즈미야 하루히의 소실 |
| 878 | Zegapain | TV | 제가페인 STA |
| 1018 | Majutsushi Orphen: Revenge | TV | 마술사 오펜 뜻밖의 여행 |
| 1088 | Choujikuu Yousai Macross | TV | 마크로스 제로 |
| 1104 | Shinkon Gattai Godannar!! SECOND SEASON | TV | 신혼합체 고단나 |
| 1186 | Battle Athletess Daiundoukai (TV) | TV | 배틀 애슬리테스 대운동회 ReSTART! |
| 1519 | BLACK LAGOON: The Second Barrage | TV | 블랙 라군, [SP]블랙 라군, [OVA]블랙 라군 - 로베르타즈 블러드 트레일 |
| 1534 | Futari wa Precure: Splash☆Star | TV | 극장판 프리큐어 올스타즈 F, 너와 아이돌 프리큐어♪, 명탐정 프리큐어!, 스타☆트윙클 프리큐어, 힐링굿♡프리큐어, 허긋토! 프리큐어 ♡ 두사람은 프리큐어 올스타즈 메모리즈, 희망의 힘 ~어른 프리큐어'23~, 허긋토! 프리큐어, 펼쳐지는 스카이! 프리큐어 |
| 1546 | Negima!? | TV | 마법선생 네기마 1기, UQ HOLDER! -마법선생 네기마 2 |
| 1565 | Pocket Monsters Diamond & Pearl | TV | 포켓몬스터 AG, 포켓몬스터 베스트 위시 |
| 2213 | Black Jack (TV) | TV | 영 블랙잭 |
| 2684 | BUZZER BEATER (2007) | TV | 버저비터 |
| 2819 | Dragon Quest: Abel Yuusha Densetsu | TV | 드래곤 퀘스트 다이의 대모험 (2020) |
| 3281 | Kinnikuman: Kinnikusei Oui Soudatsu-hen | TV | (더빙) 쾌걸 근육맨 2세, 근육맨 완벽초인시조 편(3기) |
| 3579 | Getter Robo | TV | 겟타로보 아크 |
| 3667 | Strike Witches | TV | 브레이브 위치스, 스트라이크 위치스 501부대 발진합니다!, 연맹공군 항공마법 음악대 루미너스 위치즈, 스트라이크 위치스 1기, 스트라이크 위치스 2기 |
| 3692 | Yes! Precure 5 GoGo! | TV | 극장판 프리큐어 올스타즈 F, 쁘띠큐어: 프리큐어 요정들, 희망의 힘 ~어른 프리큐어'23~ |
| 4192 | Hayate no Gotoku!! | TV | 극장판 하야테처럼! HEAVEN IS A PLACE ON EARTH |
| 4814 | Junjou Romantica 2 | TV | 순정 로맨티카 3기 |
| 5967 | Kinnikuman II Sei: ULTIMATE MUSCLE | TV | (더빙) 쾌걸 근육맨 2세 |
| 6165 | WHITE ALBUM 2nd Season | TV | 화이트 앨범 |
| 8158 | Gegege no Kitarou: Jigoku-hen | TV | 게게게의 키타로 6기 |
| 9883 | Osomatsu-kun (1988) | TV | 오소마츠 씨 |
| 9969 | Gintama' | TV | 은혼 온 시어터 2D 바라가키 편, 스켓 댄스, 은혼 |
| 10447 | Aquarion EVOL | TV | 아쿠에리온 로고스, 창성의 아쿠에리온 |
| 10507 | Inazuma Eleven GO | TV | 이나즈마 일레븐 |
| 10521 | WORKING'!! | TV | WORKING!! 1기 |
| 10620 | Mirai Nikki | TV | [스페셜]미래일기 리다이얼, 미래일기 |
| 11021 | Muv-Luv Alternative: Total Eclipse | TV | 마브러브 얼터너티브 1기, 슈바르체스마켄! |
| 11179 | Papa no Iukoto wo Kikinasai! | TV | 아빠 말 좀 들어라! |
| 11341 | Tantei Opera Milky Holmes Dai 2 Maku | TV | 두 사람은 밀키홈즈(3기) |
| 11741 | Fate/Zero 2nd Season | TV | 부탁해! 아인츠베른 상담실, 페이트/스테이 나이트, [극장판]페이트/스테이 나이트 [헤븐즈 필] 제1장, 페이트/스테이 나이트 UBW [언리미티드 블레이드 워크스], 페이트 제로, [극장판]페이트/스테이 나이트 UBW [언리미티드 블레이드 워크스], 로드 엘멜로이 2세의 사건부: [레일 체펠린] 그레이스 노트 |
| 14093 | Pocket Monsters Best Wishes! Season 2 | TV | 포켓몬스터 베스트 위시 |
| 14645 | Hiiro no Kakera Dai Ni Shou | TV | 비색의 조각 1기 |
| 15417 | Gintama': Enchousen | TV | 은혼 On Theater 2D 일국경성편, 극장판 은혼 온 시어터 2D 금혼편, 은혼 극장판 2기 : 해결사여 영원하라 |
| 17389 | Kingdom 2nd Season | TV | 킹덤 1기, 킹덤 3기 |
| 18295 | Kakumeiki Valvrave 2 | TV | 혁명기 발브레이브 |
| 19613 | Initial D Final Stage | TV | 이니셜D Fifth Stage, MF고스트 |
| 20181 | Aikatsu! 2 | TV | 아이카츠 3 ~4기, 아이카츠 1~2기, 아이카츠 온 퍼레이드! OVA |
| 20474 | JoJo no Kimyou na Bouken: Stardust Crusaders | TV | 죠죠의 기묘한 모험, 죠죠의 기묘한 모험: 스타더스트 크루세이더즈 |
| 20593 | Hanamonogatari | TV | 속·오와리모노가타리 |
| 20666 | Space☆Dandy 2 | TV | 스페이스 댄디 1기 |
| 20762 | Sidonia no Kishi: Daikyuu Wakusei Seneki | TV | 시도니아의 기사 -사랑을 잣는 별- |
| 20792 | Fate/stay night: Unlimited Blade Works 2nd Season | TV | 페이트/스테이 나이트 UBW [언리미티드 블레이드 워크스] |
| 20848 | Tantei Kageki Milky Holmes TD | TV | 두 사람은 밀키홈즈(3기) |
| 20853 | Aldnoah.Zero Part 2 | TV | 알드노아 제로 비의 단장 -The Penultimate Truth-, 알드노아. 제로 (Re+), 알드노아. 제로 |
| 20879 | Durarara!!x2 Ten | TV | 듀라라라!!×2 |
| 20996 | Gintama° | TV | 은혼 극장판 2기 : 해결사여 영원하라 |
| 21004 | Kaitou Joker 2 | TV | (더빙판)괴도 조커 1~4기 |
| 21094 | THE IDOLM@STER Cinderella Girls 2nd SEASON | TV | 아이돌 마스터 신데렐라 걸즈 |
| 21170 | Ansatsu Kyoushitsu 2nd Season | TV | 극장판 암살교실: 365일의 시간, 암살교실 1기, 쿠로코의 농구 1기, 사이키 쿠스오의 재난 |
| 21241 | Ushio to Tora 2 (TV) | TV | 요괴소년 호야 |
| 21258 | Akagami no Shirayuki-hime 2nd Season | TV | 빨강머리 백설공주 |
| 21287 | Soukyuu no Fafner: EXODUS 2 | TV | 창궁의 파프너 THE BEYOND, 창궁의 파프너 EXODUS |
| 21300 | Terra Formars: Revenge | TV | 테라포마스 |
| 21307 | Aikatsu! 4 | TV | 아이카츠 3 ~4기, 아이카츠! 10th STORY~미래에의 STARWAY~ |
| 21364 | GATE: Jieitai Kanochi nite, Kaku Tatakaeri Part 2 | TV | 게이트 - 자위대. 그의 땅에서, 이처럼 싸우며 |
| 21390 | Gakusen Toshi Asterisk 2 | TV | 학전도시 애스터리스크 |
| 21394 | Magi: Sinbad no Bouken | TV | 마기, 마기 신드바드의 모험 (2016) |
| 21476 | SHOW BY ROCK!!# | TV | 쇼 바이 락!! Mashumairesh!!, 쇼 바이 락!! (1기) |
| 21506 | Mahoutsukai Precure! | TV | 마법사 프리큐어!! ~미래의 날들~, 극장판 프리큐어 올스타즈 F, 쁘띠큐어: 프리큐어 요정들, 너와 아이돌 프리큐어♪, 원더풀 프리큐어! 더 무비!, 명탐정 프리큐어!, 스타☆트윙클 프리큐어, 힐링굿♡프리큐어, 허긋토! 프리큐어 ♡ 두사람은 프리큐어 올스타즈 메모리즈, 허긋토! 프리큐어, 펼쳐지는 스카이! 프리큐어 |
| 21745 | Owarimonogatari (Ge) | TV | 속·오와리모노가타리, [스페셜]츠키모노가타리 |
| 87496 | Kemono Friends | TV | 케모노 프렌즈 2기 |
| 87498 | Saiyuuki RELOAD BLAST | TV | 최유기 RELOAD -ZEROIN- |
| 97904 | TSUKIPRO THE ANIMATION | TV | 츠키우타 The ANIMATION 2, 바즈록 디 애니메이션, 츠키프로 디 애니메이션 2 |
| 98421 | Rilu Rilu Fairilu: Mahou no Kagami | TV | (더빙)리루리루 페어리루 ~요정의 문~ |
| 98438 | Hoozuki no Reitetsu 2 | TV | 호오즈키의 냉철 |
| 99476 | Yowamushi Pedal: GLORY LINE | TV | 겁쟁이 페달 LIMIT BREAK, 겁쟁이 페달 NEW GENERATION |
| 99557 | Thunderbolt Fantasy: Touriken Yuuki 2 | TV | Thunderbolt Fantasy 동리검유기 3기 |
| 100298 | Megalo Box | TV | NOMAD 메갈로 복스 2기 |
| 100745 | Captain Tsubasa (2018) | TV | 캡틴 츠바사 시즌 2 주니어 유스 편 |
| 100773 | Shokugeki no Souma: San no Sara - Tootsuki Ressha-hen | TV | 식극의 소마 네 번째 접시, 식극의 소마 세 번째 접시 |
| 100790 | Oshiri Tantei | TV | 엉덩이 탐정: 별과 달, 극장판 엉덩이 탐정 작별, 사랑스런 파트너(엉덩이)여, 엉덩이 댄디 : 젊은 시절 |
| 100791 | Yuuki Yuuna wa Yuusha de Aru: Washio Sumi no Shou | TV | 유우키 유우나는 용사다, [극장판]유우키 유우나는 용자다 -와시오 스미의 장- 제3장 약속, 유우키 유우나는 용사다 츄룻토!, [극장판]유우키 유우나는 용자다 -와시오 스미의 장- 제1장 친구, [극장판]유우키 유우나는 용자다 -와시오 스미의 장- 제2장 영혼 |
| 100957 | Lupin III: PART 5 | TV | 루팡 3세 PART 6 |
| 101046 | Binan Koukou Chikyuu Bouei-bu HAPPY KISS! | TV | 극장판 미남고교 지구방위부 ETERNAL LOVE!, 미남고교 지구방위부 하이카라! |
| 101228 | Zoids Wild | TV | 조이드 와일드 제로 |
| 101340 | Muhyo to Rouji no Mahouritsu Soudan Jimusho | TV | 무효와 로지의 마법률 상담 사무소 2기 |
| 101925 | Gintama.: Shirogane no Tamashii-hen - Kouhan-sen | TV | 은혼 더 세미 파이널 |
| 102351 | Tokyo Ghoul:re 2 | TV | 도쿄 구울:re |
| 102974 | Gurazeni 2 | TV | 그라제니 1기 |
| 104578 | Shingeki no Kyojin Season 3 Part 2 | TV | 진격의 거인 3기, 극장판 진격의 거인 ~크로니클~, 진격의 거인 The Final Season |
| 105749 | Diamond no Ace act II | TV | 다이아몬드A 2기 |
| 106541 | Nora to Oujo to Noraneko Heart 2 | TV | 노라와 황녀와 길고양이 하트 |
| 107447 | Aikatsu Friends!: Kagayaki no Jewel | TV | 아이카츠 온 퍼레이드! |
| 107651 | A3! SEASON SPRING & SUMMER | TV | A3! SEASON AUTUMN & WINTER |
| 107666 | Shin Chuuka Ichiban! | TV | 요리왕 비룡 더 마스터 2기 |
| 108039 | Kidou Senshi Gundam: THE ORIGIN - Zenya Akai Suisei | TV | 기동전사 건담 디 오리진, 기동전사 건담 |
| 113242 | Duel Masters!! | TV | 듀얼 마스터즈 킹 |
| 113538 | Haikyuu!! TO THE TOP 2 | TV | 하이큐!! TO THE TOP, 극장판 하이큐 쓰레기장의 결전 |
| 114308 | Sword Art Online: Alicization - War of Underworld Part 2 | TV | 소드 아트 온라인 앨리시제이션 War of Underworld |
| 119661 | Re:Zero kara Hajimeru Isekai Seikatsu 2nd Season Part 2 | TV | Re: 제로부터 시작하는 이세계 생활 2nd Season, Re: 제로부터 시작하는 이세계 생활 3기 |
| 127721 | IDOLiSH7: Third BEAT! | TV | 아이돌리쉬7 Second BEAT!, 아이돌리쉬 세븐 Third BEAT! 파트 2 |
| 128827 | Cardfight!! Vanguard: overDress Season 2 | TV | 카드파이트!! 뱅가드 will+Dress, 카드파이트!! 뱅가드 overDress |
| 129608 | THE Big O (2003) | TV | 더 빅 오 |
| 130777 | Mewkledreamy Mix! | TV | 꿈속의 뮤 |
| 138511 | Fate/kaleid liner Prisma☆Illya: FINALE | TV | 극장판 Fate/kaleid liner 프리즈마☆이리야 Licht 이름없는 소녀 |
| 149939 | Ranma 1/2: Nettou-hen | TV | 란마1/2 2기, 란마 1/2 (2024), 란마 1⁄2 |
| 152677 | Tantei wa mou, Shindeiru. Season 2 | TV | 탐정은 이미 죽었다 1기 |
| 153676 | SK∞ 2nd Season | TV | SK∞ 에스케이 에이트 |
| 155158 | Kidou Senshi Gundam: Suisei no Majo Season 2 | TV | 기동전사 건담 수성의 마녀 |
| 155168 | Hataraku Maou-sama!! 2nd Season | TV | 알바 뛰는 마왕님!! |
| 155211 | Dungeon ni Deai wo Motomeru no wa Machigatteiru Darou ka IV: Shin Shou Yakusai-hen | TV | 던전에서 만남을 추구하면 안 되는 걸까 4기, 던전에서 만남을 추구하면 안 되는 걸까 5기 |
| 160803 | Mahou Shoujo Ikusei Keikaku: restart | TV | 마법소녀 육성계획 |
| 163256 | Duel Masters WIN: Duel Wars | TV | 듀얼 마스터즈 LOST - 추억의 수정 |
| 164440 | Ooi! Tonbo | TV | 어~이! 톤보 2기 |
| 165523 | BORUTO: NARUTO NEXT GENERATIONS Part 2 | TV | 보루토: 나루토 넥스트 제너레이션즈 |
| 167151 | Sabikui Bisco 2nd Season | TV | 녹을 먹는 비스코 |
| 169579 | Sekai Saikou no Ansatsusha, Isekai Kizoku ni Tensei suru 2nd Season | TV | 세계 최고의 암살자, 이세계 귀족으로 전생하다 |
| 172192 | Kikansha no Mahou wa Tokubetsu desu 2nd Season | TV | (더빙)귀환자의 마법은 특별해야 합니다 |
| 176314 | Sasaki to Pii-chan Season 2 | TV | 사사키와 피짱 |
| 177704 | MASHLE: Sanma Taisou Shinkakusha Saishuu Shiken-hen | TV | 마슐: 신각자 후보 선발시험 편 |
| 177880 | Osomatsu-san 4th Season | TV | 오소마츠 씨 3기 |
| 178083 | Tokyo Revengers: Santen Sensou-hen | TV | 도쿄 리벤저스: 천축편 |
| 178467 | Tsuki ga Michibiku Isekai Douchuu 3rd Season | TV | 달이 이끄는 이세계 여행 제2막 |
| 179981 | Chiyu Mahou no Machigatta Tsukaikata 2nd Season | TV | 치유마법의 잘못된 사용법 |
| 181641 | Tokidoki Bosotto Rossiya-go de Dereru Tonari no Alya-san Season 2 | TV | 가끔씩 툭하고 러시아어로 부끄러워하는 옆자리의 아랴 양 |
| 181951 | Ookami to Koushinryou: MERCHANT MEETS THE WISE WOLF 2nd Season | TV | 늑대와 향신료 MERCHANT MEETS THE WISE WOLF |
| 182434 | 5-Oku-nen Button Part 2 | TV | 5억 년 버튼 ~스가하라 소타의 숏숏~ |
| 182544 | Mahou Shoujo ni Akogarete 2nd Season | TV | (무삭제)마법소녀를 동경해서 |
| 183159 | Sinbi Apateu: Ghost Ball X-ui Tansaeng | TV | [극장판]신비아파트:금빛도깨비와 비밀의 동굴 |
| 184072 | Yuru Camp△ SEASON 4 | TV | 유루캠△ 3기 |
| 184141 | Boukyaku Battery (TV) 2nd Season | TV | 망각 배터리 |
| 184376 | Death March Kara Hajimaru Isekai Kyousoukyoku (Zoku-hen) | TV | 데스마치에서 시작하는 이세계 광상곡 |
| 185515 | 2.5-jigen no Ririsa 2nd Season | TV | 2.5차원의 유혹 |
| 185644 | Oshiri Tantei 8 | TV | 엉덩이 탐정 9 |
| 185657 | Skip to Loafer 2nd Season | TV | 스킵과 로퍼 |
| 185699 | Ramen Aka Neko: Sono ni | TV | 라멘 아카네코 |
| 185756 | Tensei Kizoku, Kantei Skill de Nariagaru 3rd Season | TV | 전생 귀족, 감정 스킬로 성공하다 2기 |
| 186336 | IDOLiSH7 4th Season | TV | 아이돌리쉬 세븐 Third BEAT! 파트 2 |
| 186712 | Bocchi the Rock! 2nd Season | TV | BOCCHI THE ROCK! Recap Part 2, 봇치 더 록! |
| 186743 | Toaru Kagaku no Railgun 4th Season | TV | 어떤 과학의 초전자포 T |
| 187924 | Kono Subarashii Sekai ni Shukufuku wo! 4 | TV | 이 멋진 세계에 축복을! 3 |
| 188665 | Rurouni Kenshin: Meiji Kenkaku Romantan 3rd Season | TV | 바람의 검심 -메이지 검객 낭만기- 교토동란 |
| 188892 | Kuroiwa Medaka ni Watashi no Kawaii ga Tsuujinai 2nd Season | TV | 쿠로이와 메다카에게 내 귀여움이 통하지 않아 |
| 189121 | BanG Dream! It's MyGO!!!!! / Ave Mujica (Zoku-hen) | TV | 뱅드림! Ave Mujica |
| 189123 | Ao no Hako Season 2 | TV | 푸른 상자 |
| 189323 | Shangri-La Frontier 3rd Season | TV | 샹그릴라 프론티어 ~망겜 헌터, 갓겜에 도전하다~ 2기 |
| 189796 | Make Heroine ga Oosugiru! 2nd Season | TV | 패배 히로인이 너무 많아! |
| 191788 | Aoashi 2nd Season | TV | 아오아시 |
| 194453 | Ninja Kamui: Red Vendetta | TV | 닌자 카무이 |
| 195210 | A-Rank Party wo Ridatsu Shita Ore wa, Moto Oshiegotachi to Meikyuu Shinbu wo Mezasu. 2nd Season | TV | A랭크 파티를 이탈한 나는, 전 제자들과 미궁 심부를 목표로 한다. |
| 195516 | Kusuriya no Hitorigoto 3rd Season | TV | 약사의 혼잣말 2기 |
| 196893 | Kinnikuman: Kanpeki Choujin Shiso-hen Season 3 | TV | 근육맨 완벽초인시조 편 2기 |
| 197824 | Isekai Nonbiri Nouka 2 | TV | 이세계 유유자적 농가 |
| 198692 | Izure Saikyou no Renkinjutsushi? 2nd Season | TV | 언젠가 최강의 연금술사? |
| 198727 | Chitose-kun wa Ramune Bin no Naka Part 2 | TV | 치토세 군은 라무네 병 속에 |
| 198966 | Dandadan 3rd Season | TV | 단다단 제2기 |
| 199068 | Shin Tennis no Ouji-sama: U-17 WORLD CUP Kesshou Member Ketteisen | TV | 신 테니스의 왕자 U-17 WORLD CUP SEMIFINAL |
| 199185 | Tate no Yuusha no Nariagari Season 5 | TV | 방패 용사 성공담 4기 |
| 199217 | Re:Monster 2nd Season | TV | 리 몬스터 |
| 199337 | Shin Samurai-den YAIBA 2 | TV | 진 사무라이전 야이바 |
| 199342 | Hikaru ga Shinda Natsu 2nd Season | TV | 히카루가 죽은 여름 |
| 199404 | Blue Lock: NEO EGOIST LEAGUE | TV | 블루 록 VS. U-20 JAPAN |
| 199426 | Hotel Inhumans 2nd Season | TV | 호텔 인휴먼즈 |
| 199793 | Witch Watch 2nd Season | TV | 위치 워치 |
| 201388 | Dark Gathering 2nd Season | TV | 다크 개더링 |
| 203855 | Saijaku Tamer wa Gomi Hiroi no Tabi wo Hajimemashita. 2nd Season | TV | 최약 테이머는 폐지 줍는 여행을 시작했습니다 |
| 204286 | Taiyou yori mo Mabushii Hoshi 2 | TV | 태양보다 눈부신 별 |
| 204363 | SAKAMOTO DAYS 2nd Season | TV | 사카모토 데이즈 파트2 |
| 204389 | Yasei no Last Boss ga Arawareta! 2nd Season | TV | 야생의 라스트 보스가 나타났다! |
| 204436 | Gachiakuta 2nd Season | TV | 가치아쿠타 |
| 204604 | Undead Unluck 2nd Season | TV | 언데드 언럭 Winter편 |
| 204650 | Tougen Anki: Nikko・Kegon no Taki-hen | TV | 도원암귀 |
| 204688 | Kingdom (Zoku-hen) | TV | 킹덤 6 |
| 204747 | One Punch Man 3 Part 2 | TV | 원펀맨 3기 |
| 205432 | Isshun de Chiryou Shiteita no ni Yakutatazu to Tsuihou Sareta Tensai Chiyushi, Yami Healer Toshite Tanoshiku Ikiru 2nd Season | TV | 순식간에 치유해줬더니 쓸모없다며 추방당한 천재 치유사, 어둠의 힐러로 즐겁게 살다 |
| 206814 | Dragon Ball Super: Beerus | TV | 드래곤볼 슈퍼, 드래곤볼 Z, 드래곤볼 Z KAI |
| 207385 | Dungeon ni Deai wo Motomeru no wa Machigatteiru Darou ka VI | TV | 던전에서 만남을 추구하면 안 되는 걸까 5기 |
| 209032 | Mahou no Shimai LuluttoLilly Part 2 | TV | 마법의 자매 룰루토 릴리 |
| 209247 | Boku no Kokoro no Yabai Yatsu 3rd Season | TV | 내 마음의 위험한 녀석 2기, 극장판 내 마음의 위험한 녀석 |
| 209670 | Yuusha Party wo Oidasareta Kiyou Binbou 2nd Season | TV | 용사 파티에서 쫓겨난 다재무능 |
| 209762 | Mayonaka Heart Tune 2nd Season | TV | 한밤중 하트튠 |
| 209800 | Yoroi Shinden Samurai Troopers Part 2 | TV | 개진전 사무라이 트루퍼 |
| 209827 | [Oshi no Ko] Final Season | TV | 【최애의 아이】 3기 |
| 209872 | Ranma 1/2 (2024) 3rd Season | TV | 란마1/2 2기 |
| 209876 | MF Ghost Final Season | TV | MF고스트 3기 |
| 209939 | Sousou no Frieren 3rd Season | TV | 장송의 프리렌 2기 |
| 209963 | Yuusha Kei ni Shosu: Choubatsu Yuusha 9004-tai Keimu Kiroku 2nd Season | TV | 용사형에 처함 징벌용사 9004부대 형무기록 |
| 209984 | Fate/strange Fake (Zoku-hen) | TV | 페이트/스트레인지 페이크 |
| 210199 | The Fable 2nd Season | TV | 더 페이블 |
| 210483 | Isekai Maou to Shoukan Shoujo no Dorei Majutsu ULT | TV | 이세계 마왕과 소환 소녀의 노예 마술 Ω |
| 211495 | Boushoku no Berserk 2nd Season | TV | 폭식의 베르세르크 |
| 212503 | Hyouken no Majutsushi ga Sekai wo Suberu II | TV | 빙검의 마술사가 세계를 다스린다 |
| 213360 | Akane-banashi 2nd Season | TV | 아카네 이야기 |
| 213579 | Snowball Earth 2nd Season | TV | 스노우볼 어스 |
| 213656 | Tsue to Tsurugi no Wistoria Season 3 | TV | 지팡이와 검의 위스토리아 2기 |
| 213657 | Yozakura-san Chi no Daisakusen 2nd Season Part 2 | TV | 요자쿠라 일가의 대작전 2기 |
| 213805 | Koori no Jouheki 2nd Season | TV | 얼음 성벽 |
| 213860 | Lv2 Kara Cheat datta Moto Yuusha Kouho no Mattari Isekai Life 2nd Season | TV | Lv2부터 치트였던 전직 용사 후보의 유유자적 이세계 라이프 |
| 213872 | Hitoribocchi no Isekai Kouryaku 2nd Season | TV | 외톨이의 이세계 공략 |
| 214536 | Cardfight!! Vanguard Divinez Unmei Seisen-hen | TV | 카드파이트!! 뱅가드 Divinez 세이센 편 |
| 214650 | Mato Seihei no Slave 3 | TV | 마도정병의 슬레이브 2기 |
| 216272 | Tefuda ga Oome no Victoria 2 | TV | 히든 카드가 많은 빅토리아 |
