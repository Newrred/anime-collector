# 증분 226건 개별 검토 기록

226건 전부 원본 제목·시즌·표지와 기존 3,999건을 대조했다. 판정: 신규 반영 161, 중복 제외 42, 자막 합본 제외 1, 보류 22. 이는 모든 항목이 정확하다는 보증이 아니라 공개 여부를 근거에 따라 구분한 결과다.

신규 후보 125건에서 형식·화수·방영 정보 등 225개 필드를 교정했다. 원본 canonical은 변경하지 않았으며, hash로 연결된 검토 근거에 따라 서비스용 데이터에 교정값을 적용했다. 확인되지 않은 값은 비웠다. AniList 새 연결을 임의 생성하지 않았다.

검토 원본·표지 비교·배포 데이터 및 복구본: `D:/hong/Web/Anime/.moemoa-increment226-review-2026-09-07/`. `reviewed.json`은 226개 판정과 원본 hash/근거, `materialized.json`은 161개 공개 데이터와 변경값, `before.json`은 운영 3,999건 백업이다.

검증: canonical 226개 hash, enrichment 226개 evidence hash, 신규 표지 161개 파일의 MIME/크기/hash 확인. 관련 테스트 38 통과, 1 skip, 실패 0. 기존 3,999건의 모든 테이블 값을 release ID 외에는 변경하지 않음을 비교했다.

AniList API 추가 조회는 HTTP 403 및 서비스 안정성 장애 메시지로 실패했다. 저장된 AniList 원본과 제작사/방송사 공식 자료를 사용했고, 방송판·배포판·합본의 정체가 확정되지 않은 22건은 게시하지 않았다.

운영 DB 배포 및 실제 웹 검증 완료. 신규 161건을 추가해 총 4,160건이다. 자세한 배포 증거는 문서 하단에 기록했다.

