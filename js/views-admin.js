/* =====================================================================
   views-admin.js : 운영자 화면(A1~A8)
   - 구조는 views-participant.js와 같아요. (화면 = LR.views.*, 버튼/양식 동작 = LR.actions.*)
   - 규칙 계산은 rules.js가 하고, 여기서는 "보여 주기"와 "버튼 연결"만 해요.
   ===================================================================== */
(function () {
  var LR = window.LR = window.LR || {};
  var R = LR.rules, C = LR.CONFIG, ui = LR.ui;
  var V = LR.views, A = LR.actions;
  var h = ui.esc;

  function pct(m) {
    if (!m || m.rate === null) return '계산할 대상이 없어요';
    return m.num + ' / ' + m.den + ' = ' + (Math.round(m.rate * 1000) / 10) + '%';
  }
  function byId(id) { return document.getElementById(id); }

  /* ---------- A1 참가자 관리 ---------- */
  V.a1 = function (S) {
    var cur = S.settings.currentStage;
    var counts = {};
    C.stages.forEach(function (st) { counts[st] = S.participants.filter(function (p) { return p.stages && p.stages[st]; }).length; });
    var rows = S.participants.map(function (p) {
      var stageBoxes = C.stages.map(function (st) {
        return '<label class="small"><input type="checkbox" data-change="a1-stage" data-pid="' + h(p.id) + '" data-stage="' + h(st) + '"' + (p.stages[st] ? ' checked' : '') + '> ' + h(st) + '</label>';
      }).join(' ');
      return '<tr><td>' + h(p.name) + '</td><td>' + h(p.pref1) + ' / ' + h(p.pref2) + '</td>' +
        '<td>' + ui.statusTag(p.assignStatus) + '<br>' + h(p.assignedField || '') + '</td>' +
        '<td>' + h(p.contact || '(없음)') + '<br><span class="small">알림 동의: ' + (p.consentMsg ? '예' : '아니요') + '</span></td>' +
        '<td>' + R.balance(S, p.id) + '</td>' +
        '<td>처음 참여: <select data-change="a1-first" data-pid="' + h(p.id) + '">' + ui.options(C.stages, p.firstStage) + '</select><br>' + stageBoxes + '</td></tr>';
    }).join('') || '<tr><td colspan="6">아직 참가자가 없어요. P1에서 가입하거나 A8에서 샘플 데이터를 넣어 보세요.</td></tr>';
    return '<h2>A1 참가자 관리</h2>' +
      '<div class="card">전체 <b>' + S.participants.length + '</b>명 / 단계별 참여: ' + C.stages.map(function (st) { return h(st) + ' ' + counts[st] + '명'; }).join(', ') +
      '<br><span class="hint">지금 단계는 <b>' + h(cur) + '</b>. 아래 체크로 "단계별 참여 여부"를 기록해요. (재방문율 계산에 쓰여요) 운영자 화면에서는 연락처가 보여요.</span></div>' +
      '<div class="tablewrap"><table><tr><th>이름</th><th>1순위 / 2순위</th><th>배정</th><th>연락처</th><th>조각</th><th>참여 단계 기록</th></tr>' + rows + '</table></div>';
  };
  A['a1-stage'] = function (el) {
    var p = R.getP(ui.S(), el.getAttribute('data-pid'));
    if (!p) return;
    p.stages[el.getAttribute('data-stage')] = el.checked;
    ui.done();
  };
  A['a1-first'] = function (el) {
    var p = R.getP(ui.S(), el.getAttribute('data-pid'));
    if (!p) return;
    p.firstStage = el.value;
    p.stages[el.value] = true;
    ui.done();
  };

  /* ---------- A2 분야 배정 ---------- */
  V.a2 = function (S) {
    var n = R.setting(S, 'operatingFieldCount');
    var live = R.assignFields(S.participants, n === null ? 3 : n);
    var countRows = live.fieldCounts.map(function (x) {
      return '<tr><td>' + h(x.field) + '</td><td>' + x.count + '명</td></tr>';
    }).join('') || '<tr><td colspan="2">참가자가 없어요.</td></tr>';
    var out = '<h2>A2 분야 배정</h2>' +
      '<div class="card"><b>1순위로 고른 사람 수</b> (운영 분야 수: ' + (n === null ? '설정 필요' : n + '개') + ')' +
      '<div class="tablewrap"><table style="max-width:360px"><tr><th>분야</th><th>1순위 인원</th></tr>' + countRows + '</table></div>' +
      '<div class="hint">인원이 많은 순서로 위에서 ' + (n === null ? '?' : n) + '개 분야를 운영해요. 운영에서 빠진 분야를 1순위로 고른 사람은 2순위 분야에 배정하고, 1·2순위가 모두 빠지면 "대기"가 돼요.</div>' +
      '<div class="row"><button data-action="a2-run">배정 실행</button></div>' +
      '<div>현재 확정된 운영 분야: ' + (S.operatingFields.length ? S.operatingFields.map(function (f) { return '<span class="tag">' + h(f) + '</span>'; }).join(' ') + ' <span class="hint">(' + h(ui.fmt(S.assignedAt)) + ' 확정)</span>' : '<span class="hint">아직 없음</span>') + '</div></div>';

    var d = ui.assignDraft;
    if (d) {
      var res = d.res;
      if (res.needsChoice) {
        out += '<div class="card"><div class="flash warn"><b>동점, 운영자 선택이 필요해요.</b> 운영 분야 경계에서 인원이 같아요(각 ' + res.tie.count + '명). ' +
          '아래 분야 중 <b>' + res.tie.pick + '개</b>를 골라 주세요. 자동으로 정하지 않아요.</div>' +
          (res.tie.fixed.length ? '<div>이미 정해진 운영 분야: ' + res.tie.fixed.map(h).join(', ') + '</div>' : '') +
          res.tie.tied.map(function (f) { return '<div class="row"><label><input type="checkbox" name="tie" value="' + h(f) + '"> ' + h(f) + '</label></div>'; }).join('') +
          '<div class="row"><button data-action="a2-tie">선택 적용</button><button class="secondary" data-action="a2-cancel">취소</button></div></div>';
      } else {
        var sums = { '1순위배정': 0, '2순위배정': 0, '대기': 0 };
        var rows = S.participants.map(function (p) {
          var r = res.results[p.id]; if (!r) return '';
          sums[r.assignStatus]++;
          return '<tr><td>' + h(p.name) + '</td><td>' + h(p.pref1) + ' / ' + h(p.pref2) + '</td><td>' + ui.statusTag(r.assignStatus) + '</td><td>' + h(r.assignedField || '-') + '</td></tr>';
        }).join('');
        out += '<div class="card"><h3 style="margin-top:0">배정 결과 (아직 저장 전이에요)</h3>' +
          '<div>운영 분야: ' + res.operating.map(function (f) { return '<span class="tag">' + h(f) + '</span>'; }).join(' ') + '</div>' +
          '<div>1순위배정 ' + sums['1순위배정'] + '명 / 2순위배정 ' + sums['2순위배정'] + '명 / 대기 ' + sums['대기'] + '명</div>' +
          '<div class="tablewrap"><table><tr><th>이름</th><th>1순위 / 2순위</th><th>결과</th><th>배정 분야</th></tr>' + rows + '</table></div>' +
          '<div class="row"><button data-action="a2-confirm">확정(저장)</button><button class="secondary" data-action="a2-cancel">취소</button></div>' +
          '<div class="hint">"확정"을 눌러야 저장돼요.' + (S.assignedAt ? ' 이미 확정된 배정이 있으면 덮어써요.' : '') + '</div></div>';
      }
    }
    return out;
  };
  A['a2-run'] = function () {
    var S = ui.S();
    var n = R.setting(S, 'operatingFieldCount');
    if (n === null || n < 1) { ui.fail('운영 분야 수가 설정에 비어 있어요. A8에서 1 이상의 숫자를 넣어 주세요.'); return; }
    if (!S.participants.length) { ui.fail('참가자가 없어요. 먼저 가입(P1)하거나 샘플 데이터를 넣어 주세요.'); return; }
    if (S.assignedAt && !window.confirm('이미 확정된 분야 배정이 있어요. 다시 실행하고 확정하면 지금 배정을 덮어써요. 계속할까요?')) return;
    ui.assignDraft = { res: R.assignFields(S.participants, n) };
    LR.app.render();
  };
  A['a2-tie'] = function () {
    var S = ui.S();
    var picked = Array.prototype.slice.call(document.querySelectorAll('input[name="tie"]:checked')).map(function (x) { return x.value; });
    var res = R.assignFields(S.participants, R.setting(S, 'operatingFieldCount'), picked);
    if (res.needsChoice) { ui.fail('동점 분야에서 정확히 ' + res.tie.pick + '개를 골라 주세요.'); return; }
    ui.assignDraft = { res: res };
    LR.app.render();
  };
  A['a2-cancel'] = function () { ui.assignDraft = null; LR.app.render(); };
  A['a2-confirm'] = function () {
    var S = ui.S();
    if (!ui.assignDraft || ui.assignDraft.res.needsChoice) return;
    if (S.assignedAt && !window.confirm('지금 배정을 새 결과로 덮어쓸까요? (이미 올라온 교환은 그대로 남아요)')) return;
    R.applyAssignment(S, ui.assignDraft.res);
    ui.assignDraft = null;
    ui.done('분야 배정을 확정하고 저장했어요.');
  };

  /* ---------- A3 알림 대상 ---------- */
  V.a3 = function (S) {
    var t = R.notifyTargets(S);
    var rows = t.list.map(function (p) {
      return '<tr><td>' + h(p.name) + '</td><td>' + h(p.pref1) + ' / ' + h(p.pref2) + '</td><td>' + h(p.contact || '(연락처 없음)') + '</td><td>' + (t.sendDate ? h(t.sendDate) : '<span class="hint">시작일 미입력</span>') + '</td>' +
        '<td><label><input type="checkbox" data-change="a3-notified" data-pid="' + h(p.id) + '"' + (p.notified ? ' checked' : '') + '> 발송함</label></td></tr>';
    }).join('') || '<tr><td colspan="5">알림 대상이 없어요.</td></tr>';
    return '<h2>A3 알림 대상</h2>' +
      '<div class="card">1순위와 2순위가 <b>모두</b> 운영에서 빠져 "대기"가 되고, 문자·메일 수신에 <b>동의한</b> 사람만 나와요. 2순위 분야로 배정된 사람은 넣지 않아요.<br>' +
      '발송 예정일 = 다음 단계 시작일 - ' + (R.setting(S, 'noticeDaysBefore') === null ? '?' : R.setting(S, 'noticeDaysBefore')) + '일: ' +
      (t.sendDate ? '<b>' + h(t.sendDate) + '</b>' : '<span class="neg">정할 수 없어요. A8 설정에서 "다음 단계 시작일"을 넣어 주세요.</span>') +
      '<br><span class="hint">대기 ' + t.waitingTotal + '명 중 수신 동의 ' + t.list.length + '명 (동의 안 한 ' + t.waitingNoConsent + '명은 목록에 없어요)</span>' +
      '<br><b>실제 문자·메일 발송은 운영자가 직접 해요.</b> 이 화면은 "발송함" 표시만 남겨요.</div>' +
      '<div class="tablewrap"><table><tr><th>이름</th><th>1순위 / 2순위</th><th>연락처</th><th>발송 예정일</th><th>발송 표시</th></tr>' + rows + '</table></div>';
  };
  A['a3-notified'] = function (el) {
    var p = R.getP(ui.S(), el.getAttribute('data-pid'));
    if (!p) return;
    p.notified = el.checked;
    ui.done();
  };

  /* ---------- A4 교환 관리 ---------- */
  V.a4 = function (S) {
    var limit = R.setting(S, 'minusLimit');
    var noShow = R.canNoShow(S);
    var exRows = S.exchanges.slice().reverse().map(function (e) {
      var card = R.findById(S.helpCards, e.cardId);
      var contact = R.contactFor(S, 'admin', e);
      var act = '';
      if (e.status === '응답') {
        var cc = R.canConfirm(S, e.id);
        act += '<button data-action="a4-confirm" data-id="' + h(e.id) + '"' + (cc.ok ? '' : ' disabled') + '>확정</button> ' +
          '<button class="danger" data-action="a4-cancel" data-id="' + h(e.id) + '">취소</button>' + ui.reason(cc.ok ? '' : cc.reason);
      } else if (e.status === '확정') {
        act += '<button data-action="a4-complete" data-id="' + h(e.id) + '">완료</button> ' +
          '<button class="danger" data-action="a4-cancel" data-id="' + h(e.id) + '">취소</button>' +
          '<div class="row"><select id="culprit_' + h(e.id) + '">' + ui.options([{ value: e.giverId, text: ui.pname(e.giverId) + ' (주는 사람)' }, { value: e.receiverId, text: ui.pname(e.receiverId) + ' (받는 사람)' }], '') + '</select>' +
          '<button class="danger" data-action="a4-noshow" data-id="' + h(e.id) + '"' + (noShow.ok ? '' : ' disabled') + '>노쇼 처리</button></div>' + ui.reason(noShow.ok ? '' : noShow.reason);
      } else if (e.status === '완료') {
        var cs = R.canSettle(S, e.id);
        act += '<button data-action="a4-settle" data-id="' + h(e.id) + '"' + (cs.ok ? '' : ' disabled') + '>정산</button>' + ui.reason(cs.ok ? '' : cs.reason);
      } else {
        act += '<span class="hint">처리 끝</span>';
      }
      act += '<div class="row"><textarea id="memo_' + h(e.id) + '" style="min-height:40px;max-width:220px" placeholder="분쟁 메모">' + h(e.disputeMemo || '') + '</textarea><button class="secondary" data-action="a4-memo" data-id="' + h(e.id) + '">메모 저장</button></div>';
      return '<tr><td>' + h(e.id) + '</td><td>' + h(card ? card.text : '') + '</td>' +
        '<td>주는 사람: <b>' + h(ui.pname(e.giverId)) + '</b> (' + h(ui.fieldOf(e.giverId)) + ')<br>받는 사람: <b>' + h(ui.pname(e.receiverId)) + '</b> (' + h(ui.fieldOf(e.receiverId)) + ')</td>' +
        '<td>' + e.units + '조각</td><td>' + ui.statusTag(e.status) + (e.newFieldBonus ? '<br><span class="tag">새 분야 보너스</span>' : '') + ui.exTimes(e) + '</td>' +
        '<td class="small">주는 사람: ' + h(e.thanksGiver || '(아직)') + '<br>받는 사람: ' + h(e.thanksReceiver || '(아직)') + '</td>' +
        '<td class="small">' + h(contact.text) + '</td><td>' + act + '</td></tr>';
    }).join('') || '<tr><td colspan="8">아직 교환이 없어요.</td></tr>';

    var balRows = S.participants.map(function (p) {
      var b = R.balance(S, p.id);
      var warn = limit !== null && b < -limit;
      return '<tr><td>' + h(p.name) + '</td><td>' + h(p.assignedField || '-') + '</td><td>' + ui.signed(b) + '</td><td>' +
        (warn ? '<span class="tag err">한도(-' + limit + ') 아래 - 수동 조정이 필요해요</span>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="4">참가자가 없어요.</td></tr>';

    return '<h2>A4 교환 관리</h2>' +
      '<div class="card hint">흐름: 응답 -> <b>확정</b> -> <b>완료</b> -> 두 사람의 고마움 카드 -> <b>정산</b>. 확정할 때 같은 분야 검사·첫 교환 30분·마이너스 한도를 다시 확인해요. 버튼이 꺼져 있으면 아래 빨간 글씨가 이유예요.</div>' +
      '<div class="tablewrap"><table><tr><th>번호</th><th>카드</th><th>사람</th><th>조각</th><th>상태</th><th>고마움 카드</th><th>연락처(운영자만)</th><th>처리</th></tr>' + exRows + '</table></div>' +
      '<h3>수동 조정 (이유 필수)</h3>' +
      '<form class="card" data-submit="a4-adjust"><div class="row">' +
      '<select name="pid">' + ui.options(S.participants.map(function (p) { return { value: p.id, text: p.name }; }), '', '참가자 고르기') + '</select>' +
      '<label class="small">조각 <input type="number" name="amount" step="1" style="width:80px" placeholder="예: -1"></label>' +
      '<input type="text" name="memo" style="max-width:300px" placeholder="조정 이유 (꼭 적어요)">' +
      '<button type="submit">조정 기록</button></div>' +
      '<div class="hint">조각은 현금이 아니고, 현금으로 바꾸는 기능은 없어요. 조정도 장부에 한 줄로 남아요.</div></form>' +
      '<h3>참가자별 조각 잔액</h3><div class="tablewrap"><table><tr><th>이름</th><th>분야</th><th>잔액</th><th>경고</th></tr>' + balRows + '</table></div>';
  };
  A['a4-confirm'] = function (el) {
    var r = R.confirmExchange(ui.S(), el.getAttribute('data-id'));
    if (!r.ok) ui.fail(r.reason); else ui.done('확정했어요. 이제 두 사람에게 상대 연락처가 보여요.');
  };
  A['a4-complete'] = function (el) {
    var r = R.completeExchange(ui.S(), el.getAttribute('data-id'));
    if (!r.ok) ui.fail(r.reason); else ui.done('완료로 바꿨어요. 이제 두 사람이 고마움 카드를 쓸 수 있어요.');
  };
  A['a4-settle'] = function (el) {
    var S = ui.S();
    var r = R.settle(S, el.getAttribute('data-id'));
    if (!r.ok) { ui.fail(r.reason); return; }
    ui.done('정산했어요.' + (r.bonusTo.length ? ' 새 분야 첫 교환 보너스: ' + r.bonusTo.map(ui.pname).join(', ') : ''));
  };
  A['a4-cancel'] = function (el) {
    if (!window.confirm('이 교환을 취소할까요?')) return;
    var r = R.cancelExchange(ui.S(), el.getAttribute('data-id'));
    if (!r.ok) ui.fail(r.reason); else ui.done('취소했어요.');
  };
  A['a4-noshow'] = function (el) {
    var id = el.getAttribute('data-id');
    var sel = byId('culprit_' + id);
    var r = R.markNoShow(ui.S(), id, sel ? sel.value : '');
    if (!r.ok) { ui.fail(r.reason); return; }
    ui.done('노쇼로 처리하고 조각을 차감했어요.' + (r.warning ? ' ' + r.warning : ''), r.warning ? 'warn' : 'ok');
  };
  A['a4-memo'] = function (el) {
    var id = el.getAttribute('data-id');
    var e = R.findById(ui.S().exchanges, id);
    if (e) { e.disputeMemo = byId('memo_' + id).value; ui.done('분쟁 메모를 저장했어요.'); }
  };
  A['a4-adjust'] = function (form) {
    var f = form.elements;
    var r = R.manualAdjust(ui.S(), f.pid.value, f.amount.value, f.memo.value);
    if (!r.ok) ui.fail(r.reason); else ui.done('수동 조정을 장부에 기록했어요.');
  };

  /* ---------- A5 스탬프·혜택 ---------- */
  V.a5 = function (S) {
    var assigned = S.participants.filter(function (p) { return p.assignedField; });
    var redeemOff = R.setting(S, 'stampsPerBenefit') === null || R.setting(S, 'stampsPerBenefit') < 1;
    var rounds = S.rounds.slice().sort(function (a, b) { return a.week - b.week; });
    var roundRows = rounds.map(function (r) {
      return '<tr><td>' + r.week + '주차</td><td>' + h(r.field) + '</td><td>' + h(r.date || '') + '</td><td><button class="danger" data-action="a5-round-del" data-id="' + h(r.id) + '">지우기</button></td></tr>';
    }).join('') || '<tr><td colspan="4">등록된 라운드가 없어요.</td></tr>';
    var roundOpts = rounds.map(function (r) { return { value: r.id, text: r.week + '주차 ' + r.field }; });
    var pOpts = assigned.map(function (p) { return { value: p.id, text: p.name + ' (' + p.assignedField + ')' }; });

    // 연결 기록: 스탬프 한 쌍을 한 줄로
    var seen = {}, pairs = [];
    S.stamps.forEach(function (t) {
      var key = [t.participantId, t.partnerId].sort().join('|');
      if (!seen[key]) { seen[key] = true; pairs.push(t); }
    });
    var pairRows = pairs.slice().reverse().map(function (t) {
      return '<tr><td>' + h(ui.pname(t.participantId)) + ' (' + h(ui.fieldOf(t.participantId)) + ')</td><td>' + h(ui.pname(t.partnerId)) + ' (' + h(ui.fieldOf(t.partnerId)) + ')</td><td>' + h(ui.fmt(t.at)) + '</td></tr>';
    }).join('') || '<tr><td colspan="3">아직 연결 기록이 없어요.</td></tr>';

    var benefitRows = S.participants.map(function (p) {
      var can = R.canRedeem(S, p.id);
      var btns = C.benefits.map(function (b) {
        return '<button class="secondary" data-action="a5-redeem" data-pid="' + h(p.id) + '" data-benefit="' + h(b) + '"' + (can.ok ? '' : ' disabled') + '>' + h(b) + '</button>';
      }).join(' ');
      return '<tr><td>' + h(p.name) + '</td><td>모은 ' + R.stampsTotal(S, p.id) + ' / 쓴 ' + R.stampsUsed(S, p.id) + ' / <b>남은 ' + R.stampsAvailable(S, p.id) + '</b></td><td>' + btns +
        (redeemOff ? '' : ui.reason(can.ok ? '' : can.reason)) + '</td></tr>';
    }).join('') || '<tr><td colspan="3">참가자가 없어요.</td></tr>';

    var redRows = S.redemptions.slice().reverse().map(function (r) {
      return '<tr><td>' + h(ui.fmt(r.at)) + '</td><td>' + h(ui.pname(r.participantId)) + '</td><td>' + h(r.benefit) + '</td><td>' + r.stampsUsed + '개</td></tr>';
    }).join('') || '<tr><td colspan="4">아직 교환 기록이 없어요.</td></tr>';

    return '<h2>A5 스탬프·혜택</h2>' +
      '<h3>라운드 일정 등록</h3><form class="card" data-submit="a5-round"><div class="row">' +
      '<select name="week">' + ui.options([1, 2, 3, 4].map(function (w) { return { value: w, text: w + '주차' }; }), '') + '</select>' +
      '<select name="field">' + ui.options(ui.fieldChoices(S), '', '분야 고르기') + '</select>' +
      '<input type="date" name="date"><button type="submit">라운드 추가</button></div></form>' +
      '<div class="tablewrap"><table><tr><th>주차</th><th>분야</th><th>날짜</th><th></th></tr>' + roundRows + '</table></div>' +
      '<h3>연결 기록하기 (스탬프)</h3>' +
      '<form class="card" data-submit="a5-stamp"><div class="hint">라운드에서 서로 연결된 두 사람을 고르면, <b>서로 다른 분야</b>일 때만 두 사람에게 스탬프가 1개씩 생겨요. 같은 두 사람 사이에는 한 번만 생겨요. (재능 교환을 해도 스탬프가 자동으로 생기지는 않아요)</div><div class="row">' +
      '<select name="round">' + ui.options(roundOpts, '', '라운드(선택 안 해도 돼요)') + '</select>' +
      '<select name="a">' + ui.options(pOpts, '', '사람 1') + '</select><select name="b">' + ui.options(pOpts, '', '사람 2') + '</select>' +
      '<button type="submit">연결 기록</button></div></form>' +
      '<div class="tablewrap"><table><tr><th>사람 1</th><th>사람 2</th><th>기록 시각</th></tr>' + pairRows + '</table></div>' +
      '<h3>혜택으로 바꾸기</h3>' +
      (redeemOff ? '<div class="flash warn"><b>혜택 교환 버튼이 꺼져 있어요.</b> 혜택 1번에 필요한 스탬프 수(stampsPerBenefit)가 아직 정해지지 않았어요. 운영자 화면 A8 설정에 숫자를 넣으면 켜져요.</div>' : '<div class="hint">혜택 1번에 스탬프 ' + R.setting(S, 'stampsPerBenefit') + '개가 필요해요.</div>') +
      '<div class="tablewrap"><table><tr><th>이름</th><th>스탬프</th><th>혜택 (공간 대여 / 전시 초대 / 재능 교환)</th></tr>' + benefitRows + '</table></div>' +
      '<h3>혜택 교환 기록</h3><div class="tablewrap"><table><tr><th>시각</th><th>이름</th><th>혜택</th><th>쓴 스탬프</th></tr>' + redRows + '</table></div>';
  };
  A['a5-round'] = function (form) {
    var S = ui.S(), f = form.elements;
    if (!f.field.value) { ui.fail('라운드 분야를 골라 주세요.'); return; }
    S.rounds.push({ id: LR.store.newId(S, 'u'), week: Number(f.week.value), field: f.field.value, date: f.date.value });
    ui.done('라운드를 추가했어요.');
  };
  A['a5-round-del'] = function (el) {
    var S = ui.S();
    S.rounds = S.rounds.filter(function (r) { return r.id !== el.getAttribute('data-id'); });
    ui.done('라운드를 지웠어요.');
  };
  A['a5-stamp'] = function (form) {
    var f = form.elements;
    var r = R.addStampPair(ui.S(), f.a.value, f.b.value, f.round.value);
    if (!r.ok) ui.fail(r.reason); else ui.done('연결을 기록했어요. 두 사람에게 스탬프가 1개씩 생겼어요.');
  };
  A['a5-redeem'] = function (el) {
    var r = R.redeem(ui.S(), el.getAttribute('data-pid'), el.getAttribute('data-benefit'));
    if (!r.ok) ui.fail(r.reason); else ui.done('혜택으로 교환했어요.');
  };

  /* ---------- A6 대회 팀 짜기 ---------- */
  V.a6 = function (S) {
    var size = R.setting(S, 'teamSize');
    var assignedCount = S.participants.filter(function (p) { return p.assignedField; }).length;
    var fieldsN = S.operatingFields.length;
    var teamHtml = S.teams.map(function (t, i) {
      var d = R.teamDistinctFields(S, t);
      return '<tr><td>' + (i + 1) + '팀</td><td>' + t.memberIds.map(function (id) { return h(ui.pname(id)) + ' <span class="tag">' + h(ui.fieldOf(id)) + '</span>'; }).join('<br>') + '</td>' +
        '<td>' + t.memberIds.length + '명 / 분야 ' + d + '개' + (d < t.memberIds.length ? ' <span class="tag warn">같은 분야 겹침</span>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="3">아직 팀이 없어요.</td></tr>';
    return '<h2>A6 대회 팀 짜기</h2>' +
      '<div class="card">첫 대회는 <b>"섞어서 팀 짜는 대회"</b>예요. 분야가 배정된 참가자 <b>' + assignedCount + '명</b>을 ' + (size === null ? '?' : size) + '명씩 서로 다른 분야가 되도록 최대한 섞어요.' +
      '<div class="hint">운영 분야가 ' + fieldsN + '개이고 팀이 ' + (size === null ? '?' : size) + '명이면' + (fieldsN && size !== null && fieldsN < size ? ' 한 분야가 1명 겹쳐요(허용). 운영 분야 수를 늘리면(A8) 겹치지 않아요.' : ' 분야가 겹치지 않게 짤 수 있어요.') + ' 누를 때마다 결과가 달라져요.</div>' +
      '<div class="row"><button data-action="a6-make">섞어서 팀 만들기</button></div></div>' +
      '<div class="tablewrap"><table><tr><th>팀</th><th>멤버</th><th>구성</th></tr>' + teamHtml + '</table></div>';
  };
  A['a6-make'] = function () {
    var S = ui.S();
    if (S.teams.length && !window.confirm('이미 만든 팀이 있어요. 새로 섞어 덮어쓸까요?')) return;
    var r = R.buildTeams(S);
    if (!r.ok) ui.fail(r.reason); else ui.done(r.count + '개 팀을 만들었어요.');
  };

  /* ---------- A7 지표·지출 ---------- */
  V.a7 = function (S) {
    var m = R.metrics(S);
    var total = 0;
    var expRows = S.expenses.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (e) {
      total += e.amount;
      return '<tr><td>' + h(e.date) + '</td><td>' + h(e.item) + '</td><td>' + e.amount.toLocaleString() + '원</td><td>' + h(e.receiptNote || '') + '</td><td><button class="danger" data-action="a7-exp-del" data-id="' + h(e.id) + '">지우기</button></td></tr>';
    }).join('') || '<tr><td colspan="5">아직 지출 기록이 없어요.</td></tr>';
    function box(title, val, note) { return '<div class="card"><div class="hint">' + title + '</div><div class="big" style="font-size:22px">' + val + '</div><div class="hint">' + note + '</div></div>'; }
    return '<h2>A7 지표·지출</h2>' +
      '<div class="hint">직접 기록한 값만 보여요. 기록이 없는 수치는 쓰지 않아요. 지금 단계: <b>' + h(m.currentStage) + '</b></div><div class="grid2">' +
      box('1. 가입자 수', m.signups + '명', '이번 단계 참여 ' + m.attendedNow + '명 = 이어서 온 사람 ' + m.continued + '명 + 새로 온 사람 ' + m.newcomers + '명') +
      box('2. 재방문율', m.revisit ? pct(m.revisit) : '해당 없음', m.revisit ? '앞 단계(' + h(m.revisit.prevStage) + ') 참가자 중 이번 단계에도 온 사람 / 앞 단계 참가자 전체' : '첫 단계(시범)에는 앞 단계가 없어요') +
      box('3. 연결 성사 건수', m.connections + '건', '기준: ' + m.connectionBasis + ' (A8 설정에서 바꿀 수 있어요)') +
      box('연결 건수 (두 기준 모두)', '교환 ' + m.exchangeLinks + ' / 스탬프 ' + m.stampLinks, '재능 교환 연결(확정된 교환 1건 = 1연결) / 라운드 스탬프 연결(A5에 기록한 만남)') +
      box('4. 번개 프로젝트 개수', m.lightning === null ? '아직 입력 안 함' : m.lightning + '개', '아래에서 직접 입력') +
      box('5. 초대 코드 가입자 수', m.invite === null ? '아직 입력 안 함' : m.invite + '명', '아래에서 직접 입력') +
      box('교환 건수', m.exchangeCount + '건', '확정 이상 / 정산 완료 ' + m.settledCount + '건') +
      box('새 분야 첫 교환 비율', pct(m.newField), '새 분야 보너스가 나간 교환 / 정산된 교환 전체') +
      box('다시 요청한 사람 수', m.repeatRequesters + '명', '교환을 1번 이상 마친 뒤 도와주세요 카드를 다시 올린 사람') + '</div>' +
      '<form class="card" data-submit="a7-manual"><b>직접 입력하는 지표</b><div class="row">' +
      '<label class="small">번개 프로젝트 개수 <input type="number" name="lightning" min="0" step="1" style="width:90px" value="' + h(S.manualMetrics.lightningCount) + '"></label>' +
      '<label class="small">초대 코드 가입자 수 <input type="number" name="invite" min="0" step="1" style="width:90px" value="' + h(S.manualMetrics.inviteCount) + '"></label>' +
      '<button type="submit">저장</button></div></form>' +
      '<h3>지출 기록</h3><form class="card" data-submit="a7-expense"><div class="row">' +
      '<input type="date" name="date" value="' + ui.today() + '"><input type="text" name="itemName" style="max-width:220px" placeholder="항목 (예: 다과비)">' +
      '<label class="small">금액(원) <input type="number" name="amount" min="0" step="1" style="width:120px"></label>' +
      '<input type="text" name="receipt" style="max-width:240px" placeholder="영수증 파일 이름 메모"><button type="submit">지출 추가</button></div>' +
      '<div class="hint">영수증 사진은 이 프로그램에 올리지 않고, 파일 이름만 메모해 두세요. 실제 파일은 따로 보관하세요.</div></form>' +
      '<div class="tablewrap"><table><tr><th>날짜</th><th>항목</th><th>금액</th><th>영수증 메모</th><th></th></tr>' + expRows + '</table></div>' +
      '<div><b>지출 합계: ' + total.toLocaleString() + '원</b></div>';
  };
  A['a7-manual'] = function (form) {
    var S = ui.S(), f = form.elements;
    function chk(v) { return v === '' || (R.toInt(v) !== null && R.toInt(v) >= 0); }
    if (!chk(f.lightning.value) || !chk(f.invite.value)) { ui.fail('0 이상의 정수로 적거나 비워 주세요.'); return; }
    S.manualMetrics.lightningCount = f.lightning.value;
    S.manualMetrics.inviteCount = f.invite.value;
    ui.done('저장했어요.');
  };
  A['a7-expense'] = function (form) {
    var S = ui.S(), f = form.elements;
    var amt = R.toInt(f.amount.value);
    if (!f.date.value || !f.itemName.value.trim() || amt === null || amt < 0) { ui.fail('날짜, 항목, 금액(0 이상의 정수)을 모두 적어 주세요.'); return; }
    S.expenses.push({ id: LR.store.newId(S, 'e'), date: f.date.value, item: f.itemName.value.trim(), amount: amt, receiptNote: f.receipt.value.trim() });
    ui.done('지출을 기록했어요.');
  };
  A['a7-exp-del'] = function (el) {
    if (!window.confirm('이 지출 기록을 지울까요?')) return;
    var S = ui.S();
    S.expenses = S.expenses.filter(function (e) { return e.id !== el.getAttribute('data-id'); });
    ui.done('지웠어요.');
  };

  /* ---------- A8 설정·백업 ---------- */
  V.a8 = function (S) {
    var st = S.settings;
    function num(key, label, note) {
      return '<div class="row"><label style="min-width:230px">' + label + '</label><input type="number" name="' + key + '" step="1" style="width:110px" value="' + h(st[key]) + '"><span class="hint">' + note + '</span></div>';
    }
    return '<h2>A8 설정·백업</h2>' +
      '<form class="card" data-submit="a8-settings"><h3 style="margin-top:0">규칙 숫자 설정</h3>' +
      '<div class="hint">저장하면 규칙에 바로 반영돼요. 일부러 비워 둔 칸은 기획서에서 아직 정해지지 않은 값이에요.</div>' +
      num('unitMinutes', '조각 1개의 시간(분)', '30분 = 1조각') +
      num('signupGift', '가입 선물 조각', '새로 가입할 때만 적용돼요') +
      num('newFieldBonus', '새 분야 첫 교환 보너스', '정산할 때 지급') +
      num('minusLimit', '마이너스 한도(조각)', '잔액이 -이 값 아래로 내려가지 못해요') +
      num('operatingFieldCount', '운영 분야 수', '1 이상. 늘리면 대회 팀 분야가 덜 겹쳐요') +
      num('teamSize', '대회 팀 인원', '2 이상') +
      num('noticeDaysBefore', '알림 며칠 전', '다음 단계 시작일보다 며칠 전에 알릴지(3주 = 21)') +
      '<div class="row"><label style="min-width:230px">혜택 1번에 필요한 스탬프 수</label><input type="number" name="stampsPerBenefit" min="1" step="1" style="width:110px" value="' + h(st.stampsPerBenefit) + '"><span class="hint">비어 있음 = 아직 미정. 비우면 혜택 교환 버튼이 꺼져요</span></div>' +
      '<div class="row"><label style="min-width:230px">노쇼 차감 조각 수</label><input type="number" name="noShowPenalty" min="1" step="1" style="width:110px" value="' + h(st.noShowPenalty) + '"><span class="hint">비어 있음 = 아직 미정. 비우면 노쇼 처리 버튼이 꺼져요</span></div>' +
      '<div class="row"><label style="min-width:230px">다음 단계 시작일</label><input type="date" name="nextStageStartDate" value="' + h(st.nextStageStartDate) + '"><span class="hint">알림 발송 예정일 계산에 써요</span></div>' +
      '<div class="row"><label style="min-width:230px">지금 진행 중인 단계</label><select name="currentStage">' + ui.options(C.stages.map(function (s) { return { value: s, text: s + ' - ' + C.stageLongNames[s] }; }), st.currentStage) + '</select></div>' +
      '<div class="row"><label style="min-width:230px">새 분야 보너스 받는 사람</label><select name="bonusRecipient">' + ui.options(C.bonusRecipientOptions, st.bonusRecipient) + '</select></div>' +
      '<div class="row"><label style="min-width:230px">연결 성사 건수 기준</label><select name="connectionBasis">' + ui.options(C.connectionBasisOptions, st.connectionBasis) + '</select><span class="hint">지표 3번에 쓸 기준. 두 기준 숫자는 A7에 항상 함께 나와요</span></div>' +
      '<label class="block">후보 분야 (한 줄에 하나씩, 직접 추가 가능)</label><textarea name="candidateFields" style="min-height:100px">' + h(st.candidateFields.join('\n')) + '</textarea>' +
      '<div class="hint">가입 화면의 선택 목록에 나와요. 2개 이상 필요해요.</div>' +
      '<div class="row"><button type="submit">설정 저장</button></div></form>' +

      '<div class="card"><h3 style="margin-top:0">백업 (JSON 파일)</h3>' +
      '<div class="hint">데이터는 이 컴퓨터의 이 브라우저에만 저장돼요. 브라우저 기록을 지우면 사라지니, 자주 내보내기로 백업해 두세요. 백업 파일에는 가짜 연락처만 들어 있어야 해요.</div>' +
      '<div class="row"><button data-action="a8-export">내보내기 (파일 내려받기)</button>' +
      '<label class="btn secondary" style="display:inline-block">가져오기 (파일 고르기)<input type="file" accept=".json,application/json" data-change="a8-import" style="display:none"></label></div></div>' +

      '<div class="card"><h3 style="margin-top:0">샘플 데이터 / 전체 초기화</h3>' +
      '<div class="row"><button class="secondary" data-action="load-sample">샘플 데이터 넣기 (가짜 24명)</button>' +
      '<button class="danger" data-action="a8-reset">전체 초기화</button></div>' +
      '<div class="hint">샘플은 가짜 이름과 가짜 연락처(example.com)예요. 넣으면 지금 데이터가 샘플로 바뀌어요. 전체 초기화는 확인 창이 2번 나와요.</div></div>';
  };
  A['a8-settings'] = function (form) {
    var S = ui.S(), f = form.elements, errs = [], nv = {};
    function req(key, label, min) {
      var v = R.toInt(f[key].value);
      if (v === null || v < min) errs.push(label + ': ' + min + ' 이상의 정수를 적어 주세요.'); else nv[key] = v;
    }
    function opt(key, label, min) {
      var raw = f[key].value.trim();
      if (raw === '') { nv[key] = ''; return; }
      var v = R.toInt(raw);
      if (v === null || v < min) errs.push(label + ': 비우거나 ' + min + ' 이상의 정수를 적어 주세요.'); else nv[key] = v;
    }
    req('unitMinutes', '조각 1개의 시간', 1); req('signupGift', '가입 선물', 0); req('newFieldBonus', '새 분야 보너스', 0);
    req('minusLimit', '마이너스 한도', 0); req('operatingFieldCount', '운영 분야 수', 1); req('teamSize', '대회 팀 인원', 2);
    req('noticeDaysBefore', '알림 며칠 전', 0);
    opt('stampsPerBenefit', '혜택에 필요한 스탬프 수', 1); opt('noShowPenalty', '노쇼 차감 조각 수', 1);
    var fields = f.candidateFields.value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    if (fields.length < 2) errs.push('후보 분야는 2개 이상 필요해요.');
    if (errs.length) { ui.fail(errs.join('\n')); return; }
    Object.keys(nv).forEach(function (k) { S.settings[k] = nv[k]; });
    S.settings.nextStageStartDate = f.nextStageStartDate.value;
    S.settings.currentStage = f.currentStage.value;
    S.settings.bonusRecipient = f.bonusRecipient.value;
    S.settings.connectionBasis = f.connectionBasis.value;
    S.settings.candidateFields = fields;
    ui.done('설정을 저장했어요. 규칙에 바로 반영돼요.');
  };
  A['a8-export'] = function () {
    var text = LR.store.exportJSON();
    var d = new Date();
    function z(n) { return n < 10 ? '0' + n : '' + n; }
    var name = 'linkrote-backup-' + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + '.json';
    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    ui.setFlash('백업 파일(' + name + ')을 내려받았어요. 브라우저의 다운로드 폴더를 확인하세요.');
    LR.app.render();
  };
  A['a8-import'] = function (el) {
    var file = el.files && el.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var check = LR.store.parse(String(reader.result));
      if (!check.ok) { ui.fail(check.reason); return; }
      if (!window.confirm('지금 데이터를 이 백업 파일의 내용으로 통째로 바꿉니다. 계속할까요?')) return;
      LR.store.state = check.state;
      LR.store.save();
      ui.assignDraft = null;
      ui.done('백업 파일에서 복원했어요. (참가자 ' + check.state.participants.length + '명)');
    };
    reader.readAsText(file, 'utf-8');
  };
  A['a8-reset'] = function () {
    if (LR.store.resetAll()) { ui.assignDraft = null; ui.setFlash('전체 초기화했어요.'); LR.app.render(); }
  };

  /* ---------- 샘플 데이터 (가짜 참가자 24명) ---------- */
  A['load-sample'] = function () {
    var old = ui.S();
    if (old.participants.length && !window.confirm('지금 데이터가 모두 샘플 데이터로 바뀌어요. 계속할까요? (먼저 A8에서 백업해 두면 안전해요)')) return;
    var ns = LR.store.emptyState();
    ns.settings = JSON.parse(JSON.stringify(old.settings)); // 설정은 그대로 유지
    var F = { d: '디자인·예술', w: '복지·사회', b: '기획·스타트업', t: '통역·번역' };
    Object.keys(F).forEach(function (k) { if (ns.settings.candidateFields.indexOf(F[k]) < 0) ns.settings.candidateFields.push(F[k]); });
    // [1순위, 2순위] 24명: 디자인 8, 복지 7, 기획 6, 통역 3 (운영 3개면 통역이 빠져 2순위배정이 생겨요)
    var plan = [];
    ['w', 'b', 'w', 'b', 'w', 't', 'b', 'w'].forEach(function (s) { plan.push([F.d, F[s]]); });
    ['d', 'b', 'd', 'd', 'b', 't', 'd'].forEach(function (s) { plan.push([F.w, F[s]]); });
    ['d', 'w', 't', 'd', 't', 'w'].forEach(function (s) { plan.push([F.b, F[s]]); });
    ['b', 'd', 'w'].forEach(function (s) { plan.push([F.t, F[s]]); });
    var ids = [];
    plan.forEach(function (pr, i) {
      var contact = (i % 5 === 4) ? '' : (i % 2 === 0 ? '010-0000-' + (1000 + i) : 'sample' + (i + 1) + '@example.com');
      var r = R.signup(ns, {
        name: '샘플 ' + C.sampleNames[i], pref1: pr[0], pref2: pr[1], contact: contact,
        consentMsg: contact !== '' && i % 3 !== 2, menus: [pr[0] + ' 상담 30분', pr[0] + ' 자료 피드백 30분']
      });
      ids.push(r.participant.id);
    });
    var texts = [[0, '포트폴리오 첫 장을 어떻게 시작할지 막혀요'], [8, '봉사 프로그램 소개글이 딱딱해서 고민이에요'],
                 [15, '아이디어는 있는데 발표 순서를 못 정하겠어요'], [21, '영문 소개 메일 문장을 자연스럽게 다듬고 싶어요']];
    texts.forEach(function (t) {
      ns.helpCards.push({ id: LR.store.newId(ns, 'c'), ownerId: ids[t[0]], text: t[1], status: '열림', createdAt: R.now() });
    });
    LR.store.state = ns;
    ui.assignDraft = null; ui.p1Draft = null;
    ui.done('샘플 데이터(가짜 24명)를 넣었어요. 이제 A2에서 "배정 실행"을 눌러 보세요.');
  };
})();
