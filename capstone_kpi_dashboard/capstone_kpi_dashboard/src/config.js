'use strict';

// 데이터 기준일 (기준 명세 §9: 발표와 재현을 위해 고정). 실제 오늘 날짜와 무관하다.
const TODAY = '2026-10-31';

// 공정 순서 (기준 명세 §2). 화면과 차트의 순서가 이 배열을 따른다.
const PROCESSES = ['절단', '소조립', '중조립', '대조립', '도장', '탑재'];

module.exports = { TODAY, PROCESSES };
