/* =====================================================================
   views-participant.js : 참가자 화면(P1~P5)과 홈 화면, 공통 화면 도구(LR.ui)
   - LR.views.화면이름 = function(S){ return '화면 HTML' }  : 화면을 글자(HTML)로 만들어 줌
   - LR.actions.행동이름 = function(요소){ ... }            : 버튼/양식을 눌렀을 때 하는 일
   - 버튼 모양은 HTML에 data-action="행동이름" 으로, 양식은 data-submit="행동이름" 으로 연결해요.
   - 사용자가 쓴 글자는 항상 ui.esc()로 감싸서 화면 깨짐/오작동을 막습니다.
   ===================================================================== */
(function () {
  var LR = window.LR = window.LR || {};
  var R = LR.rules, C = LR.CONFIG;
  var ui = LR.ui = { flash: null, p1Draft: null, assignDraft: null };
  LR.views = LR.views || {};
  LR.actions = LR.actions || {};
  var V = LR.views, A = LR.actions;

  /* ---------- 공통 도구 ---------- */
  ui.S = function () { return LR.store.state; };
  // 화면에 글자를 안전하게 넣기 위한 변환 (<, > 같은 기호를 무해하게 바꿈)
  ui.esc = function (t) {
    return String(t === null || t === undefined ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var h = ui.esc;
  ui.viewerId = function () { return ui.S().session.viewerId || 'admin'; };
  ui.isAdmin = function () { return ui.viewerId() === 'admin'; };
  ui.me = function () { return ui.isAdmin() ? null : R.getP(ui.S(), ui.viewerId()); };
  ui.pname = function (id) { var p = R.getP(ui.S(), id); return p ? p.name : '(알 수 없음)'; };
  ui.fieldOf = function (id) { var p = R.getP(ui.S(), id); return p && p.assignedField ? p.assignedField : '분야 미정'; };
  ui.setFlash = function (msg, kind) { ui.flash = { msg: msg, kind: kind || 'ok' }; };
  // 저장하고 화면 다시 그리기 (메시지 포함)
  ui.done = function (msg, kind) { if (msg) ui.setFlash(msg, kind); LR.store.save(); LR.app.render(); };
  // 실패 메시지만 보여 주고 다시 그리기 (데이터는 바뀌지 않음)
  ui.fail = function (msg) { ui.setFlash(msg, 'err'); LR.app.render(); };
  ui.fmt = function (iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    function z(n) { return n < 10 ? '0' + n : '' + n; }
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  };
  ui.today = function () {
    var d = new Date();
    function z(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  };
  ui.options = function (list, selected, placeholder) {
    var out = placeholder !== undefined ? '<option value="">' + h(placeholder) + '</option>' : '';
    list.forEach(function (x) {
      var v = typeof x === 'object' ? x.value : x, t = typeof x === 'object' ? x.text : x;
      out += '<option value="' + h(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + h(t) + '</option>';
    });
    return out;
  };
  ui.signed = function (n) { return '<span class="' + (n < 0 ? 'neg' : 'pos') + '">' + (n > 0 ? '+' : '') + n + '</span>'; };
  ui.statusTag = function (st) {
    var cls = (st === '취소' || st === '노쇼') ? 'err' : (st === '응답' || st === '대기' || st === '미배정') ? 'warn' : '';
    return '<span class="tag ' + cls + '">' + h(st) + '</span>';
  };
  ui.reason = function (r) { return r ? '<div class="reason">' + h(r) + '</div>' : ''; };
  // 교환 진행 시각 (응답 / 확정 / 완료 / 정산). 시각이 기록되지 않은 옛 데이터는 "시각 기록 없음"으로 표시
  ui.exTimes = function (e) {
    var parts = [];
    if (e.createdAt) parts.push('응답 ' + ui.fmt(e.createdAt));
    if (e.confirmedAt) parts.push('확정 ' + ui.fmt(e.confirmedAt));
    if (e.completedAt) parts.push('<b>완료 ' + ui.fmt(e.completedAt) + '</b>');
    else if (e.status === '완료' || e.status === '정산') parts.push('완료 (시각 기록 없음)');
    if (e.settledAt) parts.push('정산 ' + ui.fmt(e.settledAt));
    return parts.length ? '<div class="small hint">' + parts.join('<br>') + '</div>' : '';
  };
  // 참가자가 아니면(운영자 화면이면) 보여 줄 안내
  ui.needParticipant = function () {
    return '<div class="card"><b>이 화면은 참가자 한 명의 화면이에요.</b><br>위쪽 "지금 보는 사람"에서 참가자를 고르세요. 아직 참가자가 없다면 <a href="#/p1">P1 가입</a>에서 만들 수 있어요.</div>';
  };
  // 라운드 분야 선택지: 운영 분야 + 후보 분야 (중복 없이)
  ui.fieldChoices = function (S) {
    var list = S.operatingFields.slice();
    S.settings.candidateFields.forEach(function (f) { if (list.indexOf(f) < 0) list.push(f); });
    return list;
  };
  var statusHelp = {
    '미배정': '아직 분야 배정 전이에요. 운영자가 분야 배정을 확정하면 정해져요.',
    '1순위배정': '1순위 분야로 배정됐어요.',
    '2순위배정': '1순위 분야는 이번에 운영되지 않아 2순위 분야로 배정됐어요.',
    '대기': '1순위와 2순위 분야가 모두 이번 운영에서 빠졌어요. 다음 단계 시작 3주 전에, 알림에 동의했다면 문자·메일로 알려 드려요.'
  };

  /* ---------- 홈 ---------- */
  V.home = function (S) {
    return '<h2>링크로테에 오신 것을 환영해요</h2>' +
      '<div class="card"><p><b>링크로테(LinkRote)</b>는 여러 분야의 사람이 <b>돌아가며</b> 서로를 만나고, <b>탤런트 스왑(재능 교환)</b>으로 재능을 조각으로 주고받는 순환형 네트워킹 커뮤니티예요. 이 화면은 규칙을 직접 눌러 보며 시험해 보는 <b>프로토타입</b>이에요.</p>' +
      '<p class="hint">핵심 규칙: 받으려면 <b>다른 분야</b>에서 받는다. 조각은 현금이 아니에요(현금 환전 기능은 없어요).</p></div>' +
      '<div class="card"><h3 style="margin-top:0">이렇게 시험해 보세요</h3><ol>' +
      '<li>운영자 화면 <b>A8 설정·백업</b>에서 <b>샘플 데이터 넣기</b>를 누르면 가짜 참가자 24명이 생겨요.</li>' +
      '<li><b>A2 분야 배정</b>에서 "배정 실행" 후 "확정"을 눌러요.</li>' +
      '<li>위쪽 "지금 보는 사람"에서 참가자를 골라 <b>P4 도와주세요 카드</b>에 응답해 보세요. (같은 분야는 응답이 막혀요)</li>' +
      '<li>다시 "운영자"로 바꿔 <b>A4 교환 관리</b>에서 확정 -> 완료 -> 정산을 눌러 보세요.</li></ol>' +
      '<p class="hint">샘플 없이 직접 해 보려면 <a href="#/p1">P1 가입</a>부터 시작하세요. 로그인은 없고, 위쪽 "지금 보는 사람"으로 역할을 바꿔요.</p></div>' +
      '<div class="card"><div>지금 참가자 <b>' + S.participants.length + '</b>명 / 교환 <b>' + S.exchanges.length + '</b>건 / 현재 단계 <b>' + h(C.stageLongNames[S.settings.currentStage] || S.settings.currentStage) + '</b></div>' +
      '<div class="row"><button data-action="load-sample" class="secondary">샘플 데이터 넣기 (가짜 24명)</button><a href="#/a8">설정·백업으로 가기</a></div></div>';
  };

  /* ---------- P1 가입 ---------- */
  V.p1 = function (S) {
    var d = ui.p1Draft || {};
    var fields = S.settings.candidateFields;
    function prefBlock(n) {
      return '<label class="block" for="pref' + n + '">' + n + '순위 분야 (필수)</label>' +
        '<div class="row"><select id="pref' + n + '" name="pref' + n + '">' + ui.options(fields, d['pref' + n + 'sel'] || '', '-- 고르세요 --') + '</select>' +
        '<input type="text" name="pref' + n + 'custom" style="max-width:240px" placeholder="목록에 없으면 직접 적기" value="' + h(d['pref' + n + 'custom'] || '') + '"></div>';
    }
    var menus = '';
    for (var i = 1; i <= 5; i++) {
      menus += '<div class="row"><input type="text" name="menu' + i + '" placeholder="예) 로고 시안 30분 피드백" value="' + h(d['menu' + i] || '') + '"></div>';
    }
    return '<h2>P1 가입</h2>' +
      '<form class="card" data-submit="p1-submit" autocomplete="off">' +
      '<div class="flash warn">민감한 정보는 적지 마세요. 주민등록번호, 계좌번호, 집 주소, 생년월일은 받지 않아요. 연락처도 시험용 <b>가짜 번호/메일</b>만 쓰세요.</div>' +
      '<label class="block" for="name">이름(별명) (필수)</label><input type="text" id="name" name="name" value="' + h(d.name || '') + '">' +
      prefBlock(1) + prefBlock(2) +
      '<div class="hint">1순위와 2순위는 서로 달라야 해요. 운영 분야보다 신청이 많으면 인원이 많은 분야부터 운영돼요.</div>' +
      '<label class="block" for="contact">연락처 (선택: 전화번호 또는 메일 주소 중 하나)</label><input type="text" id="contact" name="contact" placeholder="예) 010-0000-0000 또는 sample@example.com" value="' + h(d.contact || '') + '">' +
      '<div class="hint">교환이 <b>확정된 뒤에만</b> 상대에게 공개돼요.</div>' +
      '<div class="row"><label><input type="checkbox" name="consentMsg"' + (d.consentMsg ? ' checked' : '') + '> 문자·메일로 다음 단계 안내를 받는 것에 동의해요 (연락처를 적어야 해요)</label></div>' +
      '<label class="block">내가 줄 수 있는 재능 (1개 이상, 30분 단위)</label>' +
      '<div class="hint">한 줄에 하나씩, 30분 동안 해 줄 수 있는 일을 적어요. 30분 = 1조각이에요.</div>' + menus +
      '<div class="row"><button type="submit">가입하기</button></div>' +
      '<div class="hint">가입하면 <b>' + (S.settings.signupGift === '' ? 0 : S.settings.signupGift) + '조각</b>을 선물로 받아요. (탤런트 스왑(재능 교환)에서 쓰는 교환 단위예요)</div>' +
      '</form>';
  };
  A['p1-submit'] = function (form) {
    var S = ui.S(), f = form.elements;
    var raw = { name: f.name.value, pref1sel: f.pref1.value, pref1custom: f.pref1custom.value, pref2sel: f.pref2.value,
                pref2custom: f.pref2custom.value, contact: f.contact.value, consentMsg: f.consentMsg.checked };
    var menus = [];
    for (var i = 1; i <= 5; i++) { raw['menu' + i] = f['menu' + i].value; menus.push(f['menu' + i].value); }
    var data = {
      name: raw.name, pref1: raw.pref1custom.trim() || raw.pref1sel, pref2: raw.pref2custom.trim() || raw.pref2sel,
      contact: raw.contact, consentMsg: raw.consentMsg, menus: menus
    };
    var r = R.signup(S, data);
    if (!r.ok) { ui.p1Draft = raw; ui.fail(r.errors.join('\n')); return; }
    ui.p1Draft = null;
    S.session.viewerId = r.participant.id;
    ui.setFlash('가입 완료! 지금 보는 사람이 "' + r.participant.name + '" 님으로 바뀌었어요. 가입 선물 조각이 장부에 기록됐어요.');
    LR.store.save();
    location.hash = '#/p2';
    LR.app.render();
  };

  /* ---------- P2 내 정보 ---------- */
  V.p2 = function (S) {
    var me = ui.me();
    if (!me) return '<h2>P2 내 정보</h2>' + ui.needParticipant();
    var bal = R.balance(S, me.id);
    var limit = R.setting(S, 'minusLimit');
    var ledger = S.ledger.filter(function (l) { return l.participantId === me.id; }).slice().reverse();
    var menus = S.menus.filter(function (m) { return m.ownerId === me.id; });
    var rows = ledger.map(function (l) {
      return '<tr><td>' + h(ui.fmt(l.at)) + '</td><td>' + h(l.type) + '</td><td>' + ui.signed(l.amount) + '</td><td>' + h(l.memo) + '</td></tr>';
    }).join('') || '<tr><td colspan="4">아직 장부 내역이 없어요.</td></tr>';
    var menuRows = menus.map(function (m) {
      return '<div class="row"><input type="text" name="menu_' + h(m.id) + '" value="' + h(m.title) + '"><label class="small"><input type="checkbox" name="del_' + h(m.id) + '"> 지우기</label></div>';
    }).join('');
    return '<h2>P2 내 정보</h2><div class="grid2">' +
      '<div class="card"><h3 style="margin-top:0">' + h(me.name) + ' 님</h3>' +
      '<div>1순위 <b>' + h(me.pref1) + '</b> / 2순위 <b>' + h(me.pref2) + '</b></div>' +
      '<div>배정 분야: <b>' + h(me.assignedField || '아직 없음') + '</b> ' + ui.statusTag(me.assignStatus) + '</div>' +
      '<div class="hint">' + h(statusHelp[me.assignStatus] || '') + '</div>' +
      '<div>내 연락처: ' + h(me.contact || '(적지 않음)') + ' / 알림 동의: ' + (me.consentMsg ? '예' : '아니요') + '</div></div>' +
      '<div class="card"><h3 style="margin-top:0">조각 잔액</h3><div class="big">' + bal + '조각</div>' +
      '<div class="hint">장부 합계로 계산해요. 마이너스 한도: ' + (limit === null ? '(설정 안 됨)' : '-' + limit + '조각') + '</div>' +
      '<div>스탬프: 모은 ' + R.stampsTotal(S, me.id) + '개 / 쓴 ' + R.stampsUsed(S, me.id) + '개 / 남은 <b>' + R.stampsAvailable(S, me.id) + '개</b></div></div></div>' +
      '<h3>조각 장부</h3><div class="tablewrap"><table><tr><th>시각</th><th>종류</th><th>조각</th><th>메모</th></tr>' + rows + '</table></div>' +
      '<h3>내 재능 메뉴 (30분 = 1조각)</h3>' +
      '<form class="card" data-submit="p2-menus">' + menuRows +
      '<div class="row"><input type="text" name="menu_new1" placeholder="새 재능 추가"></div>' +
      '<div class="row"><input type="text" name="menu_new2" placeholder="새 재능 추가"></div>' +
      '<div class="hint">재능은 1개 이상 남아 있어야 해요.</div>' +
      '<div class="row"><button type="submit">재능 메뉴 저장</button></div></form>';
  };
  A['p2-menus'] = function (form) {
    var S = ui.S(), me = ui.me(); if (!me) return;
    var f = form.elements;
    var mine = S.menus.filter(function (m) { return m.ownerId === me.id; });
    var keep = [];
    mine.forEach(function (m) {
      var title = f['menu_' + m.id].value.trim();
      if (f['del_' + m.id].checked || !title) return;
      keep.push({ id: m.id, ownerId: me.id, title: title, units: m.units || 1 });
    });
    ['menu_new1', 'menu_new2'].forEach(function (n) {
      var t = f[n].value.trim();
      if (t) keep.push({ id: LR.store.newId(S, 'm'), ownerId: me.id, title: t, units: 1 });
    });
    if (keep.length < 1) { ui.fail('재능 메뉴는 1개 이상 있어야 해요.'); return; }
    S.menus = S.menus.filter(function (m) { return m.ownerId !== me.id; }).concat(keep);
    ui.done('재능 메뉴를 저장했어요.');
  };

  /* ---------- P3 일정 ---------- */
  V.p3 = function (S) {
    var st = S.settings.currentStage;
    var rows = '';
    for (var w = 1; w <= 4; w++) {
      var rs = S.rounds.filter(function (r) { return r.week === w; });
      var cell = rs.length ? rs.map(function (r) { return '<b>' + h(r.field) + '</b> 라운드' + (r.date ? ' (' + h(r.date) + ')' : ''); }).join('<br>') : '<span class="hint">아직 정해지지 않았어요</span>';
      rows += '<tr><td>' + w + '주차</td><td>' + cell + '</td></tr>';
    }
    return '<h2>P3 일정</h2>' +
      '<div class="card">지금 단계: <b>' + h(C.stageLongNames[st] || st) + '</b><br>' +
      '운영 분야: ' + (S.operatingFields.length ? S.operatingFields.map(function (f) { return '<span class="tag">' + h(f) + '</span>'; }).join(' ') : '<span class="hint">아직 확정 전이에요 (운영자가 분야 배정을 확정하면 보여요)</span>') + '</div>' +
      '<div class="card"><b>시즌 = 4주</b>. 매주 한 분야가 중심인 라운드가 열려요. 라운드에서 새 분야 사람과 연결되면 스탬프를 받아요.' +
      '<div class="tablewrap"><table><tr><th>주차</th><th>라운드 분야 / 날짜</th></tr>' + rows + '</table></div>' +
      '<div class="hint">일정은 운영자가 A5에서 등록해요.</div></div>';
  };

  /* ---------- P4 도와주세요 카드 게시판 ---------- */
  V.p4 = function (S) {
    var me = ui.me();
    var out = '<h2>P4 도와주세요 카드</h2>';
    if (me) {
      out += '<form class="card" data-submit="p4-post"><label class="block" for="cardtext">요즘 막힌 것 한 가지를 적어 주세요</label>' +
        '<textarea id="cardtext" name="text" placeholder="예) 발표 자료 첫 장을 어떻게 시작할지 막혀요"></textarea>' +
        '<div class="row"><button type="submit">카드 올리기</button></div>' +
        '<div class="hint">카드에는 연락처가 보이지 않아요. 교환이 확정된 뒤에만 공개돼요.</div></form>';
    } else {
      out += '<div class="flash warn">운영자로 보고 있어서 카드를 올리거나 응답할 수 없어요. 위쪽 "지금 보는 사람"에서 참가자를 고르면 할 수 있어요.</div>';
    }
    var cards = S.helpCards.slice().reverse();
    if (!cards.length) out += '<div class="card hint">아직 올라온 카드가 없어요.</div>';
    cards.forEach(function (c) {
      var owner = R.getP(S, c.ownerId);
      var body = '<div><b>' + h(owner ? owner.name : '?') + '</b> <span class="tag">' + h(ui.fieldOf(c.ownerId)) + '</span> ' + ui.statusTag(c.status) +
        ' <span class="hint">' + h(ui.fmt(c.createdAt)) + '</span></div><div style="margin:6px 0;white-space:pre-wrap">' + h(c.text) + '</div>';
      if (me && c.ownerId === me.id) {
        var n = S.exchanges.filter(function (e) { return e.cardId === c.id && e.status === '응답'; }).length;
        body += '<div class="hint">내 카드예요. 대기 중인 응답 ' + n + '개 (확정은 운영자가 해요)</div>';
        if (c.status === '열림') body += '<div class="row"><button class="secondary" data-action="p4-close" data-id="' + h(c.id) + '">카드 닫기</button></div>';
      } else if (me && c.status === '열림') {
        var can = R.canRespond(S, me.id, c);
        var myMenus = S.menus.filter(function (m) { return m.ownerId === me.id; });
        body += '<form data-submit="p4-respond" data-card="' + h(c.id) + '"><div class="row">' +
          '<select name="menu">' + ui.options(myMenus.map(function (m) { return m.title; }), '', '내가 줄 재능 고르기') + '</select>' +
          '<label class="small">조각 수 <input type="number" name="units" min="1" step="1" value="1" style="width:70px"></label>' +
          '<button type="submit"' + (can.ok ? '' : ' disabled') + '>이 카드에 응답하기</button></div>' +
          (can.ok ? '<div class="hint">첫 교환은 30분(1조각) 한 번만 할 수 있어요.</div>' : ui.reason(can.reason)) + '</form>';
      }
      out += '<div class="card">' + body + '</div>';
    });
    return out;
  };
  A['p4-post'] = function (form) {
    var S = ui.S(), me = ui.me(); if (!me) return;
    var t = form.elements.text.value.trim();
    if (!t) { ui.fail('카드에 적을 내용을 써 주세요.'); return; }
    S.helpCards.push({ id: LR.store.newId(S, 'c'), ownerId: me.id, text: t, status: '열림', createdAt: R.now() });
    ui.done('카드를 올렸어요.');
  };
  A['p4-close'] = function (el) {
    var c = R.findById(ui.S().helpCards, el.getAttribute('data-id'));
    if (c && c.status === '열림') { c.status = '닫힘'; ui.done('카드를 닫았어요.'); }
  };
  A['p4-respond'] = function (form) {
    var S = ui.S(), me = ui.me(); if (!me) return;
    var menu = form.elements.menu.value;
    if (!menu) { ui.fail('내가 줄 재능을 골라 주세요. (P2에서 재능 메뉴를 추가할 수 있어요)'); return; }
    var r = R.respond(S, me.id, form.getAttribute('data-card'), form.elements.units.value, menu);
    if (!r.ok) { ui.fail(r.reason); return; }
    ui.done('응답했어요! 운영자가 확정하면 연락처가 공개돼요. P5 내 교환에서 확인하세요.');
  };

  /* ---------- P5 내 교환 ---------- */
  var exHelp = {
    '응답': '운영자가 확정하기를 기다리고 있어요. 확정되기 전에는 상대 연락처가 보이지 않아요.',
    '확정': '확정됐어요! 아래 연락처로 약속을 잡아 보세요. 끝나면 운영자가 "완료"로 바꿔요.',
    '완료': '교환이 끝났어요. 서로 고마움 카드를 한 줄씩 써 주세요. 두 사람이 모두 쓰면 운영자가 정산해요.',
    '정산': '정산이 끝나 조각이 반영됐어요.',
    '취소': '취소된 교환이에요.',
    '노쇼': '약속이 지켜지지 않아 노쇼로 처리됐어요.'
  };
  V.p5 = function (S) {
    var me = ui.me();
    if (!me) return '<h2>P5 내 교환</h2>' + ui.needParticipant();
    var list = S.exchanges.filter(function (e) { return e.giverId === me.id || e.receiverId === me.id; }).reverse();
    var out = '<h2>P5 내 교환</h2><div class="hint">탤런트 스왑(재능 교환)의 진행 상황이에요.</div>';
    if (!list.length) out += '<div class="card hint">아직 교환이 없어요. P4 도와주세요 카드에서 다른 분야 사람의 카드에 응답해 보세요.</div>';
    list.forEach(function (e) {
      var iGive = e.giverId === me.id;
      var partnerId = iGive ? e.receiverId : e.giverId;
      var card = R.findById(S.helpCards, e.cardId);
      var ct = R.contactFor(S, me.id, e);
      var myThanks = iGive ? e.thanksGiver : e.thanksReceiver;
      var theirThanks = iGive ? e.thanksReceiver : e.thanksGiver;
      var b = '<div><b>' + (iGive ? '내가 재능을 줘요' : '내가 재능을 받아요') + '</b> ' + ui.statusTag(e.status) + ' <span class="tag">' + e.units + '조각</span></div>' +
        '<div>상대: <b>' + h(ui.pname(partnerId)) + '</b> <span class="tag">' + h(ui.fieldOf(partnerId)) + '</span></div>' +
        '<div class="hint">카드: ' + h(card ? card.text : '') + (e.menuTitle ? ' / 재능: ' + h(e.menuTitle) : '') + '</div>' +
        '<div>' + h(exHelp[e.status] || '') + '</div>' + ui.exTimes(e) +
        '<div style="margin-top:4px">상대 연락처: ' + (ct.visible ? '<b>' + h(ct.text) + '</b>' : '<span class="hint">확정된 뒤에 보여요</span>') + '</div>';
      if (myThanks) b += '<div>내 고마움 카드: ' + h(myThanks) + '</div>';
      if (theirThanks) b += '<div>상대의 고마움 카드: ' + h(theirThanks) + '</div>';
      if (e.status === '완료' && !myThanks) {
        b += '<form data-submit="p5-thanks" data-ex="' + h(e.id) + '"><div class="row"><input type="text" name="text" placeholder="상대에게 고마운 점을 구체적으로 한 줄">' +
          '<button type="submit">고마움 카드 쓰기</button></div></form>';
      }
      out += '<div class="card">' + b + '</div>';
    });
    return out;
  };
  A['p5-thanks'] = function (form) {
    var me = ui.me(); if (!me) return;
    var r = R.writeThanks(ui.S(), form.getAttribute('data-ex'), me.id, form.elements.text.value);
    if (!r.ok) { ui.fail(r.reason); return; }
    ui.done('고마움 카드를 남겼어요.');
  };
})();
