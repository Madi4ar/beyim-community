/* Feed composition: tabs (section 28) and the "Для вас / Новое / Популярное"
   sort heuristics. Search was dropped from the MVP by request — the feed is
   small enough to browse by tab/tag, so a search box just added header noise. */
(function () {
  var BC = (window.BC = window.BC || {});

  // "Сохранённое" and "Мои публикации" live as header icons now (see
  // main.js renderNavIcons) — they're personal shortcuts, not content
  // categories, so they no longer clutter the scrolling tabs row.
  BC.TABS = [
    { id: 'foryou', label: 'Для вас' },
    { id: 'new', label: 'Новое' },
    { id: 'advice', label: 'Нужен совет' },
    { id: 'case', label: 'Кейсы' },
    { id: 'lesson_idea', label: 'Идеи для уроков' },
    { id: 'worked', label: 'Что сработало' },
    { id: 'popular', label: 'Популярное' }
  ];

  function engagementScore(post) {
    var reactions = BC.db.reactions.filter(function (r) { return r.target_type === 'post' && r.target_id === post.id; }).length;
    var replies = BC.approvedReplyCount(post.id);
    return reactions * 2 + replies * 3;
  }

  function recencyBoost(post) {
    var hrs = (Date.now() - new Date(post.created_at).getTime()) / 3600000;
    return Math.max(0, 48 - hrs);
  }

  BC.getPostsForTab = function (tab) {
    var list = BC.visiblePosts();

    if (tab === 'my') {
      list = list.filter(function (p) { return p.user_id === BC.me(); });
    } else if (tab === 'saved') {
      list = list.filter(function (p) { return p.status === 'approved' && BC.isBookmarked(p.id); });
    } else {
      list = list.filter(function (p) { return p.status === 'approved'; });
      if (['advice', 'case', 'lesson_idea', 'worked'].indexOf(tab) !== -1) {
        list = list.filter(function (p) { return p.type === tab; });
      }
    }

    if (tab === 'popular') {
      list.sort(function (a, b) { return engagementScore(b) - engagementScore(a); });
    } else if (tab === 'foryou') {
      list.sort(function (a, b) { return (engagementScore(b) + recencyBoost(b)) - (engagementScore(a) + recencyBoost(a)); });
    } else {
      list.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    }
    return list;
  };

  function emptyState(tab) {
    var msg = {
      saved: 'Вы ещё ничего не сохранили.',
      my: 'У вас пока нет публикаций.'
    }[tab] || 'Пока здесь нет публикаций.';
    return (
      '<div class="empty-state"><p>' + msg + '<br>Поделитесь первым профессиональным опытом.</p>' +
      '<button class="btn btn-primary" data-action="open-composer">Создать публикацию</button></div>'
    );
  }

  // Context-aware nudge instead of a flat "что хотите обсудить" — ties the
  // prompt to what the teacher is already browsing, so it reads as an
  // invitation rather than an empty input field.
  var ENTRY_PROMPTS = {
    foryou: 'Был сложный урок или находка, которой стоит поделиться? Коллеги ответят своим опытом.',
    new: 'Что сейчас происходит в вашей практике? Расскажите — это может быть полезно коллегам.',
    advice: 'Столкнулись со сложной ситуацией? Спросите совета у коллег — это быстрее, чем решать одному.',
    case: 'Поделитесь кейсом, который сработал в вашей практике.',
    lesson_idea: 'Есть идея урока, методика или приём, которым стоит поделиться?',
    worked: 'Что сработало у вас? Расскажите — кому-то это сэкономит месяцы проб.',
    popular: 'Поделитесь опытом, который стоит обсудить всему сообществу.'
  };

  BC.renderFeed = function (container, tab) {
    var posts = BC.getPostsForTab(tab);
    var html = (tab !== 'my' && tab !== 'saved')
      ? '<div class="composer-entry"><span class="composer-entry-text">' + (ENTRY_PROMPTS[tab] || ENTRY_PROMPTS.foryou) + '</span><button class="btn btn-primary" data-action="open-composer">Поделиться опытом</button></div>'
      : '';
    if (!posts.length) {
      html += emptyState(tab);
    } else {
      html += posts.map(function (p) { return BC.renderPostCard(p, { expanded: false }); }).join('');
    }
    container.innerHTML = html;
  };

  BC.renderPostDetail = function (container, postId) {
    var post = BC.getPost(postId);
    if (!post || !BC.canSeeStatus(post.user_id, post.status)) {
      container.innerHTML = '<button class="show-more-btn" data-action="go-feed">← Назад к ленте</button><div class="empty-state"><p>Публикация недоступна.</p></div>';
      return;
    }
    container.innerHTML =
      '<button class="show-more-btn" data-action="go-feed">← Назад к ленте</button>' +
      BC.renderPostCard(post, { expanded: true });
  };
})();
