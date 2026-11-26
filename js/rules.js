/* =====================================================================
   rules.js : 링크로테의 "규칙"만 모아 둔 파일 (화면 코드와 분리)
   - 여기 함수들은 화면을 건드리지 않고, 받은 데이터(s)만 보고 계산합니다.
   - 그래서 test.html에서 그대로 불러다 자동 점검을 할 수 있어요.
   - 대부분의 함수는 {ok:true/false, reason:'이유 문구'} 형태로 답합니다.
   - 규칙 숫자(가입 선물, 한도 등)는 코드에 박지 않고 s.settings에서 읽습니다.
     (설정 화면에서 바꾸면 바로 반영되는 이유)
   ===================================================================== */
(function () {
  var LR = window.LR = window.LR || {};
  var C = LR.CONFIG;
  var R = LR.rules = {};

  /* ---------- 작은 도우미들 ---------- */

  // 값이 정수면 숫자로, 비어 있거나 숫자가 아니면 null
  R.toInt = function (v) {
    if (v === '' || v === null || v === undefined) return null;
    var n = Number(v);
    return (isFinite(n) && Math.floor(n) === n) ? n : null;
  };
  // 설정값 읽기 (비어 있으면 null)
  R.setting = function (s, key) { return R.toInt(s.settings[key]); };

  R.findById = function (list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };
  R.getP = function (s, id) { return R.findById(s.participants, id); };
  R.now = function () { return new Date().toISOString(); };

  // 'YYYY-MM-DD' 날짜에 일수를 더하거나 빼기 (예: -21일). 형식이 틀리면 null
  R.addDays = function (dateStr, delta) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return null;
    var p = dateStr.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + delta));
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  };

  /* ---------- 가입 (F-01~F-04) ---------- */

  // 연락처가 전화번호 또는 메일 모양인지 확인
  R.validContact = function (text) {
    var t = (text || '').trim();
    if (!t) return true; // 연락처는 선택이라 비어 있어도 됨
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return true;                       // 메일
    var digits = t.replace(/[^0-9]/g, '');
    return /^[0-9+\-\s()]+$/.test(t) && digits.length >= 8 && digits.length <= 15; // 전화
  };

  // 가입 처리: 검사에 통과하면 참가자·재능 메뉴·가입 선물(장부)을 만든다
  // d = {name, pref1, pref2, contact, consentMsg, menus:[글자...]}
  R.signup = function (s, d) {
    var errors = [];
    var name = (d.name || '').trim();
    var pref1 = (d.pref1 || '').trim();
    var pref2 = (d.pref2 || '').trim();
    var contact = (d.contact || '').trim();
    var titles = (d.menus || []).map(function (t) { return (t || '').trim(); }).filter(function (t) { return t; });

    if (!name) errors.push('이름(별명)을 적어 주세요.');
    if (!pref1) errors.push('1순위 분야를 골라 주세요.');
    if (!pref2) errors.push('2순위 분야를 골라 주세요.');
    if (pref1 && pref2 && pref1.toLowerCase() === pref2.toLowerCase()) errors.push('1순위와 2순위는 서로 다른 분야여야 해요.');
    if (contact && !R.validContact(contact)) errors.push('연락처는 전화번호나 메일 주소 모양으로 적어 주세요. (가짜 연락처로 괜찮아요)');
    if (d.consentMsg && !contact) errors.push('문자·메일 알림에 동의하려면 연락처를 적어야 해요.');
    if (titles.length < 1) errors.push('내가 줄 수 있는 재능(30분 단위)을 1개 이상 적어 주세요.');
    if (errors.length) return { ok: false, errors: errors };

    var stages = {};
    C.stages.forEach(function (st) { stages[st] = false; });
    var cur = s.settings.currentStage || C.stages[0];
    stages[cur] = true;

    var p = {
      id: LR.store.newId(s, 'p'), name: name, pref1: pref1, pref2: pref2,
      assignedField: null, assignStatus: '미배정',
      contact: contact, consentMsg: !!d.consentMsg,
      firstStage: cur, stages: stages, notified: false, createdAt: R.now()
    };
    s.participants.push(p);
    titles.forEach(function (t) {
      s.menus.push({ id: LR.store.newId(s, 'm'), ownerId: p.id, title: t, units: 1 });
    });
    var gift = R.setting(s, 'signupGift');
    if (gift && gift > 0) R.addLedger(s, p.id, gift, '가입선물', null, '가입 선물');
    return { ok: true, participant: p };
  };

  /* ---------- 조각 장부 (F-03, F-22~F-24) ---------- */

  // 장부에 한 줄 추가 (amount는 +/- 정수)
  R.addLedger = function (s, pid, amount, type, refId, memo) {
    var row = { id: LR.store.newId(s, 'l'), participantId: pid, amount: amount, type: type, refId: refId || null, memo: memo || '', at: R.now() };
    s.ledger.push(row);
    return row;
  };

  // 잔액 = 장부 합계 (잔액 칸을 따로 두지 않음)
  R.balance = function (s, pid) {
    var sum = 0;
    s.ledger.forEach(function (l) { if (l.participantId === pid) sum += l.amount; });
    return sum;
  };

  // 수동 조정: 이유(메모) 없이는 저장 불가
  R.manualAdjust = function (s, pid, amount, memo) {
    var n = R.toInt(amount);
    if (!R.getP(s, pid)) return { ok: false, reason: '조정할 참가자를 골라 주세요.' };
    if (n === null || n === 0) return { ok: false, reason: '조정할 조각 수를 0이 아닌 정수로 적어 주세요. (줄이려면 -2처럼 마이너스)' };
    if (!(memo || '').trim()) return { ok: false, reason: '조정 이유(메모)를 꼭 적어 주세요.' };
    R.addLedger(s, pid, n, '수동조정', null, memo.trim());
    return { ok: true };
  };

  /* ---------- 같은 분야 교환 금지 (F-21) ---------- */

  // 두 사람이 교환할 수 있는 사이인지 (분야 비교는 assignedField 기준)
  R.pairAllowed = function (s, aId, bId) {
    var a = R.getP(s, aId), b = R.getP(s, bId);
    if (!a || !b) return { ok: false, reason: '참가자 정보를 찾을 수 없어요.' };
    if (a.id === b.id) return { ok: false, reason: '자기 자신과는 교환할 수 없어요.' };
    if (!a.assignedField) return { ok: false, reason: a.name + ' 님은 아직 분야가 배정되지 않아(대기 또는 미배정) 교환할 수 없어요.' };
    if (!b.assignedField) return { ok: false, reason: b.name + ' 님은 아직 분야가 배정되지 않아(대기 또는 미배정) 교환할 수 없어요.' };
    if (a.assignedField === b.assignedField) return { ok: false, reason: '같은 분야(' + a.assignedField + ') 사람끼리는 교환할 수 없어요. 다른 분야 카드에 응답해 주세요.' };
    return { ok: true };
  };

  // 이 사람이 이 카드에 응답할 수 있는지
  R.canRespond = function (s, responderId, card) {
    var me = R.getP(s, responderId);
    if (!me) return { ok: false, reason: '먼저 가입하거나 위쪽 "지금 보는 사람"에서 참가자를 골라 주세요.' };
    if (card.ownerId === responderId) return { ok: false, reason: '내가 올린 카드에는 응답할 수 없어요.' };
    if (card.status !== '열림') return { ok: false, reason: '이미 매칭됐거나 닫힌 카드예요.' };
    return R.pairAllowed(s, responderId, card.ownerId);
  };

  /* ---------- 교환 (F-20~F-27) ---------- */

  // 이 사람이 이미 "확정 이상"으로 진행한 교환이 있는지 (exceptId는 계산에서 뺄 교환)
  R.hasPriorExchange = function (s, pid, exceptId) {
    var okStatuses = ['확정', '완료', '정산', '노쇼'];
    return s.exchanges.some(function (e) {
      return e.id !== exceptId && (e.giverId === pid || e.receiverId === pid) && okStatuses.indexOf(e.status) >= 0;
    });
  };

  // 조각 수 검사: 1 이상의 정수, 그리고 첫 교환은 30분(1조각) 한 번만
  R.checkUnits = function (s, giverId, receiverId, units, exceptId) {
    var u = R.toInt(units);
    if (u === null || u < 1) return { ok: false, reason: '조각 수는 1 이상의 정수로 골라 주세요.' };
    if (u > 1) {
      var who = null;
      if (!R.hasPriorExchange(s, giverId, exceptId)) who = R.getP(s, giverId);
      else if (!R.hasPriorExchange(s, receiverId, exceptId)) who = R.getP(s, receiverId);
      if (who) return { ok: false, reason: '첫 교환은 30분(1조각) 한 번만 할 수 있어요. (' + who.name + ' 님의 첫 교환)' };
    }
    return { ok: true };
  };

  // 마이너스 한도 검사: 받는 사람 잔액 - 조각 수 >= -한도
  R.checkLimit = function (s, receiverId, units) {
    var limit = R.setting(s, 'minusLimit');
    if (limit === null) return { ok: false, reason: '마이너스 한도가 설정에 비어 있어요. 운영자 화면 A8에서 숫자를 넣어 주세요.' };
    var bal = R.balance(s, receiverId);
    if (bal - units < -limit) {
      var p = R.getP(s, receiverId);
      return { ok: false, reason: '마이너스 한도 초과: ' + (p ? p.name + ' 님의 ' : '') + '잔액 ' + bal + '조각에서 ' + units + '조각을 받으면 ' + (bal - units) + '조각이 되어 한도(-' + limit + ')를 넘어요.' };
    }
    return { ok: true };
  };

  // 카드에 응답하기 (교환이 "응답" 상태로 만들어짐)
  R.respond = function (s, responderId, cardId, units, menuTitle) {
    var card = R.findById(s.helpCards, cardId);
    if (!card) return { ok: false, reason: '카드를 찾을 수 없어요.' };
    var c = R.canRespond(s, responderId, card);
    if (!c.ok) return c;
    var dup = s.exchanges.some(function (e) { return e.cardId === cardId && e.giverId === responderId && e.status === '응답'; });
    if (dup) return { ok: false, reason: '이미 이 카드에 응답했어요. 운영자 확정을 기다려 주세요.' };
    var u = R.checkUnits(s, responderId, card.ownerId, units, null);
    if (!u.ok) return u;
    var ex = {
      id: LR.store.newId(s, 'x'), cardId: cardId, giverId: responderId, receiverId: card.ownerId,
      units: R.toInt(units), menuTitle: menuTitle || '', status: '응답',
      thanksGiver: '', thanksReceiver: '', confirmedAt: null, completedAt: null, settledAt: null,
      disputeMemo: '', newFieldBonus: false, createdAt: R.now()
    };
    s.exchanges.push(ex);
    return { ok: true, exchange: ex };
  };

  // 확정할 수 있는지만 확인 (확정 시 같은 분야 검사를 한 번 더 함)
  R.canConfirm = function (s, exId) {
    var ex = R.findById(s.exchanges, exId);
    if (!ex) return { ok: false, reason: '교환을 찾을 수 없어요.' };
    if (ex.status !== '응답') return { ok: false, reason: '"응답" 상태일 때만 확정할 수 있어요.' };
    var pa = R.pairAllowed(s, ex.giverId, ex.receiverId);
    if (!pa.ok) return pa;
    var u = R.checkUnits(s, ex.giverId, ex.receiverId, ex.units, ex.id);
    if (!u.ok) return u;
    return R.checkLimit(s, ex.receiverId, ex.units);
  };

  // 확정하기
  R.confirmExchange = function (s, exId) {
    var c = R.canConfirm(s, exId);
    if (!c.ok) return c;
    var ex = R.findById(s.exchanges, exId);
    ex.status = '확정';
    ex.confirmedAt = R.now();
    var card = R.findById(s.helpCards, ex.cardId);
    if (card) card.status = '매칭됨';
    // 같은 카드의 다른 응답은 자동 취소
    s.exchanges.forEach(function (o) { if (o.id !== ex.id && o.cardId === ex.cardId && o.status === '응답') o.status = '취소'; });
    return { ok: true };
  };

  // 교환이 끝났음을 기록 (확정 -> 완료)
  R.completeExchange = function (s, exId) {
    var ex = R.findById(s.exchanges, exId);
    if (!ex) return { ok: false, reason: '교환을 찾을 수 없어요.' };
    if (ex.status !== '확정') return { ok: false, reason: '"확정" 상태일 때만 완료로 바꿀 수 있어요.' };
    ex.status = '완료';
    ex.completedAt = R.now(); // 교환을 마친 시각 (다시 요청한 사람 수 계산에 씀)
    return { ok: true };
  };

  // 고마움 카드(구체적인 한 줄) 쓰기. 주는 사람/받는 사람이 각각 한 줄
  R.writeThanks = function (s, exId, byId, text) {
    var ex = R.findById(s.exchanges, exId);
    var t = (text || '').trim();
    if (!ex) return { ok: false, reason: '교환을 찾을 수 없어요.' };
    if (ex.status !== '완료') return { ok: false, reason: '교환이 "완료"된 뒤에 고마움 카드를 쓸 수 있어요.' };
    if (!t) return { ok: false, reason: '고마움 카드에 한 줄을 적어 주세요.' };
    if (byId === ex.giverId) ex.thanksGiver = t;
    else if (byId === ex.receiverId) ex.thanksReceiver = t;
    else return { ok: false, reason: '이 교환의 당사자만 쓸 수 있어요.' };
    return { ok: true };
  };

  // 정산할 수 있는지: 완료 + 고마움 카드 양쪽 + 마이너스 한도 재검사
  R.canSettle = function (s, exId) {
    var ex = R.findById(s.exchanges, exId);
    if (!ex) return { ok: false, reason: '교환을 찾을 수 없어요.' };
    if (ex.status !== '완료') return { ok: false, reason: '"완료" 상태일 때만 정산할 수 있어요.' };
    if (!ex.thanksGiver || !ex.thanksReceiver) return { ok: false, reason: '두 사람이 모두 고마움 카드를 써야 정산할 수 있어요.' };
    return R.checkLimit(s, ex.receiverId, ex.units);
  };

  // 이 사람이 상대의 분야와 "정산까지 끝난 교환"이 전에 한 번도 없는지 (새 분야 첫 교환인지)
  R.isNewFieldFor = function (s, pid, partnerId, exceptId) {
    var partner = R.getP(s, partnerId);
    if (!partner || !partner.assignedField) return false;
    var had = s.exchanges.some(function (e) {
      if (e.id === exceptId || e.status !== '정산') return false;
      var otherId = e.giverId === pid ? e.receiverId : (e.receiverId === pid ? e.giverId : null);
      if (!otherId) return false;
      var o = R.getP(s, otherId);
      return o && o.assignedField === partner.assignedField;
    });
    return !had;
  };

  // 정산하기: 주는 사람 +조각, 받는 사람 -조각, 그리고 새 분야 보너스
  R.settle = function (s, exId) {
    var c = R.canSettle(s, exId);
    if (!c.ok) return c;
    var ex = R.findById(s.exchanges, exId);
    var bonus = R.setting(s, 'newFieldBonus');
    var who = s.settings.bonusRecipient || '둘다';
    // 보너스는 정산 기록을 바꾸기 전에 각자 판단
    var giverBonus = bonus > 0 && (who === '둘다' || who === '주는사람') && R.isNewFieldFor(s, ex.giverId, ex.receiverId, ex.id);
    var receiverBonus = bonus > 0 && (who === '둘다' || who === '받는사람') && R.isNewFieldFor(s, ex.receiverId, ex.giverId, ex.id);

    R.addLedger(s, ex.giverId, ex.units, '교환적립', ex.id, '재능을 줌 (' + ex.units + '조각)');
    R.addLedger(s, ex.receiverId, -ex.units, '교환차감', ex.id, '재능을 받음 (' + ex.units + '조각)');
    var bonuses = [];
    if (giverBonus) { R.addLedger(s, ex.giverId, bonus, '새분야보너스', ex.id, '새 분야 첫 교환 보너스'); bonuses.push(ex.giverId); }
    if (receiverBonus) { R.addLedger(s, ex.receiverId, bonus, '새분야보너스', ex.id, '새 분야 첫 교환 보너스'); bonuses.push(ex.receiverId); }
    ex.newFieldBonus = bonuses.length > 0;
    ex.status = '정산';
    ex.settledAt = R.now();
    return { ok: true, bonusTo: bonuses };
  };

  // 노쇼 처리: 어긴 사람을 골라 조각 차감 (차감 조각 수가 비어 있으면 처리 불가)
  R.canNoShow = function (s) {
    var pen = R.setting(s, 'noShowPenalty');
    if (pen === null || pen < 1) return { ok: false, reason: '노쇼로 차감할 조각 수가 아직 정해지지 않았어요. 운영자 화면 A8 설정에 숫자를 넣으면 켜져요.' };
    return { ok: true };
  };
  R.markNoShow = function (s, exId, culpritId) {
    var c = R.canNoShow(s);
    if (!c.ok) return c;
    var ex = R.findById(s.exchanges, exId);
    if (!ex) return { ok: false, reason: '교환을 찾을 수 없어요.' };
    if (ex.status !== '확정') return { ok: false, reason: '"확정" 상태의 교환만 노쇼로 처리할 수 있어요.' };
    if (culpritId !== ex.giverId && culpritId !== ex.receiverId) return { ok: false, reason: '약속을 어긴 사람을 골라 주세요.' };
    var pen = R.setting(s, 'noShowPenalty');
    R.addLedger(s, culpritId, -pen, '노쇼차감', ex.id, '약속 불이행(노쇼) 차감');
    ex.status = '노쇼';
    ex.noShowBy = culpritId;
    var limit = R.setting(s, 'minusLimit');
    var bal = R.balance(s, culpritId);
    var warning = (limit !== null && bal < -limit) ? '경고: 잔액이 ' + bal + '조각으로 한도(-' + limit + ') 아래예요. 운영자가 수동 조정으로 정리해 주세요.' : '';
    return { ok: true, warning: warning };
  };

  // 응답/확정 상태의 교환 취소
  R.cancelExchange = function (s, exId) {
    var ex = R.findById(s.exchanges, exId);
    if (!ex) return { ok: false, reason: '교환을 찾을 수 없어요.' };
    if (ex.status !== '응답' && ex.status !== '확정') return { ok: false, reason: '"응답" 또는 "확정" 상태만 취소할 수 있어요.' };
    var wasConfirmed = ex.status === '확정';
    ex.status = '취소';
    var card = R.findById(s.helpCards, ex.cardId);
    if (wasConfirmed && card && card.status === '매칭됨') card.status = '열림';
    return { ok: true };
  };

  /* ---------- 연락처 공개 (F-30) ---------- */

  // viewerId가 이 교환의 상대 연락처를 볼 수 있는지. 'admin'(운영자 화면)은 예외로 항상 볼 수 있음
  R.contactFor = function (s, viewerId, ex) {
    var empty = '(연락처를 적지 않았어요)';
    function textOf(p) { return p && p.contact ? p.contact : empty; }
    if (viewerId === 'admin') {
      return { visible: true, text: '주는 사람 ' + textOf(R.getP(s, ex.giverId)) + ' / 받는 사람 ' + textOf(R.getP(s, ex.receiverId)) };
    }
    if (viewerId !== ex.giverId && viewerId !== ex.receiverId) return { visible: false, text: '' };
    if (C.contactVisibleStatuses.indexOf(ex.status) < 0) return { visible: false, text: '' };
    var partner = R.getP(s, viewerId === ex.giverId ? ex.receiverId : ex.giverId);
    return { visible: true, text: textOf(partner) };
  };

  /* ---------- 분야 배정 (F-01, 규칙: PRD 4.2) ---------- */

  // participants: [{id, pref1, pref2}], n: 운영할 분야 수, tieChoice: 동점일 때 운영자가 고른 분야들
  // 돌려주는 값: {fieldCounts, operating, needsChoice, tie, results}
  R.assignFields = function (participants, n, tieChoice) {
    var counts = {}, order = [];
    participants.forEach(function (p) {
      var f = (p.pref1 || '').trim();
      if (!f) return;
      if (counts[f] === undefined) { counts[f] = 0; order.push(f); }
      counts[f]++;
    });
    var list = order.map(function (f) { return { field: f, count: counts[f] }; });
    // 1순위 인원 많은 순 (인원이 같으면 이름순으로 보여 주기만 함)
    list.sort(function (a, b) { return b.count - a.count || (a.field < b.field ? -1 : 1); });

    var out = { fieldCounts: list, operating: [], needsChoice: false, tie: null, results: {} };
    var limit = R.toInt(n);
    if (limit === null || limit < 1) limit = 1;

    var operating;
    if (list.length <= limit) {
      operating = list.map(function (x) { return x.field; });
    } else {
      var boundary = list[limit - 1].count;
      if (list[limit].count === boundary) {
        // n번째와 그 다음 분야의 인원이 같음 -> 자동으로 정하지 않는다
        var fixed = list.filter(function (x) { return x.count > boundary; }).map(function (x) { return x.field; });
        var tied = list.filter(function (x) { return x.count === boundary; }).map(function (x) { return x.field; });
        var pick = limit - fixed.length;
        out.tie = { fixed: fixed, tied: tied, pick: pick, count: boundary };
        var valid = tieChoice && tieChoice.length === pick && tieChoice.every(function (f) { return tied.indexOf(f) >= 0; }) &&
                    tieChoice.filter(function (f, i) { return tieChoice.indexOf(f) === i; }).length === pick;
        if (!valid) { out.needsChoice = true; return out; }
        operating = fixed.concat(tieChoice);
      } else {
        operating = list.slice(0, limit).map(function (x) { return x.field; });
      }
    }
    out.operating = operating;
    // 사람별 결과: 1순위가 운영되면 1순위배정 / 아니고 2순위가 운영되면 2순위배정 / 둘 다 빠지면 대기
    participants.forEach(function (p) {
      var f1 = (p.pref1 || '').trim(), f2 = (p.pref2 || '').trim();
      if (operating.indexOf(f1) >= 0) out.results[p.id] = { assignedField: f1, assignStatus: '1순위배정' };
      else if (operating.indexOf(f2) >= 0) out.results[p.id] = { assignedField: f2, assignStatus: '2순위배정' };
      else out.results[p.id] = { assignedField: null, assignStatus: '대기' };
    });
    return out;
  };

  // 배정 결과를 실제 데이터에 저장 (운영자가 "확정"을 눌렀을 때)
  R.applyAssignment = function (s, res) {
    s.participants.forEach(function (p) {
      var r = res.results[p.id];
      if (r) { p.assignedField = r.assignedField; p.assignStatus = r.assignStatus; }
    });
    s.operatingFields = res.operating.slice();
    s.assignedAt = R.now();
  };

  /* ---------- 알림 대상 (F-14) ---------- */

  // 1·2순위가 모두 빠져 "대기"이고 문자·메일 수신에 동의한 사람 + 발송 예정일
  R.notifyTargets = function (s) {
    var waiting = s.participants.filter(function (p) { return p.assignStatus === '대기'; });
    var list = waiting.filter(function (p) { return p.consentMsg === true; });
    var days = R.setting(s, 'noticeDaysBefore');
    var sendDate = null;
    if (days !== null && s.settings.nextStageStartDate) sendDate = R.addDays(s.settings.nextStageStartDate, -days);
    return { list: list, sendDate: sendDate, waitingTotal: waiting.length, waitingNoConsent: waiting.length - list.length };
  };

  /* ---------- 스탬프와 혜택 (F-11, F-12) ---------- */

  // 라운드에서 연결된 두 사람 기록 -> 서로 다른 분야일 때만 둘 각자에게 스탬프 1개
  R.addStampPair = function (s, aId, bId, roundId) {
    var a = R.getP(s, aId), b = R.getP(s, bId);
    if (!a || !b) return { ok: false, reason: '연결된 두 사람을 모두 골라 주세요.' };
    if (a.id === b.id) return { ok: false, reason: '서로 다른 두 사람을 골라 주세요.' };
    if (!a.assignedField || !b.assignedField) return { ok: false, reason: '분야가 배정된 사람끼리만 스탬프를 만들 수 있어요.' };
    if (a.assignedField === b.assignedField) return { ok: false, reason: '같은 분야(' + a.assignedField + ')끼리는 스탬프가 생기지 않아요. 새 분야 사람과 연결돼야 해요.' };
    var dup = s.stamps.some(function (t) {
      return (t.participantId === a.id && t.partnerId === b.id) || (t.participantId === b.id && t.partnerId === a.id);
    });
    if (dup) return { ok: false, reason: '이 두 사람은 이미 스탬프를 받았어요. 같은 두 사람 사이에는 한 번만 생겨요.' };
    var at = R.now();
    s.stamps.push({ id: LR.store.newId(s, 't'), participantId: a.id, partnerId: b.id, partnerField: b.assignedField, roundId: roundId || null, at: at });
    s.stamps.push({ id: LR.store.newId(s, 't'), participantId: b.id, partnerId: a.id, partnerField: a.assignedField, roundId: roundId || null, at: at });
    return { ok: true };
  };

  R.stampsTotal = function (s, pid) { return s.stamps.filter(function (t) { return t.participantId === pid; }).length; };
  R.stampsUsed = function (s, pid) {
    var n = 0;
    s.redemptions.forEach(function (r) { if (r.participantId === pid) n += r.stampsUsed; });
    return n;
  };
  R.stampsAvailable = function (s, pid) { return R.stampsTotal(s, pid) - R.stampsUsed(s, pid); };

  // 혜택으로 바꿀 수 있는지: 필요 스탬프 수가 비어 있으면 불가
  R.canRedeem = function (s, pid) {
    var need = R.setting(s, 'stampsPerBenefit');
    if (need === null || need < 1) return { ok: false, reason: '혜택 1번에 필요한 스탬프 수가 아직 정해지지 않았어요. 운영자 화면 A8 설정에 숫자를 넣으면 켜져요.' };
    var have = R.stampsAvailable(s, pid);
    if (have < need) return { ok: false, reason: '쓸 수 있는 스탬프가 ' + have + '개예요. ' + need + '개가 필요해요.' };
    return { ok: true };
  };
  R.redeem = function (s, pid, benefit) {
    if (C.benefits.indexOf(benefit) < 0) return { ok: false, reason: '혜택 종류를 알 수 없어요.' };
    var c = R.canRedeem(s, pid);
    if (!c.ok) return c;
    s.redemptions.push({ id: LR.store.newId(s, 'r'), participantId: pid, benefit: benefit, stampsUsed: R.setting(s, 'stampsPerBenefit'), at: R.now() });
    return { ok: true };
  };

  /* ---------- 대회 팀 짜기 (F-42) ---------- */

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 분야가 배정된 사람들을 섞어서 팀을 만든다. 팀 안 분야가 최대한 다르도록 한 명씩 채움
  // 돌려주는 값: [{memberIds:[...]}]  (rng는 시험용으로 바꿀 수 있는 난수 함수)
  R.makeTeams = function (participants, teamSize, rng) {
    rng = rng || Math.random;
    var size = R.toInt(teamSize);
    if (size === null || size < 2) size = 4;
    var groups = {}, fieldOrder = [];
    participants.forEach(function (p) {
      if (!p.assignedField) return;
      if (!groups[p.assignedField]) { groups[p.assignedField] = []; fieldOrder.push(p.assignedField); }
      groups[p.assignedField].push(p.id);
    });
    fieldOrder = shuffle(fieldOrder, rng);
    fieldOrder.forEach(function (f) { groups[f] = shuffle(groups[f], rng); });
    var remaining = fieldOrder.reduce(function (n, f) { return n + groups[f].length; }, 0);
    var teams = [];
    while (remaining > 0) {
      var members = [], used = [];
      while (members.length < size && remaining > 0) {
        // 아직 이 팀에 없는 분야 중 남은 사람이 가장 많은 분야부터 뽑기 (없으면 아무 분야나)
        var best = null, pool = fieldOrder.filter(function (f) { return groups[f].length > 0; });
        var fresh = pool.filter(function (f) { return used.indexOf(f) < 0; });
        var cands = fresh.length ? fresh : pool;
        cands.forEach(function (f) { if (best === null || groups[f].length > groups[best].length) best = f; });
        members.push(groups[best].shift());
        remaining--;
        if (used.indexOf(best) < 0) used.push(best);
      }
      teams.push({ memberIds: members });
    }
    return teams;
  };

  // 만든 팀을 데이터에 저장
  R.buildTeams = function (s, rng) {
    var size = R.setting(s, 'teamSize');
    if (size === null || size < 2) return { ok: false, reason: '팀 인원(teamSize)을 2 이상으로 설정해 주세요.' };
    var teams = R.makeTeams(s.participants, size, rng);
    if (!teams.length) return { ok: false, reason: '분야가 배정된 참가자가 없어요. 먼저 A2에서 분야 배정을 확정해 주세요.' };
    s.teams = teams.map(function (t) { return { id: LR.store.newId(s, 'g'), memberIds: t.memberIds }; });
    return { ok: true, count: s.teams.length };
  };

  // 팀 안에 서로 다른 분야가 몇 개인지
  R.teamDistinctFields = function (s, team) {
    var seen = [];
    team.memberIds.forEach(function (id) {
      var p = R.getP(s, id);
      if (p && p.assignedField && seen.indexOf(p.assignedField) < 0) seen.push(p.assignedField);
    });
    return seen.length;
  };

  /* ---------- 지표 (F-60, F-62) ---------- */

  R.metrics = function (s) {
    var stages = C.stages;
    var cur = s.settings.currentStage || stages[0];
    var idx = stages.indexOf(cur);
    var m = { currentStage: cur };
    m.signups = s.participants.length;

    // 이번 단계에 온 사람: 앞 단계에도 온 적 있으면 "이어서 온 사람", 아니면 "새로 온 사람"
    var inCur = s.participants.filter(function (p) { return p.stages && p.stages[cur]; });
    var cont = inCur.filter(function (p) { return stages.slice(0, idx).some(function (st) { return p.stages[st]; }); });
    m.attendedNow = inCur.length;
    m.continued = cont.length;
    m.newcomers = inCur.length - cont.length;

    // 재방문율 = 앞 단계 참가자 중 이번 단계에도 온 사람 / 앞 단계 참가자 전체
    if (idx > 0) {
      var prev = stages[idx - 1];
      var prevAll = s.participants.filter(function (p) { return p.stages && p.stages[prev]; });
      var back = prevAll.filter(function (p) { return p.stages[cur]; });
      m.revisit = { prevStage: prev, num: back.length, den: prevAll.length, rate: prevAll.length ? back.length / prevAll.length : null };
    } else {
      m.revisit = null; // 첫 단계라 앞 단계가 없음
    }

    // 정산된 교환, 새 분야 첫 교환 비율
    var settled = s.exchanges.filter(function (e) { return e.status === '정산'; });
    var withBonus = settled.filter(function (e) { return e.newFieldBonus; });
    m.settledCount = settled.length;
    m.exchangeCount = s.exchanges.filter(function (e) { return ['확정', '완료', '정산', '노쇼'].indexOf(e.status) >= 0; }).length;
    m.newField = { num: withBonus.length, den: settled.length, rate: settled.length ? withBonus.length / settled.length : null };

    // 연결은 두 기준으로 항상 함께 계산한다.
    // (1) 재능 교환 연결 수: 운영자가 확정한 교환(확정/완료/정산) 1건이 1연결. 같은 두 사람이 2번 교환하면 2건.
    //     응답만 한 교환, 취소, 노쇼는 세지 않음
    m.exchangeLinks = s.exchanges.filter(function (e) { return ['확정', '완료', '정산'].indexOf(e.status) >= 0; }).length;
    // (2) 라운드 스탬프 연결 수: 운영자가 A5에 기록한, 서로 다른 분야 두 사람의 만남 (스탬프는 한 연결에 2개 생김)
    m.stampLinks = Math.floor(s.stamps.length / 2);
    // 지표 3번 "연결 성사 건수"로 어느 쪽을 보여 줄지는 설정(connectionBasis)으로 고른다. 비어 있으면 재능 교환
    m.connectionBasis = (s.settings && s.settings.connectionBasis) === '라운드 스탬프' ? '라운드 스탬프' : '재능 교환';
    m.connections = m.connectionBasis === '라운드 스탬프' ? m.stampLinks : m.exchangeLinks;

    // 다시 요청한 사람 수 = 재능 교환을 한 번 이상 마친 뒤, 도와주세요 카드를 다시 올린 사람
    // (교환을 마친 사람은 주는 사람과 받는 사람 모두. 마친 시각 = 완료 시각, 옛 데이터는 정산/확정 시각)
    var firstDone = {};
    s.exchanges.forEach(function (e) {
      if (e.status !== '완료' && e.status !== '정산') return;
      var t = e.completedAt || e.settledAt || e.confirmedAt || '';
      if (!t) return;
      [e.giverId, e.receiverId].forEach(function (pid) {
        if (!firstDone[pid] || t < firstDone[pid]) firstDone[pid] = t;
      });
    });
    m.repeatRequesters = Object.keys(firstDone).filter(function (pid) {
      return s.helpCards.some(function (c) { return c.ownerId === pid && c.createdAt && c.createdAt > firstDone[pid]; });
    }).length;

    // 운영자가 직접 입력하는 값 (비어 있으면 null)
    m.lightning = R.toInt(s.manualMetrics.lightningCount);
    m.invite = R.toInt(s.manualMetrics.inviteCount);
    return m;
  };
})();
