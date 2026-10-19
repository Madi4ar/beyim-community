(function () {
  var BC = (window.BC = window.BC || {});

  var view = { screen: 'feed', tab: 'foryou', postId: null, modFilter: 'all' };

  /* ---------------- Modal shell ---------------- */
  BC.openModal = function (html, afterRender) {
    var modalRoot = document.getElementById('modal-root');
    modalRoot.classList.remove('closing');
    modalRoot.innerHTML = '<div class="modal-box"></div>';
    modalRoot.hidden = false;
    var box = modalRoot.querySelector('.modal-box');
    if (html) box.innerHTML = html;
    if (typeof afterRender === 'function') afterRender(box);
    box.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', BC.closeModal); });
    modalRoot.onclick = function (e) { if (e.target === modalRoot) BC.closeModal(); };
  };

  BC.closeModal = function () {
    var modalRoot = document.getElementById('modal-root');
    if (modalRoot.hidden || modalRoot.classList.contains('closing')) return;
    modalRoot.classList.add('closing');
    setTimeout(function () {
      modalRoot.hidden = true;
      modalRoot.classList.remove('closing');
      modalRoot.innerHTML = '';
    }, 140);
  };

  /* ---------------- Navigation helpers (used by composer.js etc.) ---------------- */
  BC.go = function (tabId) {
    view.screen = 'feed';
    view.tab = tabId;
    render();
    scrollToTop();
  };

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeAllMenus() {
    document.querySelectorAll('.menu-dropdown').forEach(function (m) { m.hidden = true; });
  }

  function toggleMenu(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var willOpen = el.hidden;
    closeAllMenus();
    el.hidden = !willOpen;
  }

  /* ---------------- Rendering ---------------- */
  function renderTabsNav() {
    var tabsEl = document.getElementById('tabs');
    var list = BC.TABS.slice();
    if (BC.isModerator()) list = [{ id: 'moderator', label: 'Модерация' }].concat(list);
    tabsEl.innerHTML = list.map(function (t) {
      var active = (view.screen === 'moderator' && t.id === 'moderator') || (view.screen !== 'moderator' && view.tab === t.id && t.id !== 'moderator');
      return '<button class="tab' + (active ? ' active' : '') + '" data-action="go-tab" data-tab-id="' + t.id + '">' + BC.escapeHtml(t.label) + '</button>';
    }).join('');
  }

  function renderRoleSwitch() {
    var btn = document.getElementById('role-switch');
    var isMod = BC.isModerator();
    var shortLabel = isMod ? 'Модератор' : 'Педагог';
    btn.textContent = 'Режим: ' + shortLabel;
    btn.setAttribute('data-short', shortLabel);
    btn.classList.toggle('is-mod', isMod);
  }

  function renderNavIcons() {
    document.querySelectorAll('.nav-icon-btn').forEach(function (btn) {
      var active = view.screen === 'feed' && view.tab === btn.dataset.tabId;
      btn.classList.toggle('active', active);
    });
  }

  function render() {
    renderRoleSwitch();
    renderTabsNav();
    renderNavIcons();

    var root = document.getElementById('view-root');
    if (view.screen === 'moderator' && BC.isModerator()) {
      BC.renderModeratorPanel(root, view.modFilter);
    } else if (view.screen === 'detail' && view.postId) {
      BC.renderPostDetail(root, view.postId);
    } else {
      if (view.screen === 'moderator') { view.screen = 'feed'; }
      BC.renderFeed(root, view.tab);
    }
    BC.refreshNotifications();
  }

  function toggleRole() {
    BC.setRole(BC.isModerator() ? 'user' : 'moderator');
    if (!BC.isModerator() && view.screen === 'moderator') view.screen = 'feed';
    BC.toast(BC.isModerator() ? 'Режим модератора включён (для демонстрации панели).' : 'Режим педагога.');
  }

  /* ---------------- Delegated actions ---------------- */
  var ACTIONS = {
    'open-composer': function () { BC.openComposer(); },
    'toggle-notif': function (el, e) { e.stopPropagation(); BC.toggleNotifPanel(); },
    'toggle-role': function () { toggleRole(); },
    'go-tab': function (el) {
      if (el.dataset.tabId === 'moderator') { view.screen = 'moderator'; }
      else { view.screen = 'feed'; view.tab = el.dataset.tabId; }
      render();
      scrollToTop();
    },
    'go-feed': function () { view.screen = 'feed'; view.postId = null; render(); scrollToTop(); },
    'open-post': function (el) { view.screen = 'detail'; view.postId = el.dataset.postId; render(); scrollToTop(); },
    'open-article': function (el) { BC.openArticleModal(el.dataset.postId); },
    'share-post': function (el) { BC.sharePost(el.dataset.postId); },
    'open-reply-form': function (el) { BC.openReplyForm(el.dataset.postId); },
    'toggle-reaction': function (el) {
      BC.toggleReaction(el.dataset.targetType, el.dataset.targetId, el.dataset.reaction);
      BC.patchReactionButton(el, el.dataset.targetType, el.dataset.targetId, el.dataset.reaction);
    },
    'toggle-bookmark': function (el) {
      BC.toggleBookmark(el.dataset.postId);
      BC.patchBookmarkButton(el, el.dataset.postId);
    },
    'toggle-menu': function (el, e) { e.stopPropagation(); toggleMenu(el.dataset.menuId); },
    'open-report': function (el) { closeAllMenus(); BC.openReportModal(el.dataset.targetType, el.dataset.targetId); },
    'hide-item': function (el) { closeAllMenus(); BC.archiveItem(el.dataset.targetType, el.dataset.targetId); BC.toast('Материал снят с публикации.'); },
    'edit-post': function (el) { BC.openEditPostModal(el.dataset.postId); },
    'ai-rephrase-post': function (el) { BC.aiRephraseAndResubmit('post', el.dataset.postId); },
    'send-mod-post': function (el) { BC.sendPostToModerator(el.dataset.postId); BC.toast('Отправлено модератору.'); },
    'edit-reply': function (el) { BC.openEditReplyModal(el.dataset.replyId); },
    'ai-rephrase-reply': function (el) { BC.aiRephraseAndResubmit('reply', el.dataset.replyId); },
    'send-mod-reply': function (el) { BC.sendReplyToModerator(el.dataset.replyId); BC.toast('Отправлено модератору.'); },
    'mod-filter': function (el) { view.modFilter = el.dataset.filter; render(); },
    'mod-approve': function (el) { BC.modApprove(el.dataset.kind, el.dataset.id); BC.toast('Одобрено.'); },
    'mod-request-edit': function (el) {
      BC.openModReasonModal('Попросить изменить', 'Требуется небольшое изменение формулировки.', function (reason) {
        BC.modRequestEdit(el.dataset.kind, el.dataset.id, reason);
        BC.toast('Автору отправлен запрос на исправление.');
      });
    },
    'mod-reject': function (el) {
      BC.openModReasonModal('Отклонить материал', 'Нарушение правил профессионального общения.', function (reason) {
        BC.modReject(el.dataset.kind, el.dataset.id, reason);
        BC.toast('Материал отклонён.');
      });
    },
    'mod-restrict': function (el) { BC.modRestrictUser(el.dataset.userId); BC.toast('Ограничение применено к пользователю.'); }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = ACTIONS[el.dataset.action];
    if (action) action(el, e);
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.post-menu-wrap')) closeAllMenus();
    var actionEl = e.target.closest('[data-action]');
    var keepNotifOpen = actionEl && actionEl.dataset.action === 'toggle-notif';
    if (!keepNotifOpen) BC.closeNotifPanel();
  });

  BC.onChange(render);

  render();

  // Refresh relative timestamps ("2 часа назад") without a full data re-render.
  setInterval(function () {
    if (view.screen !== 'moderator') render();
  }, 60000);
})();
