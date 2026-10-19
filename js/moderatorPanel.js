/* Moderator queue (sections 42-43): pending/manual_review items with filters
   and approve / request-edit / reject / restrict-user actions. */
(function () {
  var BC = (window.BC = window.BC || {});

  var FILTERS = [
    { id: 'all', label: 'Все' },
    { id: 'posts', label: 'Публикации' },
    { id: 'replies', label: 'Ответы' },
    { id: 'reports', label: 'Жалобы' },
    { id: 'high', label: 'Высокий риск' },
    { id: 'pii', label: 'Персональные данные' }
  ];

  var RISK_MAP = { green: 'low', yellow: 'medium', manual_review: 'medium', red: 'high' };

  function textOf(entry) {
    return entry.kind === 'post'
      ? entry.item.title + ' ' + entry.item.body
      : entry.item.experience_text + ' ' + (entry.item.advice_text || '');
  }

  function previewLevel(entry) {
    return entry.item.moderation_score || BC.checkText(textOf(entry)).level;
  }

  function riskOf(entry) { return RISK_MAP[previewLevel(entry)] || 'medium'; }

  function reasonOf(entry) {
    return entry.item.moderation_reason || BC.checkText(textOf(entry)).reasonText || 'AI не уверен в содержании, требуется ручная проверка.';
  }

  function hasPersonalData(entry) {
    return BC.detectPersonalData(textOf(entry)).length > 0;
  }

  function hasOpenReport(entry) {
    return BC.db.reports.some(function (r) { return r.target_type === entry.kind && r.target_id === entry.item.id && r.status === 'open'; });
  }

  function applyFilter(queue, filterId) {
    switch (filterId) {
      case 'posts': return queue.filter(function (e) { return e.kind === 'post'; });
      case 'replies': return queue.filter(function (e) { return e.kind === 'reply'; });
      case 'reports': return queue.filter(hasOpenReport);
      case 'high': return queue.filter(function (e) { return riskOf(e) === 'high'; });
      case 'pii': return queue.filter(hasPersonalData);
      default: return queue;
    }
  }

  function card(entry) {
    var item = entry.item;
    var risk = riskOf(entry);
    var typeLabel = entry.kind === 'post' ? 'Публикация' : 'Ответ опытом';
    var text = entry.kind === 'post'
      ? (item.title ? item.title + '\n\n' : '') + item.body
      : item.experience_text + (item.advice_text ? '\n\n' + item.advice_text : '');

    return (
      '<div class="mod-card">' +
        '<div class="mod-card-top">' +
          '<span>Тип: <b>' + BC.escapeHtml(typeLabel) + (entry.kind === 'post' ? ' · ' + BC.escapeHtml(BC.postTypeLabel(item.type)) : '') + '</b></span>' +
          '<span>Автор: <b>' + BC.escapeHtml(item.user_id) + '</b></span>' +
          '<span>AI risk: <span class="risk ' + risk + '">' + risk + '</span></span>' +
        '</div>' +
        '<div class="mod-reason">Причина: ' + BC.escapeHtml(reasonOf(entry)) + (hasOpenReport(entry) ? ' · есть жалобы' : '') + '</div>' +
        '<div class="mod-text">' + BC.escapeHtml(text) + '</div>' +
        '<div class="mod-actions">' +
          '<button class="btn btn-primary btn-sm" data-action="mod-approve" data-kind="' + entry.kind + '" data-id="' + item.id + '">Одобрить</button>' +
          '<button class="btn btn-secondary btn-sm" data-action="mod-request-edit" data-kind="' + entry.kind + '" data-id="' + item.id + '">Попросить изменить</button>' +
          '<button class="btn btn-secondary btn-sm" data-action="mod-reject" data-kind="' + entry.kind + '" data-id="' + item.id + '">Отклонить</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="mod-restrict" data-user-id="' + item.user_id + '">Ограничить пользователя</button>' +
        '</div>' +
      '</div>'
    );
  }

  BC.renderModeratorPanel = function (container, activeFilter) {
    var queue = BC.moderationQueue();
    var highRiskCount = queue.filter(function (e) { return riskOf(e) === 'high'; }).length;
    var filtered = applyFilter(queue, activeFilter || 'all');

    var html =
      '<div class="mod-stats">' +
        '<span class="mod-stat">На проверке: <b>' + queue.length + '</b></span>' +
        '<span class="mod-stat">Жалобы: <b>' + BC.openReportsCount() + '</b></span>' +
        '<span class="mod-stat">Высокий риск: <b>' + highRiskCount + '</b></span>' +
      '</div>' +
      '<div class="mod-filters">' + FILTERS.map(function (f) {
        return '<button class="mod-filter-btn' + (f.id === (activeFilter || 'all') ? ' active' : '') + '" data-action="mod-filter" data-filter="' + f.id + '">' + f.label + '</button>';
      }).join('') + '</div>';

    if (!filtered.length) {
      html += '<div class="empty-state"><p>В этой категории пока нет материалов на проверке.</p></div>';
    } else {
      html += filtered.map(card).join('');
    }
    container.innerHTML = html;
  };

  BC.openModReasonModal = function (title, defaultReason, onSubmit) {
    var html =
      '<div class="modal-head"><div class="modal-title">' + BC.escapeHtml(title) + '</div><button class="modal-close" data-close>&times;</button></div>' +
      '<div class="field"><label>Комментарий автору</label><textarea id="mod-reason-text" rows="3">' + BC.escapeHtml(defaultReason || '') + '</textarea></div>' +
      '<div class="modal-foot"><button class="btn btn-secondary" data-close>Отмена</button><button class="btn btn-primary" id="mod-reason-submit">Подтвердить</button></div>';
    BC.openModal(html, function (root) {
      root.querySelector('#mod-reason-submit').addEventListener('click', function () {
        onSubmit(root.querySelector('#mod-reason-text').value.trim());
        BC.closeModal();
      });
    });
  };
})();
