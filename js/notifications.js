(function () {
  var BC = (window.BC = window.BC || {});

  function myNotifications() {
    return BC.db.notifications
      .filter(function (n) { return n.user_id === BC.me(); })
      .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }

  function renderPanel() {
    var panel = document.getElementById('notif-panel');
    var items = myNotifications();
    var html = '<div class="dropdown-header"><span>Уведомления</span></div>';
    if (!items.length) {
      html += '<div class="dropdown-empty">Пока нет уведомлений.</div>';
    } else {
      html += items.slice(0, 20).map(function (n) {
        return '<div class="notif-item' + (n.read ? '' : ' unread') + '">' +
          BC.escapeHtml(n.text) +
          '<div class="notif-time">' + BC.timeAgo(n.created_at) + '</div></div>';
      }).join('');
    }
    panel.innerHTML = html;
  }

  function updateDot() {
    var hasUnread = myNotifications().some(function (n) { return !n.read; });
    document.getElementById('notif-dot').hidden = !hasUnread;
  }

  function markAllRead() {
    myNotifications().forEach(function (n) { n.read = true; });
    BC.persist();
    updateDot();
  }

  BC.refreshNotifications = function () {
    renderPanel();
    updateDot();
  };

  BC.toggleNotifPanel = function () {
    var panel = document.getElementById('notif-panel');
    var willOpen = panel.hidden;
    panel.hidden = !willOpen;
    if (willOpen) {
      renderPanel();
      markAllRead();
      renderPanel();
    }
  };

  BC.closeNotifPanel = function () {
    document.getElementById('notif-panel').hidden = true;
  };
})();
