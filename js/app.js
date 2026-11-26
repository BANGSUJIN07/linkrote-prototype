/* =====================================================================
   app.js : 프로그램의 시작점
   - 주소 뒤의 #/p2 같은 부분(해시)을 보고 어느 화면을 보여 줄지 정해요.
   - "지금 보는 사람" 선택 상자, 위쪽 메뉴, 버튼 클릭 연결을 담당해요.
   - 화면을 새로 그리는 함수는 LR.app.render() 입니다.
   ===================================================================== */
(function () {
  var LR = window.LR = window.LR || {};
  var R = LR.rules, ui = LR.ui, h = ui.esc;

  // 화면 목록: 주소 이름 -> {메뉴에 보일 이름, 누가 쓰는 화면인지}
  var ROUTES = {
    home: { label: '홈', who: 'any' },
    p1: { label: 'P1 가입', who: 'p' }, p2: { label: 'P2 내 정보', who: 'p' }, p3: { label: 'P3 일정', who: 'p' },
    p4: { label: 'P4 도와주세요 카드', who: 'p' }, p5: { label: 'P5 내 교환', who: 'p' },
    a1: { label: 'A1 참가자 관리', who: 'a' }, a2: { label: 'A2 분야 배정', who: 'a' }, a3: { label: 'A3 알림 대상', who: 'a' },
    a4: { label: 'A4 교환 관리', who: 'a' }, a5: { label: 'A5 스탬프·혜택', who: 'a' }, a6: { label: 'A6 대회 팀', who: 'a' },
    a7: { label: 'A7 지표·지출', who: 'a' }, a8: { label: 'A8 설정·백업', who: 'a' }
  };

  function currentRoute() {
    var r = (location.hash || '').replace(/^#\/?/, '');
    return ROUTES[r] ? r : 'home';
  }

  // 위쪽 "지금 보는 사람" 선택 상자 채우기
  function renderViewer() {
    var S = LR.store.state;
    var opts = [{ value: 'admin', text: '운영자' }];
    S.participants.forEach(function (p) {
      opts.push({ value: p.id, text: '참가자: ' + p.name + ' (' + (p.assignedField || p.assignStatus) + ')' });
    });
    var sel = document.getElementById('viewerSelect');
    var cur = S.session.viewerId;
    if (cur !== 'admin' && !R.getP(S, cur)) { cur = 'admin'; S.session.viewerId = 'admin'; }
    sel.innerHTML = ui.options(opts, cur);
  }

  // 메뉴 그리기
  function renderMenu(route) {
    function link(k) { return '<a href="#/' + k + '"' + (k === route ? ' class="active"' : '') + '>' + h(ROUTES[k].label) + '</a>'; }
    var html = link('home') + '<span class="group-title">참가자용</span>';
    ['p1', 'p2', 'p3', 'p4', 'p5'].forEach(function (k) { html += link(k); });
    html += '<span class="group-title">운영자용</span>';
    ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'].forEach(function (k) { html += link(k); });
    document.getElementById('menu').innerHTML = html;
  }

  // 화면 전체 다시 그리기
  function render() {
    var S = LR.store.state;
    var route = currentRoute();
    renderViewer();
    renderMenu(route);
    document.getElementById('storageWarn').textContent = LR.store.storageOk ? '' : ' (경고: 이 브라우저에서는 저장이 안 되고 있어요. 새로고침하면 데이터가 사라져요. 백업 파일을 자주 내려받으세요.)';

    var body;
    if (ROUTES[route].who === 'a' && !ui.isAdmin()) {
      body = '<div class="card"><b>운영자 화면이에요.</b><br>위쪽 "지금 보는 사람"을 <b>운영자</b>로 바꾸면 볼 수 있어요.' +
        '<div class="row"><button data-action="go-admin">운영자로 바꾸기</button></div></div>';
    } else {
      try { body = LR.views[route](S); }
      catch (e) {
        body = '<div class="card"><b>화면을 그리다 문제가 생겼어요.</b><br>다른 메뉴로 갔다가 다시 와 보세요. 계속되면 A8에서 백업 후 초기화해 보세요.<div class="hint">(기술 메시지: ' + h(e.message) + ')</div></div>';
        if (window.console) console.error(e);
      }
    }
    var flash = '';
    if (ui.flash) {
      flash = '<div class="flash ' + h(ui.flash.kind) + '" style="position:sticky;top:0;z-index:5">' + h(ui.flash.msg).replace(/\n/g, '<br>') + '</div>';
      ui.flash = null;
    }
    document.getElementById('app').innerHTML = flash + body;
  }

  LR.app = { render: render };

  /* ---------- 버튼/양식/선택 변경을 한곳에서 받기 ---------- */
  LR.actions['go-admin'] = function () { LR.store.state.session.viewerId = 'admin'; LR.store.save(); render(); };

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el || el.disabled) return;
    var fn = LR.actions[el.getAttribute('data-action')];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('submit', function (e) {
    var form = e.target;
    var name = form.getAttribute && form.getAttribute('data-submit');
    if (!name) return;
    e.preventDefault();
    if (LR.actions[name]) LR.actions[name](form, e);
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'viewerSelect') {
      var S = LR.store.state;
      S.session.viewerId = el.value;
      LR.store.save();
      // 역할에 맞지 않는 화면이면 알맞은 화면으로 이동
      var who = ROUTES[currentRoute()].who;
      if (el.value === 'admin' && (currentRoute() === 'p2' || currentRoute() === 'p5')) location.hash = '#/a1';
      else if (el.value !== 'admin' && who === 'a') location.hash = '#/p2';
      render();
      return;
    }
    var name = el.getAttribute && el.getAttribute('data-change');
    if (name && LR.actions[name]) LR.actions[name](el, e);
  });
  window.addEventListener('hashchange', render);

  // 시작: 저장된 데이터를 불러오고 화면 그리기
  LR.store.init();
  render();
})();