|번호|원본 제목|판정|근거/변경|
|---|---|---|---|
|1|놓친 물고기는 컸지만 잡은 물고기가 너무 컸던 건|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|2|니디 걸 오버도즈|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate|
|3|다다미 한 장짜리 방 만끽 생활!|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|4|다이아몬드 에이스 ACT 2 Second Season|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate|
|5|닥터 스톤 SCIENCE FUTURE part3|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|6|네가 죽을 때까지 사랑하고 싶어|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|7|슈퍼 뒤에서 담배 피우는 두 사람|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|8|어서 오세요 실력지상주의 교실에 4th Season 2학년 편 1학기|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate|
|9|히로인? 성녀? 아니요, 올 워크스 메이드 입니다! (자랑)|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, episodeCount|
|10|낙제 현자의 학원 무쌍 ~두 번 전생한 최강 현자, 400년 후의 세계를 마검으로 무쌍~|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, episodeCount|
|11|고양이와 용|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, episodeCount|
|12|극장판 전생했더니 슬라임이었던 건에 대하여 창해의 눈물편 - 극장판2|DUPLICATE|기존 극장판 전생했더니 슬라임이었던 건에 대하여 창해의 눈물편와 제목·시즌 및 표지 일치 (표지 오차 0). 60FPS/제목 변형 또는 동일 극장판. 대표: anime:72ce0fc8-e21f-4ec5-a025-7791dbcfe5f0|
|13|월드 이즈 댄싱|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, episodeCount|
|14|무자각한 성녀는 오늘도 무의식적으로 힘을 흘린다|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|15|LV999의 마을사람|PUBLISH|제작사/방송사 공식 작품명·형식 및 공개 정보와 원본 표지를 대조. 확인되지 않은 화수·상태는 비움. 교정: status, startDate [공식 근거](https://www.tv-tokyo.co.jp/anime/lv999/)|
|16|뱅 드림|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:e39610f2-473c-4b23-99e4-8256817d129a|
|17|문호 스트레이 독스 멍! 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, episodeCount|
|18|담배 고양이|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|19|추방당한 전생 중기사는 게임 지식으로 무쌍한다|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|20|뱅드림! Yume∞Mita|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate, episodeCount|
|21|소녀 괴수 캐러멜리제|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|22|여기는 내게 맡기고 먼저 가라고 말한 지 10년이 지났더니 전설이 되어 있었다.|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, episodeCount|
|23|영민 0명 스타트 변경 영주님|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, episodeCount|
|24|이거 그리고 죽어|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|25|우리 남동생들이 죄송합니다|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|26|해골기사님은 지금 이세계 모험중 2기|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate, episodeCount|
|27|블랙 토치|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|28|이와모토 선배의 추천|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|29|주식회사 마지루미에 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|30|그로우 업 쇼 ~해바라기 서커스단~|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|31|오니의 신부|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|32|「널 사랑할 생각은 없어」라던 차기 공작님이 어째선지 제게 푹 빠졌어요|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate, episodeCount|
|33|아가씨 돌보기 ~영애들이 다니는 명문 학교에서 제일가는 아가씨(생활력 없음)를 남몰래 돕는 시중 담당이 되었습니다~|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|34|철냄비 짱!|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|35|렛츠고 괴기조|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|36|너를 너무너무너무너무 좋아하는 100명의 그녀 3기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|37|20세기 전기목록 -유레카 에브리카-|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|38|무직전생 3기 ~이세계에 갔으면 최선을 다한다~|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|39|세계 최강의 후위 ~미궁국의 신인 탐색자~|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|40|정반대의 너와 나 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|41|안녕 라라|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|42|원피스 히로인즈|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: format, status, startDate|
|43|헬 모드 ~파고들기 좋아하는 게이머는 폐급 설정 이세계에서 무쌍한다~ 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|44|「널 사랑할 생각은 없어」라던 차기 공작님이 어째선지 제게 푹 빠졌어요 차기 공작님이 어째선지 제게 푹 빠졌어요|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:6385eb7a-6f3f-4739-bce4-c24f1bcbe8d6|
|45|아주르 레인 미속전진! 2!!|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, episodeCount|
|46|해골기사님은 지금 이세계 모험 중 2기|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:4303ba93-76fd-4825-8185-75fe97831cec|
|47|최강 찌꺼기 황자의 암약 제위 쟁탈전|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|48|달콤한 징벌~나는 간수 전용 애완동물|HOLD|2018년 작품 후보와 2026년 seed가 충돌하며 방송판/배포판 구분과 화수 확정 근거가 부족함.|
|49|천막의 자두가르|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|50|투명한 밤을 달리는 너와, 눈에 보이지 않는 사랑을 했다.|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate, episodeCount|
|51|전학 간 학교의 청순가련한 미소녀가 옛날에 남자라고 생각해서 같이 놀던 소꿉친구였던 일|PUBLISH|제작사/방송사 공식 작품명·형식 및 공개 정보와 원본 표지를 대조. 확인되지 않은 화수·상태는 비움. 교정: status, startDate [공식 근거](https://tenbin-anime.asmik-ace.co.jp/)|
|52|열받은 영애는 복수를 다짐했습니다 ~마도서의 힘으로 조국을 부숴버릴게요~|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate, episodeCount|
|53|버려진 성녀의 이세계 밥 여행 숨겨진 스킬로 캠핑카를 소환했습니다|PUBLISH|제작사/방송사 공식 작품명·형식 및 공개 정보와 원본 표지를 대조. 확인되지 않은 화수·상태는 비움. 교정: status, startDate, episodeCount [공식 근거](https://isekai-gohantabi.com/onair/)|
|54|그랑블루 3기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|55|투명한 밤을 달리는 너와,|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:f6dc5316-dd11-467c-b563-0618983dedf5|
|56|아름다운 그대에게 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, episodeCount|
|57|히든 카드가 많은 빅토리아|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: status, episodeCount|
|58|대전 감사합니다 ~숙녀는 격투 게임을 안 해요~|PUBLISH|제작사/방송사 공식 작품명·형식 및 공개 정보와 원본 표지를 대조. 확인되지 않은 화수·상태는 비움. 교정: status, startDate [공식 근거](https://taiari-anime.com/onair/)|
|59|공각기동대|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:57a75544-cdd7-41da-99ac-3a46fad109a0|
|60|하늘은 붉은 강가|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|61|대역 영애를 구한 것은 냉혹 무자비한 얼음 왕자의 사랑이었습니다|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, episodeCount|
|62|극장판 유녀전기 2기|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:5ac864ac-0842-4b9a-b479-fc59383f6b79|
|63|클레바테스 -마수왕과 아기와 시체 용사- 2기|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:f3d71012-54e7-4915-b089-ed5c8805f16c|
|64|여성향 게임 세계는 모브에게 가혹한 세계입니다 2기|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate, episodeCount|
|65|촌구석 아저씨, 검성이 되다 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|66|도굴왕|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|67|유녀전기 2기|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate, episodeCount|
|68|뫼비우스 더스트|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|69|썬더 3|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|70|하나오리 양은 전생해서도 싸움이 하고 싶어|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate, episodeCount|
|71|못 미더운 악녀입니다만 ~추궁접서 교체전~|PUBLISH|제작사/방송사 공식 작품명·형식 및 공개 정보와 원본 표지를 대조. 확인되지 않은 화수·상태는 비움. 교정: status, startDate [공식 근거](https://futsutsuka.net/)|
|72|Sword Art Online: Unanswered//butterfly|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|73|사망 유희로 밥을 먹는다. 44: 클라우디 비치|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|74|공각기동대 THE GHOST IN THE SHELL|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate, episodeCount|
|75|클레바테스 2기 -마수왕과 가짜 용사 전승-|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate, episodeCount|
|76|마법소녀 리리컬 나노하 EXCEEDS|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|77|여성향 게임 세계는 엑스트라에게 가혹한 세계입니다 2기|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:0ce43fbc-5e99-4ec7-bf1b-48e1a15b2753|
|78|도망을 잘 치는 도련님 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|79|달콤한 충치|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|80|사이보그 009: 네메시스|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, status|
|81|20세기 전기 목록|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:9dc7cc46-6460-4558-8430-ab70e8e41816|
|82|블리치 천년혈전 편 : 화진담|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|83|리본 히어로|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|84|테러맨|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|85|기동전사 건담: 섬광의 하사웨이 키르케의 마녀|DUPLICATE|기존 극장판 기동전사 건담: 섬광의 하사웨이 키르케의 마녀 (113971)와 원본 제목·시즌/형식 일치. 새 UUID로 게시하지 않음. 대표: anime:e1613cac-d8bb-4dd4-acfe-e944cb4ecd03|
|86|댄덜라이언|PUBLISH|제작사/방송사 공식 작품명·형식 및 공개 정보와 원본 표지를 대조. 확인되지 않은 화수·상태는 비움. 교정: format, status, startDate, episodeCount [공식 근거](https://about.netflix.com/en/news/anime-japan-2026)|
|87|도로헤도로 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|88|동방프로젝트 - 환상만화경|HOLD|동인 제작 환상만화경의 전체 연작과 수록 범위 구분이 없고 TV 14화로 저장되어 있어 공식 연작 단위 확인 필요.|
|89|두 남자와 룸쉐어 중입니다!|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|90|라이어 게임|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|91|-나루토- (신작 애니메이션)|HOLD|신작 4화의 공개 시기와 기존 나루토와의 독립 작품 식별 근거 부족. 2024 별칭과 2026 seed 충돌.|
|92|또 죽고 말았나요, 탐정님|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|93|러브 라이브! 하스노소라 여학원 스쿨 아이돌 클럽|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: status|
|94|레플리카도, 사랑을 한다.|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|95|리인카네이션의 꽃잎|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|96|리락쿠마 ~유유자적 꿈의 여행~|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: format, status, startDate|
|97|마계학교 이루마군 4기|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate|
|98|마물을 먹는 모험가 ~나만 마물을 먹고 강해진다~|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|99|마법과고교의 열등생: 요츠바 계승 편|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: status|
|100|마법사의 밤|PUBLISH|제작사/방송사 공식 작품명·형식 및 공개 정보와 원본 표지를 대조. 확인되지 않은 화수·상태는 비움. 교정: startDate [공식 근거](https://mahoyo-movie.com/)|
|101|마법의 자매 룰루토 릴리|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|102|마오|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate, episodeCount|
|103|막차가 끊긴 뒤, 캡슐 호텔에서 상사에게 미열을 전하는 밤|HOLD|과거 작품을 2026년으로 수집. 방송판과 배포판 및 최초 방영연도 검증 자료 부족.|
|104|매리지 톡신|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate|
|105|맞선 상대는 제자 기가 센 문제아|HOLD|원본 11화와 공개 자료 12화가 충돌. 방송판/배포판 식별 및 최초 방영연도 확인 필요.|
|106|메이드 양은 먹기만 할 뿐|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|107|[극장판]명탐정 코난: 진홍의 수학여행|HOLD|코난 TV 수학여행 편의 극장 편집본 여부 미확정. 제목은 극장판, 원본 형식은 TV로 충돌.|
|108|명탐정 프리큐어!|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|109|명탐정코난 : 하이웨이의 타천사|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate|
|110|목욕관리사씨! ~나와 그 녀석이 여탕에서!?~|HOLD|과거 단편 작품. 원본 TV 형식과 총화수·최초 공개일을 확인할 공식 근거 부족.|
|111|모프샌드|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: format, status, startDate|
|112|바키도: 무적의 검사 편|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, episodeCount|
|113|반에서 두 번째로 귀여운 여자애와 친구가 되었다|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|114|백귀야행 : 요괴 기록첩|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, status|
|115|백성귀족 3기 OVA|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: format, status, startDate|
|116|Re: 제로부터 시작하는 이세계 생활 4기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|117|부탁해 아이프리|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|118|북두의 권 -FIST OF THE NORTH STAR-|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate|
|119|블랙 잭이라니깐|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, status|
|120|비극의 원흉이 되는 최강악역 최종보스 여왕은 국민을 위해 헌신합니다 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|121|쁘띠큐어 ~프리큐어 페어리즈~ 3기|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: format, status, startDate|
|122|사랑해 게임을 끝내고 싶어|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|123|손끝에서부터 진심의 열정 - 소꿉 친구는 소방관 -|HOLD|기존 2기와 별개 1기 후보지만 전체 화수 및 방송/배포판 식별 근거 부족.|
|124|스커트 안은 짐승이었습니다|HOLD|과거 단편 작품을 2026년 seed로 수집. 최초 연도 및 방송/배포판 식별 확인 필요.|
|125|승려와 나누는 색욕의 밤에|HOLD|과거 단편 작품을 2026년 seed로 수집. 최초 연도 및 방송/배포판 식별 확인 필요.|
|126|스노우볼 어스|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|127|신의 물방울|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|128|신의 정원이 딸린 쿠스노키 저택|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|129|XL 상사|HOLD|과거 단편 작품. 방송판/배포판 및 최초 연도 검증 필요.|
|130|아빠도, 하고 싶어|HOLD|과거 작품. 화수 누락, 방송판/배포판 및 최초 연도 검증 필요.|
|131|아와지마 가극학교|PUBLISH|제작사/방송사 공식 작품명·형식 및 공개 정보와 원본 표지를 대조. 확인되지 않은 화수·상태는 비움. 교정: status, startDate, episodeCount [공식 근거](https://awajima-anime.com/)|
|132|아카네 이야기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|133|야니 네코 미니|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|134|야리칭 빗치부|HOLD|2화 OVA 후보이나 원본은 TV로 분류. 정식 발매 단위/연도 확인 필요.|
|135|어서 오세요 실력지상주의 교실에 4nd Season|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:bca800ba-0c25-4dfe-b6d6-d1d7701615eb|
|136|언니 놀이|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|137|얼음 성벽|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|138|엉덩이 앞 맨: 부활의 엉덩이 앞 제국|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|139|에반게리온 신작 단편 애니메이션(가제)|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: format, status, startDate|
|140|여신 「이세계 전생하면 뭐가 되고 싶습니까」 나 「용사의 갈비뼈로」|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: status|
|141|엉덩이 댄디 : 젊은 시절|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|142|여친, 빌리겠습니다 5기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|143|옆집 천사님 때문에 어느샌가 인간적으로 타락한 사연 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|144|오버플로우(오버후로)|HOLD|과거 단편 작품. 방송판/배포판과 최초 연도 확인 자료 부족.|
|145|오타쿠에게 상냥한 갸루는 없다?!|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate|
|146|외출하는 아기 상어 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|147|왼손잡이 에렌|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|148|요자쿠라 일가의 대작전 제2기|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:e01141ba-76f3-4676-a35f-195ff2747736|
|149|은하특급 밀키☆서브웨이 각역 정차 극장행|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate|
|150|이세계 유유자적 농가 2|PUBLISH|제작사/방송사 공식 작품명·형식 및 공개 정보와 원본 표지를 대조. 확인되지 않은 화수·상태는 비움. 교정: status, startDate, episodeCount [공식 근거](https://nonbiri-nouka2.com/streaming/)|
|151|이세계에서 치트 스킬을 얻은 나는 현실 세계에서도 무쌍한다 ~레벨업이 인생을 바꿨다~ TVSP|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: format, status, startDate|
|152|일본삼국|PUBLISH|제작사/방송사 공식 작품명·형식 및 공개 정보와 원본 표지를 대조. 확인되지 않은 화수·상태는 비움. 교정: status, startDate, episodeCount [공식 근거](https://www.nipponsangoku.com/)|
|153|자동판매기로 다시 태어난 나는 미궁을 방랑한다 3기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|154|자칭 악역 영애인 약혼자 관찰기록.|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|155|걸즈 앤 판처 리본의 무사|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: format, status, startDate|
|156|장송의 프리렌: ●●의 마법 Part 3|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|157|전생 악녀의 흑역사 18권 특장판 OVA|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: format, status, startDate, episodeCount|
|158|전생했더니 슬라임이었던 건에 대하여 제4기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|159|검은 고양이와 마녀의 교실|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|160|(60FPS)주술회전|DUPLICATE|기존 주술회전와 제목·시즌 및 표지 일치 (표지 오차 0.398). 60FPS/제목 변형 또는 동일 극장판. 대표: anime:f4a9f719-0b1f-4411-b33c-76cc55e8e7c9|
|161|지팡이와 검의 위스토리아 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|162|책벌레의 하극상 ~사서가 되기 위해서라면 뭐든지 할 수 있어~ 영주의 양녀|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate, episodeCount|
|163|천수의 사쿠나히메 코코로와 농사 일지|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: format, status, startDate|
|164|초록 3학년 아시베와 큐큐 고마짱|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|165|최강의 직업은 용사도 현자도 아닌 감정사(임시)인 것 같은데요?|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|166|최강의 왕, 두 번째 인생에는 무엇을 하는가? 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|167|천장에서 떨어진 그녀 -2층에서 여자가 떨어졌다!?-|HOLD|과거 단편 작품인데 TV 9화로 저장. 특전 포함 여부와 방송/배포판 확인 필요.|
|168|최종악장 울려라! 유포니엄|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: status|
|169|춘하추동 대행자 봄의 춤|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|170|치킨 파이터|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|171|카니발 판타즘 특별편|HOLD|기존 EX와 HibiChika 특별편 중 어느 작품인지 원본 일반 제목만으로 확정할 수 없음.|
|172|경멸하는 표정으로 팬티를 보여다오 R|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, status|
|173|카미이나 보탄, 취한 모습은 백합의 꽃|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate|
|174|겔피요|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, status|
|175|쿠지마 노래하면 집이 파다닥|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|176|고스트 콘서트: missing Songs|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: status, startDate|
|177|쿠마바 시즌 3|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|178|키리오 팬클럽|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|179|큰 여자는 좋아하세요?|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, status|
|180|킬 블루|PUBLISH|제작사/방송사 공식 작품명·형식 및 공개 정보와 원본 표지를 대조. 확인되지 않은 화수·상태는 비움. 교정: status, startDate, episodeCount [공식 근거](https://kill-blue.jp/onair/)|
|181|토리코 x 원피스 x 드래곤볼 : 천하제일 식신대회|HOLD|크로스오버 TV 에피소드와 독립 특별편 구분 및 수록 범위가 불명확.|
|182|페이트 제로 리믹스|HOLD|총집편 Remix의 독립 작품 단위와 최초 공개일 확인 필요. 본편과 합치지 않음.|
|183|페이트 스테이 나이트 UBW 달빠 자막|SOURCE_VARIANT|사용자 자막/합본 변형. UBW 1·2기 합본 25화로 보이며 어느 한 시즌 UUID에 강제 병합하지 않고 게시 제외.|
|184|고깔모자의 아틀리에|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: format, status, startDate|
|185|하이바라의 청춘 뉴 게임 플러스|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|186|허당 선도부원과 스커트 길이가 부적절한 여고생의 이야기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음.|
|187|황천의 츠가이|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: episodeCount|
|188|힘내라! 나카무라 군!!|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format|
|189|공주 기사는 야만족의 신부|DUPLICATE|기존 공주기사는 야만인의 아내와 제목·시즌 및 표지 일치 (표지 오차 0.425). 60FPS/제목 변형 또는 동일 극장판. 대표: anime:03f28ccf-c111-4fb3-a245-4e1be715b80e|
|190|굴뚝마을의 푸펠: 약속의 시계탑|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: status|
|191|끝이 아닌 시작 (최강의 왕, 두 번째 인생에는 뭘해?) 2기|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:02c37b87-3644-4c22-993a-958b2bc032d5|
|192|요자쿠라 일가의 대작전 2기|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: status|
|193|여신 「이세계 전생하면 뭐가 되고 싶습니까」 Megami "Isekai Tensei Nani ni Naritai Desu ka" Ore "Yuusha no Rokkotsu de"|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:4631cdfc-4e52-4b85-92d3-c5d94abb2889|
|194|이세계 유유자적 농가 2기|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:0bf2b777-be5a-48eb-bf91-600502ab4e29|
|195|Marriagetoxin|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:65293216-251c-43af-852a-28674c1a09bd|
|196|Ghost Concert: Missing Songs|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:cdddc033-a061-4c55-8074-7caba6edb9f6|
|197|어서오세요 실력 지상주의 교실에 4기|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:bca800ba-0c25-4dfe-b6d6-d1d7701615eb|
|198|Needy Girl Overdose|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:6d1e11cb-757f-4dfe-bf7e-0002adae8045|
|199|다이아몬드|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:8fbe2589-7105-434f-afd1-23c2f800c0cd|
|200|악마에 입문했습니다! 이루마 군 4기|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:0b0448aa-f72c-43da-b23f-191b946415a6|
|201|춘하추동 대행자|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:9bae0a9d-ef3c-4487-8c4c-6ac787e68b83|
|202|책벌레의 하극상 ~사서가 되기 위해서라면 뭐든지 할 수 있어~ 4기|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:01f6508f-b07e-4c44-8750-dc9c52ab3e45|
|203|전생했더니 슬라임이었던 건에 대하여 4기|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:f3854430-45f1-4e3c-9df0-b5838a37c11f|
|204|나의 히어로 아카데미아|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:d6c63c55-acf7-4faf-920b-f9646b01d799|
|205|공주님 "고문"의 시간입니다 2기|DUPLICATE|기존 공주님 "고문"의 시간입니다 제2기 (176370)와 원본 제목·시즌/형식 일치. 새 UUID로 게시하지 않음. 대표: anime:9457d883-4fec-429f-be98-b0dda3b69901|
|206|이세계에서 치트 능력을 손에 넣은 나는, 현실세계에서도 무쌍한다 ~레벨 업은 인생을 바꿨다~OVA|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:6bc64ece-f8e8-4ef1-90f9-7b6ac176968b|
|207|비질랜티 -나의 히어로 아카데미아|DUPLICATE|기존 비질랜티 -나의 히어로 아카데미아 ILLEGALS- 2기 (195322)와 원본 제목·시즌/형식 일치. 새 UUID로 게시하지 않음. 대표: anime:325100b7-aca3-40a6-a4b7-cf4e1bacad3e|
|208|트라이건|DUPLICATE|기존 트라이건 스타게이즈 (163144)와 원본 제목·시즌/형식 일치. 새 UUID로 게시하지 않음. 대표: anime:acd64282-8298-42fa-abb6-22389b06a8f5|
|209|시광대리인 3기 -Link Click-|HOLD|중국판 3기와 일본 배포 런던편 구분 불명확. 원본 화수 24/8이 충돌.|
|210|Fate/Strange Fake (페이트/스트레인지 페이크)|DUPLICATE|기존 페이트/스트레인지 페이크 (166617)와 원본 제목·시즌/형식 일치. 새 UUID로 게시하지 않음. 대표: anime:a008d775-35b8-4416-bb09-c84bab1c1986|
|211|DARK MOON -검은 달 : 달의 제단-|DUPLICATE|기존 DARK MOON: 달의 제단 (181443)와 원본 제목·시즌/형식 일치. 새 UUID로 게시하지 않음. 대표: anime:95b6dd3e-37ac-4c37-920b-e14cf7a86dfa|
|212|주술회전 3기 사멸회유 전편|DUPLICATE|기존 주술회전 3기 -사멸회유- (172463)와 원본 제목·시즌/형식 일치. 새 UUID로 게시하지 않음. 대표: anime:252cd7bf-66c3-4852-9f0e-3ac312f6566d|
|213|최애의 아이 3기 [Oshi no Ko] 3rd Season|DUPLICATE|기존 【최애의 아이】 3기 (182587)와 원본 제목·시즌/형식 일치. 새 UUID로 게시하지 않음. 대표: anime:4fdd83f1-cd9f-4c05-b893-b1fad5b6706b|
|214|무사태평 영주의 즐거운 영지 방어 ~생산계 마법으로 이름 없는 마을을 최강의 성채 도시로~|DUPLICATE|기존 무사태평 영주의 즐거운 영지 방어 (191205)와 원본 제목·시즌/형식 일치. 새 UUID로 게시하지 않음. 대표: anime:cdb3e520-dde9-4366-93b6-96aa1941f000|
|215|용사 파티에서 쫓겨난 다재무능 ~파티 사정으로 부여술사를 하고 있던 검사, 만능에 이른다~|DUPLICATE|기존 용사 파티에서 쫓겨난 다재무능 (187264)와 원본 제목·시즌/형식 일치. 새 UUID로 게시하지 않음. 대표: anime:874802e7-ba3e-4449-8d53-a37f8c7ca471|
|216|걸즈 & 판처 좀 더 러브러브 작전입니다! Girls & Panzer: Motto Love Love Sakusen desu!|DUPLICATE|기존 걸즈 앤 판처 좀 더 러브러브 작전입니다! 제1막와 제목·시즌 및 표지 일치 (표지 오차 0). 60FPS/제목 변형 또는 동일 극장판. 대표: anime:28e050dd-a9d9-4a41-a196-57fbeb7ec0f7|
|217|에바 30주년 기념 이벤트|DUPLICATE|원본 제목/부제·시즌과 표지를 개별 대조하여 증분 내 동일 작품임을 확인. 더 구체적인 대표 항목만 게시. 대표: anime:6d62fec0-4f23-4821-a5fd-b29790700cad|
|218|초(超) 가구야 공주! Chou Kaguya-hime!|DUPLICATE|기존 초(超) 가구야 공주! (201903)와 원본 제목·시즌/형식 일치. 새 UUID로 게시하지 않음. 대표: anime:4d5581e4-3b1f-4c35-8b3d-f0945eb4955e|
|219|귀멸학원 이야기|HOLD|7화 합본 귀멸학원의 발렌타인편/학원편 구성 범위 미확정. 기존 본편과 병합하지 않음.|
|220|(60FPS)귀멸의 칼날|DUPLICATE|기존 귀멸의 칼날와 제목·시즌 및 표지 일치 (표지 오차 4.964). 60FPS/제목 변형 또는 동일 극장판. 대표: anime:7fa02a83-df53-41dd-b464-baed340c310d|
|221|25세 여고생|HOLD|2018년 단편 후보이나 2026년 seed. 방송판/배포판 구분과 최초 연도 검증 필요.|
|222|극장판 모노노케: 뱀의 저주|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: status|
|223|극장판 비밀의 아이프리 피어나는 바즈리움 라이브!|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: status|
|224|꼬마 생쥐의 빨간 조끼|PUBLISH|원어 제목·시즌·형식과 저장된 AniList 원본 및 표지를 개별 대조. 기존 운영 AniList ID 중복 없음. 교정: format, status|
|225|나의 히어로 아카데미아 No.170+1 「More」|PUBLISH|보류된 자동 후보의 원어 제목·시즌과 실제 표지를 개별 대조하여 동일 작품 확인. 형식은 후보 근거로 교정하고 미확인 방영일/상태는 비움. AniList ID는 내부 검토 근거로만 보존. 교정: format, status, startDate|
|226|나의 손가락으로 흔들린다 ~폐점 후 단둘의 살롱에서~|HOLD|과거 단편 작품. 방송판/배포판 구분과 최초 연도 검증 자료 부족.|

## 추가 제목 확인

일반 시리즈와 혼동하지 않도록 러브 라이브 작품명에 `Bloom Garden Party`, 유포니엄에 `전편`, 걸즈 앤 판처에 `파일럿판`을 명시했다. 모두 저장된 원어 제목 근거로 교정했다. 리락쿠마의 TV_SHORT는 프로젝트 표준 WEB_SHORT로 변환했다.

## 운영 반영 완료

- Active release: `catalog-increment-7888d03d489d590b40f9280a` (2026-09-07).
- 검색/상세/표지 각각 4,160행, 인물 페이지 5,028행을 업로드 후 전체 재조회하여 hash 비교 통과.
- 익명 권한으로 신규 161건의 검색용 제목/별칭과 상세 제목을 재조회하여 일치 확인.
- 실제 https://www.moemoa.xyz 에서 신규 9개 작품 상세·표지·AniList 외부 링크 부재 및 검색 3개 검사, 총 12개 통과.
- 5등분 원작 1기(103572), 2기(109261), 극장판(131520) 모두 검색됨.
- Migration `20260907193000_catalog_optional_source_provider` 적용 및 migration history 기록. `catalog_assets.source_provider`에 ANILIFE만 추가 허용. 권리/버킷/크기 제약은 유지.
- 롤백은 저장된 `before.json`의 기존 release `catalog-add-81297cd638290f972ca84c28` 재활성화. 기존 데이터·이미지·사용자 자료 삭제 없음. Provider 허용 확장은 호환 가능하므로 일반 데이터 롤백 때 유지.
- 신규 코드 배포는 하지 않았으며 기존 운영 웹에서 새 DB 데이터를 확인했다. 사용자 이미지·개인정보·UGC 설정 변경 없음.

## 재배포 주의

`tools/catalog-lab/config/increment226-release-review.json`에 전체 판정·원본 hash·교정값·승인 bundle hash를 보관했다. 일반 exporter가 이 ledger를 자동 적용하는 것은 아니다. 원래 226개 seed를 그대로 재배포하면 중복/교정 전 값이 다시 들어가므로 금지한다. 다음 rebuild는 승인된 bundle hash를 재현하거나 차이를 새로 검토해야 한다. 원본 canonical/seed는 증거 보존을 위해 수정하지 않았다.

보류 22건은 검토 완료와 공개 승인 완료를 구분한다. 이들은 판본·합본 범위·공개 연도 등 불확실성이 남아 현재 서비스에는 추가하지 않았다. 새 근거를 확보한 항목만 후속 검토 후 반영한다.
