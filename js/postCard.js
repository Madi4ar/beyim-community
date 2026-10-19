/* Rendering for a single post: feed (truncated) and detail (full, with all
   replies) share this function, driven by an `expanded` flag. */
(function () {
  var BC = (window.BC = window.BC || {});

  var REACTION_LABEL = { useful: 'Полезно', support: 'Поддерживаю', interesting: 'Интересный опыт', will_try: 'Попробую в практике' };

  function reactionTypesForPost(post) {
    var types = ['useful', 'support'];
    if (['case', 'worked', 'not_worked'].indexOf(post.type) !== -1) types.push('interesting');
    if (['lesson_idea', 'method_find'].indexOf(post.type) !== -1) types.push('will_try');
    return types;
  }

  function userProfile(userId) {
    return (BC.db.users && BC.db.users[userId]) || {};
  }

  // Anonymity is per-post (section 6), not a blanket rule: when the author
  // chose to publish openly, show their name and any earned status badge
  // (section 26) instead of "Анонимный педагог".
  function authorLine(post) {
    if (post.anonymous === false) {
      var profile = userProfile(post.user_id);
      var name = BC.escapeHtml(profile.display || 'Педагог ' + post.user_id.replace('u_', '#'));
      var statusBadge = profile.status ? ' <span class="author-status">' + BC.escapeHtml(profile.status) + '</span>' : '';
      return name + ' <span class="post-author-tag">· Автор</span>' + statusBadge;
    }
    return 'Анонимный педагог <span class="post-author-tag">· Автор</span>';
  }

  function avatarInitials(post) {
    if (post.anonymous === false) {
      var name = userProfile(post.user_id).display;
      if (name) return BC.initials(name);
    }
    return 'А';
  }

  function reactionsHtml(targetType, targetId, types, extra) {
    var pills = types.map(function (rt) {
      var count = BC.reactionCount(targetType, targetId, rt);
      var active = BC.hasReacted(targetType, targetId, rt);
      return '<button class="reaction-btn' + (active ? ' active' : '') + '" data-action="toggle-reaction" data-target-type="' + targetType + '" data-target-id="' + targetId + '" data-reaction="' + rt + '">' +
        BC.escapeHtml(REACTION_LABEL[rt]) + (count ? ' ' + count : '') + '</button>';
    }).join('');
    if (extra) pills += extra;
    return '<div class="reactions-row">' + pills + '</div>';
  }

  // Targeted DOM patch for a single reaction/bookmark click, so a hot
  // interaction like "Полезно" never has to re-render the whole feed list.
  BC.patchReactionButton = function (btn, targetType, targetId, reactionType) {
    var active = BC.hasReacted(targetType, targetId, reactionType);
    var count = BC.reactionCount(targetType, targetId, reactionType);
    btn.classList.toggle('active', active);
    btn.textContent = REACTION_LABEL[reactionType] + (count ? ' ' + count : '');
    btn.classList.remove('pulse');
    void btn.offsetWidth;
    btn.classList.add('pulse');
  };

  BC.patchBookmarkButton = function (btn, postId) {
    var saved = BC.isBookmarked(postId);
    btn.classList.toggle('active', saved);
    var svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', saved ? 'currentColor' : 'none');
    btn.classList.remove('pulse');
    void btn.offsetWidth;
    btn.classList.add('pulse');
  };

  function bookmarkBtn(postId) {
    var saved = BC.isBookmarked(postId);
    return '<button class="reaction-btn save' + (saved ? ' active' : '') + '" data-action="toggle-bookmark" data-post-id="' + postId + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="' + (saved ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z"/></svg>' +
      'Сохранить</button>';
  }

  function ownerMenu(targetType, targetId, ownerId) {
    var isOwner = ownerId === BC.me();
    var isMod = BC.isModerator();
    var items = '';
    if (!isOwner) items += '<button data-action="open-report" data-target-type="' + targetType + '" data-target-id="' + targetId + '">Пожаловаться</button>';
    if (isOwner || isMod) items += '<button class="danger" data-action="hide-item" data-target-type="' + targetType + '" data-target-id="' + targetId + '">Скрыть ' + (targetType === 'post' ? 'публикацию' : 'ответ') + '</button>';
    return (
      '<div class="post-menu-wrap">' +
        '<button class="icon-btn" data-action="toggle-menu" data-menu-id="m-' + targetType + '-' + targetId + '">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>' +
        '</button>' +
        '<div class="menu-dropdown" id="m-' + targetType + '-' + targetId + '" hidden>' + items + '</div>' +
      '</div>'
    );
  }

  function statusNoticeForPost(post) {
    if (post.user_id !== BC.me()) return '';
    switch (post.status) {
      case 'pending':
        return '<div class="notice-box"><strong>Опубликовано · проходит модерацию</strong>Сейчас публикация видна только вам. После проверки она появится в общей ленте.</div>';
      case 'needs_edit':
        return '<div class="notice-box warn"><strong>Требуется небольшое изменение</strong>' + BC.escapeHtml(post.moderation_reason || 'В тексте есть формулировки, которые могут нарушать правила профессионального общения.') +
          '<div class="notice-actions">' +
            '<button class="btn btn-secondary btn-sm" data-action="edit-post" data-post-id="' + post.id + '">Редактировать</button>' +
            '<button class="btn btn-secondary btn-sm" data-action="ai-rephrase-post" data-post-id="' + post.id + '">Переформулировать с AI</button>' +
            '<button class="btn btn-secondary btn-sm" data-action="send-mod-post" data-post-id="' + post.id + '">Отправить на проверку модератору</button>' +
          '</div></div>';
      case 'manual_review':
        return '<div class="status-pill manual_review"><span class="dot"></span>На проверке модератором</div>';
      case 'rejected':
        return '<div class="notice-box"><strong>Публикация не размещена</strong>Причина: ' + BC.escapeHtml(post.moderation_reason || 'нарушение правил сообщества') + '</div>';
      case 'archived':
        return '<div class="status-pill"><span class="dot"></span>Снято с публикации</div>';
      default:
        return '';
    }
  }

  function replyStatusNotice(reply) {
    if (reply.user_id !== BC.me()) return '';
    switch (reply.status) {
      case 'pending':
        return '<div class="notice-box"><strong>Ваш ответ отправлен</strong>Проходит модерацию.</div>';
      case 'needs_edit':
        return '<div class="notice-box warn"><strong>Требуется небольшое изменение</strong>' + BC.escapeHtml(reply.moderation_reason || '') +
          '<div class="notice-actions">' +
            '<button class="btn btn-secondary btn-sm" data-action="edit-reply" data-reply-id="' + reply.id + '">Редактировать</button>' +
            '<button class="btn btn-secondary btn-sm" data-action="ai-rephrase-reply" data-reply-id="' + reply.id + '">Переформулировать с AI</button>' +
            '<button class="btn btn-secondary btn-sm" data-action="send-mod-reply" data-reply-id="' + reply.id + '">Отправить на проверку модератору</button>' +
          '</div></div>';
      case 'manual_review':
        return '<div class="status-pill manual_review"><span class="dot"></span>На проверке модератором</div>';
      case 'rejected':
        return '<div class="notice-box"><strong>Ответ не размещён</strong>Причина: ' + BC.escapeHtml(reply.moderation_reason || '') + '</div>';
      default:
        return '';
    }
  }

  function renderReply(reply, post) {
    var alias = BC.getAlias(post.id, reply.user_id, false);
    return (
      '<div class="reply-item">' +
        '<div class="reply-author">Анонимный педагог ' + alias + '</div>' +
        (reply.similar_situation ? '<div class="reply-sub">Похожая ситуация: ' + BC.escapeHtml(BC.situationLabel(reply.similar_situation)) + '</div>' : '') +
        '<div class="reply-text">' + BC.escapeHtml(reply.experience_text) + '</div>' +
        (reply.advice_text ? '<div class="reply-text">' + BC.escapeHtml(reply.advice_text) + '</div>' : '') +
        (reply.result_type ? '<div class="reply-result">Результат: ' + BC.escapeHtml(BC.resultLabel(reply.result_type)) + '</div>' : '') +
        replyStatusNotice(reply) +
        '<div class="reply-actions">' +
          reactionsHtml('reply', reply.id, ['useful']) +
          ownerMenu('reply', reply.id, reply.user_id) +
        '</div>' +
      '</div>'
    );
  }

  // Lightweight, read-only summary line for the feed card — just enough
  // social proof (likes / replies) to decide whether to open the post, with
  // the actual interactive reactions and "Опыт коллег" list living only on
  // the single-post view (requested: don't duplicate full reactions in-feed).
  // Icon-only on the feed card (space is tight with many cards on screen);
  // the single-post view keeps the text labels via reactionsHtml / the
  // "Опыт коллег" heading in experienceSection below.
  var USEFUL_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11H4a1 1 0 01-1-1v-9a1 1 0 011-1h3zm0 0l4.34-8.67a1 1 0 011.78.9L12 8h7.19a2 2 0 011.98 2.28l-1.14 8A2 2 0 0118.05 20H10a3 3 0 01-3-3v-7z"/></svg>';
  var REPLIES_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>';

  function footerStats(post, approvedCount, openAction) {
    var usefulCount = BC.reactionCount('post', post.id, 'useful');
    return (
      '<div class="post-footer-stats" data-action="' + openAction + '" data-post-id="' + post.id + '">' +
        '<span class="footer-stat" title="Полезно" aria-label="Полезно: ' + usefulCount + '">' + USEFUL_ICON + usefulCount + '</span>' +
        '<span class="footer-stat" title="Опыт коллег" aria-label="Опыт коллег: ' + approvedCount + '">' + REPLIES_ICON + approvedCount + '</span>' +
        '<button type="button" class="footer-share-btn" data-action="share-post" data-post-id="' + post.id + '">Поделиться</button>' +
      '</div>'
    );
  }

  BC.renderPostCard = function (post, opts) {
    opts = opts || {};
    var expanded = !!opts.expanded;
    var isArticle = !!post.isArticle;
    var openAction = isArticle ? 'open-article' : 'open-post';
    var isLive = post.status === 'approved';
    var replies = isLive ? BC.visibleRepliesForPost(post.id) : [];
    var approvedCount = BC.approvedReplyCount(post.id);
    var visibleReplies = expanded ? replies : replies.slice(0, 2);
    var hiddenCount = replies.length - visibleReplies.length;

    var titleHtml = expanded
      ? '<h2 class="post-title">' + BC.escapeHtml(post.title) + '</h2>'
      : '<h2 class="post-title" data-action="' + openAction + '" data-post-id="' + post.id + '" style="cursor:pointer">' + BC.escapeHtml(post.title) + '</h2>';

    var bodyHtml = '<p class="post-body' + (expanded ? '' : ' clamp') + '">' + BC.escapeHtml(post.body) + '</p>';

    var repliesHtml = visibleReplies.map(function (r) { return renderReply(r, post); }).join('');
    var showMoreHtml = (!expanded && hiddenCount > 0)
      ? '<button class="show-more-btn" data-action="open-post" data-post-id="' + post.id + '">Показать все ответы</button>'
      : '';

    // The experience-reply block and CTA only make sense once a post is
    // actually live — content not yet approved has nothing to respond to.
    var experienceSection = isLive
      ? (
        '<div class="replies-head">Опыт коллег · ' + approvedCount + '</div>' +
        repliesHtml +
        showMoreHtml +
        '<div class="cta-row">' +
          '<button class="btn btn-secondary" data-action="open-reply-form" data-post-id="' + post.id + '">Поделиться своим опытом</button>' +
        '</div>'
      )
      : '';

    var articleTag = isArticle ? '<span class="article-tag">Статья</span>' : '';
    var readArticleLink = (isArticle && !expanded)
      ? '<button type="button" class="read-article-btn" data-action="open-article" data-post-id="' + post.id + '">Читать статью →</button>'
      : '';

    return (
      '<article class="post' + (isArticle && !expanded ? ' post--article' : '') + '" data-post-id="' + post.id + '">' +
        '<div class="post-top">' +
          '<div class="post-type">' + articleTag + BC.escapeHtml(BC.postTypeLabel(post.type)).toUpperCase() + '</div>' +
          ownerMenu('post', post.id, post.user_id) +
        '</div>' +
        '<div class="post-meta-row">' +
          '<div class="avatar">' + avatarInitials(post) + '</div>' +
          '<div class="post-meta-text">' +
            '<span class="post-author">' + authorLine(post) + '</span>' +
            '<span class="post-time">' + BC.timeAgo(post.created_at) + '</span>' +
          '</div>' +
        '</div>' +
        titleHtml +
        bodyHtml +
        readArticleLink +
        (post.tags && post.tags.length ? '<div class="post-tags">' + post.tags.map(function (t) { return '<span class="tag">' + BC.escapeHtml(t) + '</span>'; }).join('') + '</div>' : '') +
        statusNoticeForPost(post) +
        // Reactions and the full "Опыт коллег" list only show on the
        // single-post view (page or article modal) — the feed itself only
        // gets the read-only footerStats summary below.
        (!expanded && isLive ? footerStats(post, approvedCount, openAction) : '') +
        (expanded && isLive ? reactionsHtml('post', post.id, reactionTypesForPost(post), bookmarkBtn(post.id)) : '') +
        (expanded ? experienceSection : '') +
      '</article>'
    );
  };

  // Articles open in a modal with the full text instead of navigating to
  // the single-post page — reuses the expanded card markup (reactions,
  // "Опыт коллег", reply CTA) so behavior matches a regular post's detail view.
  BC.openArticleModal = function (postId) {
    var post = BC.getPost(postId);
    if (!post || !BC.canSeeStatus(post.user_id, post.status)) return;
    BC.openModal('', function (box) {
      box.classList.add('article-modal');
      box.innerHTML =
        '<div class="article-modal-head"><span class="article-modal-tag">Статья</span><button class="modal-close" data-close>&times;</button></div>' +
        BC.renderPostCard(post, { expanded: true });
    });
  };

  // No real hosted URLs exist in this local prototype, so "Поделиться" copies
  // a short text summary to the clipboard rather than a link that wouldn't resolve.
  BC.sharePost = function (postId) {
    var post = BC.getPost(postId);
    if (!post) return;
    var text = post.title + ' — Beyim Community';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        BC.toast('Текст публикации скопирован.');
      }).catch(function () {
        BC.toast('Не удалось скопировать.');
      });
    } else {
      BC.toast('Поделиться недоступно в этом браузере.');
    }
  };
})();
