/* =====================================================================
   store.js : 데이터를 저장하고 불러오는 파일
   - 모든 데이터는 하나의 덩어리(state)로 묶어 브라우저 localStorage의
     'linkrote_v1' 칸에 통째로 저장합니다.
   - serialize / parse / emptyState / newId 는 "저장소를 건드리지 않는" 함수라서
     시험 페이지(test.html)에서도 안전하게 씁니다.
   ===================================================================== */
(function () {
  var LR = window.LR = window.LR || {};
  var C = LR.CONFIG;

  // 설정 기본값을 복사해서 돌려줌 (원본이 바뀌지 않도록 JSON으로 복사)
  function copy(obj) { return JSON.parse(JSON.stringify(obj)); }

  var store = LR.store = {
    state: null,        // 지금 쓰는 데이터 덩어리
    storageOk: true,    // 저장소를 쓸 수 있는지

    // 비어 있는 새 데이터 덩어리 만들기
    emptyState: function () {
      return {
        version: 1,
        nextId: 1,                 // 번호표 (새 항목마다 1씩 올라감)
        participants: [],          // 참가자
        menus: [],                 // 재능 메뉴
        helpCards: [],             // 도와주세요 카드
        exchanges: [],             // 교환
        ledger: [],                // 조각 장부 (잔액은 이 장부의 합계로 계산)
        stamps: [],                // 스탬프
        redemptions: [],           // 혜택 교환 기록
        rounds: [],                // 라운드 일정
        teams: [],                 // 대회 팀
        expenses: [],              // 지출 기록
        settings: copy(C.defaultSettings),
        operatingFields: [],       // 운영자가 확정한 운영 분야
        assignedAt: null,          // 분야 배정을 확정한 시각
        manualMetrics: { lightningCount: '', inviteCount: '' }, // 운영자가 직접 입력하는 지표
        session: { viewerId: 'admin' } // 지금 보는 사람 ('admin' 또는 참가자 id)
      };
    },

    // 새 항목에 붙일 번호 만들기 (예: p1, c2, x3)
    newId: function (s, prefix) {
      var n = s.nextId || 1;
      s.nextId = n + 1;
      return prefix + n;
    },

    // 빠진 칸이 있으면 기본값으로 채워서 안전하게 만들기 (옛 데이터/가져온 데이터 대비)
    normalize: function (s) {
      var base = store.emptyState();
      Object.keys(base).forEach(function (k) {
        if (s[k] === undefined || s[k] === null) s[k] = base[k];
      });
      Object.keys(base.settings).forEach(function (k) {
        if (s.settings[k] === undefined) s.settings[k] = base.settings[k];
      });
      if (!s.manualMetrics) s.manualMetrics = base.manualMetrics;
      if (!s.session) s.session = base.session;
      return s;
    },

    // 데이터를 글자(JSON)로 바꾸기
    serialize: function (s) {
      return JSON.stringify({ app: 'linkrote', version: 1, exportedAt: new Date().toISOString(), data: s }, null, 2);
    },

    // 글자(JSON)를 데이터로 되돌리기. 잘못된 파일이면 {ok:false, reason}
    parse: function (text) {
      var obj;
      try { obj = JSON.parse(text); } catch (e) { return { ok: false, reason: '파일이 올바른 백업 파일이 아니에요(글자를 읽을 수 없음).' }; }
      var data = obj && obj.app === 'linkrote' ? obj.data : null;
      if (!data || !Array.isArray(data.participants) || !Array.isArray(data.ledger) || !data.settings) {
        return { ok: false, reason: '링크로테 백업 파일이 아니에요. 내보내기로 받은 파일을 골라 주세요.' };
      }
      return { ok: true, state: store.normalize(data) };
    },

    // ---- 아래부터는 실제 브라우저 저장소를 쓰는 함수 ----

    // 프로그램을 켤 때 한 번: 저장된 데이터를 불러오기 (없으면 새로 만들기)
    init: function () {
      var s = null;
      try {
        var raw = window.localStorage.getItem(C.storageKey);
        if (raw) {
          s = store.normalize(JSON.parse(raw));
        }
      } catch (e) {
        store.storageOk = false; // 저장소를 못 쓰는 환경 (또는 저장된 글자가 깨짐)
      }
      store.state = s || store.emptyState();
      return store.state;
    },

    // 지금 데이터를 저장
    save: function () {
      try {
        window.localStorage.setItem(C.storageKey, JSON.stringify(store.state));
        store.storageOk = true;
      } catch (e) {
        store.storageOk = false;
      }
    },

    // 백업 글자 만들기
    exportJSON: function () { return store.serialize(store.state); },

    // 백업 글자로 통째로 바꾸기
    importJSON: function (text) {
      var r = store.parse(text);
      if (!r.ok) return r;
      store.state = r.state;
      store.save();
      return { ok: true };
    },

    // 전체 초기화. 확인 창을 2번 띄우고, 둘 다 "확인"일 때만 지움
    resetAll: function (confirmFn) {
      var ask = confirmFn || function (m) { return window.confirm(m); };
      if (!ask('모든 데이터(참가자, 조각 장부, 설정 포함)를 지웁니다. 계속할까요?')) return false;
      if (!ask('정말 지울까요? 지운 데이터는 되돌릴 수 없어요. (백업 파일이 있으면 가져오기로 복원할 수 있어요)')) return false;
      store.state = store.emptyState();
      store.save();
      return true;
    }
  };
})();
