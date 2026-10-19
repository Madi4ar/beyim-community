(function () {
  var BC = (window.BC = window.BC || {});

  BC.escapeHtml = function (str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  BC.timeAgo = function (iso) {
    var diffMs = Date.now() - new Date(iso).getTime();
    var min = Math.floor(diffMs / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return min + (min === 1 ? ' минуту назад' : min < 5 ? ' минуты назад' : ' минут назад');
    var hrs = Math.floor(min / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' час назад' : hrs < 5 ? ' часа назад' : ' часов назад');
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + (days === 1 ? ' день назад' : days < 5 ? ' дня назад' : ' дней назад');
    return new Date(iso).toLocaleDateString('ru-RU');
  };

  // Alias numbering is scoped per-thread (section 4.1): the author is never
  // numbered ("Автор"), everyone else gets the next free number in that post.
  BC.getAlias = function (postId, userId, isAuthor) {
    var db = BC.db;
    if (isAuthor) return 'Автор';
    var key = postId;
    db.aliases[key] = db.aliases[key] || {};
    if (!db.aliases[key][userId]) {
      var used = Object.keys(db.aliases[key]).length;
      db.aliases[key][userId] = used + 2; // author implicitly holds slot 1
      BC.persist();
    }
    return db.aliases[key][userId];
  };

  BC.initials = function (label) {
    return (label || 'А').trim().charAt(0).toUpperCase();
  };

  BC.toast = function (msg) {
    var root = document.getElementById('toast-root');
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 260);
    }, 2600);
  };

  BC.resultLabel = function (code) {
    return ({ worked: 'Сработало', partial: 'Частично сработало', not_worked: 'Не сработало', pending: 'Пока проверяю' })[code] || code;
  };

  BC.situationLabel = function (code) {
    return ({ yes: 'Да', partial: 'Частично', no: 'Нет, но есть релевантный опыт' })[code] || code;
  };

  BC.statusLabel = function (status) {
    return ({
      draft: 'Черновик', pending: 'Проходит модерацию', approved: 'Опубликовано',
      needs_edit: 'Требуется изменение', manual_review: 'На проверке модератором',
      rejected: 'Отклонено', archived: 'Снято с публикации'
    })[status] || status;
  };
})();
