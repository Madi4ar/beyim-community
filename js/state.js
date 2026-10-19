/* Data-access layer: CRUD over the emulated tables, RLS-equivalent visibility
   rules (section 38-39), moderation pipeline wiring, and a tiny pub/sub so UI
   modules can re-render after a mutation. */
(function () {
  var BC = (window.BC = window.BC || {});
  var db = BC.db;

  var listeners = [];
  BC.onChange = function (fn) { listeners.push(fn); };
  BC.emitChange = function () { listeners.forEach(function (fn) { fn(); }); };

  BC.me = function () { return db.me; };
  BC.isModerator = function () { return db.role === 'moderator'; };
  BC.setRole = function (role) { db.role = role; BC.persist(); BC.emitChange(); };

  function ensureUserStatus(userId) {
    if (!db.userStatus[userId]) {
      db.userStatus[userId] = {
        user_id: userId, trust_score: 0, moderation_status: 'normal',
        warnings_count: 0, suspension_until: null, updated_at: BC.now()
      };
    }
    return db.userStatus[userId];
  }
  BC.ensureUserStatus = ensureUserStatus;

  function pushNotification(userId, text) {
    db.notifications.unshift({ id: BC.uid('ntf'), user_id: userId, text: text, read: false, created_at: BC.now() });
    BC.persist();
  }
  BC.pushNotification = pushNotification;

  /* ---------------- RLS-equivalent visibility ---------------- */
  // Mirrors the server-side rule from section 39: approved, OR mine, OR I'm a moderator.
  function canSeeStatus(ownerId, status) {
    if (status === 'approved') return true;
    if (ownerId === db.me) return true;
    if (BC.isModerator()) return true;
    return false;
  }
  BC.canSeeStatus = canSeeStatus;

  BC.visiblePosts = function () {
    return db.posts.filter(function (p) { return canSeeStatus(p.user_id, p.status); });
  };

  BC.getPost = function (id) {
    return db.posts.filter(function (p) { return p.id === id; })[0] || null;
  };

  BC.visibleRepliesForPost = function (postId) {
    return db.replies
      .filter(function (r) { return r.post_id === postId && canSeeStatus(r.user_id, r.status); })
      .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
  };

  BC.approvedReplyCount = function (postId) {
    return db.replies.filter(function (r) { return r.post_id === postId && r.status === 'approved'; }).length;
  };

  /* ---------------- Posts ---------------- */
  BC.createPost = function (data) {
    var post = {
      id: BC.uid('post'), user_id: db.me, type: data.type, anonymous: data.anonymous !== false,
      isArticle: !!data.isArticle,
      title: data.title.trim(), body: data.body.trim(), tags: data.tags || [],
      status: 'pending', moderation_score: null, moderation_reason: null,
      created_at: BC.now(), approved_at: null, updated_at: BC.now()
    };
    db.posts.unshift(post);
    BC.persist();
    BC.emitChange();
    runPostModeration(post.id);
    return post;
  };

  BC.resubmitPost = function (postId, data) {
    var post = BC.getPost(postId);
    if (!post) return;
    post.title = data.title.trim();
    post.body = data.body.trim();
    post.tags = data.tags || post.tags;
    post.status = 'pending';
    post.moderation_reason = null;
    post.updated_at = BC.now();
    BC.persist();
    BC.emitChange();
    runPostModeration(post.id);
  };

  BC.sendPostToModerator = function (postId) {
    var post = BC.getPost(postId);
    if (!post) return;
    post.status = 'manual_review';
    post.updated_at = BC.now();
    logModeration('post', post.id, post.user_id, 'manual_review', 'system', 'Отправлено пользователем на проверку модератору');
    BC.persist();
    BC.emitChange();
  };

  function runPostModeration(postId) {
    setTimeout(function () {
      var post = BC.getPost(postId);
      if (!post || post.status !== 'pending') return;
      var result = BC.checkText(post.title + ' ' + post.body);
      applyPostModerationResult(post, result);
    }, 1100);
  }

  function applyPostModerationResult(post, result) {
    post.moderation_score = result.level;
    post.moderation_reason = result.reasonText;
    post.status = BC.levelToStatus(result.level);
    post.updated_at = BC.now();
    if (post.status === 'approved') post.approved_at = BC.now();
    logModeration('post', post.id, post.user_id, post.status, 'ai', result.reasonText || 'ok');

    if (post.status === 'approved') {
      pushNotification(post.user_id, 'Ваш материал опубликован: «' + truncate(post.title) + '»');
    } else if (post.status === 'needs_edit') {
      pushNotification(post.user_id, 'Ваш материал требует изменения: «' + truncate(post.title) + '»');
    } else if (post.status === 'rejected') {
      pushNotification(post.user_id, 'Публикация не размещена. Причина: ' + result.reasonText);
    } else if (post.status === 'manual_review') {
      pushNotification(post.user_id, 'Ваша публикация отправлена на проверку модератору.');
    }
    BC.persist();
    BC.emitChange();
  }

  function truncate(s) { return (s || '').length > 48 ? s.slice(0, 48) + '…' : s; }

  /* ---------------- Experience replies ---------------- */
  BC.createReply = function (postId, data) {
    var reply = {
      id: BC.uid('rep'), post_id: postId, user_id: db.me, anonymous_alias: null,
      similar_situation: data.similar_situation || null,
      experience_text: (data.experience_text || '').trim(),
      result_type: data.result_type || null,
      advice_text: (data.advice_text || '').trim(),
      status: 'pending', moderation_score: null, moderation_reason: null,
      created_at: BC.now(), approved_at: null
    };
    db.replies.push(reply);
    BC.persist();
    BC.emitChange();
    runReplyModeration(reply.id);
    return reply;
  };

  function runReplyModeration(replyId) {
    setTimeout(function () {
      var reply = db.replies.filter(function (r) { return r.id === replyId; })[0];
      if (!reply || reply.status !== 'pending') return;
      var combined = [reply.experience_text, reply.advice_text].join(' ');
      var result = BC.checkText(combined);
      applyReplyModerationResult(reply, result);
    }, 1100);
  }

  function applyReplyModerationResult(reply, result) {
    reply.moderation_score = result.level;
    reply.moderation_reason = result.reasonText;
    reply.status = BC.levelToStatus(result.level);
    if (reply.status === 'approved') reply.approved_at = BC.now();
    logModeration('reply', reply.id, reply.user_id, reply.status, 'ai', result.reasonText || 'ok');

    var post = BC.getPost(reply.post_id);
    if (reply.status === 'approved') {
      pushNotification(reply.user_id, 'Ваш ответ опытом опубликован.');
      if (post && post.user_id !== reply.user_id) {
        pushNotification(post.user_id, 'Появился новый опыт коллег под вашей публикацией «' + truncate(post.title) + '».');
      }
    } else if (reply.status === 'needs_edit') {
      pushNotification(reply.user_id, 'Ваш ответ опытом требует изменения.');
    } else if (reply.status === 'rejected') {
      pushNotification(reply.user_id, 'Ваш ответ опытом не размещён. Причина: ' + result.reasonText);
    } else if (reply.status === 'manual_review') {
      pushNotification(reply.user_id, 'Ваш ответ опытом отправлен на проверку модератору.');
    }
    BC.persist();
    BC.emitChange();
  }

  BC.resubmitReply = function (replyId, data) {
    var reply = db.replies.filter(function (r) { return r.id === replyId; })[0];
    if (!reply) return;
    reply.experience_text = (data.experience_text || reply.experience_text).trim();
    reply.advice_text = (data.advice_text != null ? data.advice_text : reply.advice_text).trim();
    reply.status = 'pending';
    reply.moderation_reason = null;
    BC.persist();
    BC.emitChange();
    runReplyModeration(reply.id);
  };

  BC.sendReplyToModerator = function (replyId) {
    var reply = db.replies.filter(function (r) { return r.id === replyId; })[0];
    if (!reply) return;
    reply.status = 'manual_review';
    logModeration('reply', reply.id, reply.user_id, 'manual_review', 'system', 'Отправлено пользователем на проверку модератору');
    BC.persist();
    BC.emitChange();
  };

  /* ---------------- Reactions & bookmarks ---------------- */
  BC.reactionCount = function (targetType, targetId, reactionType) {
    return db.reactions.filter(function (r) {
      return r.target_type === targetType && r.target_id === targetId && r.reaction_type === reactionType;
    }).length;
  };

  BC.hasReacted = function (targetType, targetId, reactionType) {
    return db.reactions.some(function (r) {
      return r.target_type === targetType && r.target_id === targetId &&
        r.reaction_type === reactionType && r.user_id === db.me;
    });
  };

  // No emitChange here on purpose: reactions are a high-frequency interaction
  // and a full feed re-render per click feels sluggish. The click handler in
  // main.js patches just the clicked button instead (see patchReactionButton).
  BC.toggleReaction = function (targetType, targetId, reactionType) {
    var idx = db.reactions.findIndex(function (r) {
      return r.target_type === targetType && r.target_id === targetId &&
        r.reaction_type === reactionType && r.user_id === db.me;
    });
    if (idx !== -1) {
      db.reactions.splice(idx, 1);
    } else {
      db.reactions.push({ id: BC.uid('rx'), user_id: db.me, target_type: targetType, target_id: targetId, reaction_type: reactionType, created_at: BC.now() });
    }
    BC.persist();
  };

  BC.isBookmarked = function (postId) {
    return db.bookmarks.some(function (b) { return b.post_id === postId && b.user_id === db.me; });
  };

  // No emitChange here either — see the note on toggleReaction above.
  BC.toggleBookmark = function (postId) {
    var idx = db.bookmarks.findIndex(function (b) { return b.post_id === postId && b.user_id === db.me; });
    if (idx !== -1) {
      db.bookmarks.splice(idx, 1);
    } else {
      db.bookmarks.push({ id: BC.uid('bm'), user_id: db.me, post_id: postId, created_at: BC.now() });
    }
    BC.persist();
  };

  BC.archiveItem = function (targetType, targetId) {
    var item = targetType === 'post' ? BC.getPost(targetId) : db.replies.filter(function (r) { return r.id === targetId; })[0];
    if (!item) return;
    item.status = 'archived';
    logModeration(targetType, targetId, item.user_id, 'archived', item.user_id === db.me ? 'system' : 'human', 'Снято с публикации');
    BC.persist();
    BC.emitChange();
  };

  /* ---------------- Reports ---------------- */
  BC.createReport = function (targetType, targetId, reason, details) {
    db.reports.push({
      id: BC.uid('rpt'), reporter_user_id: db.me, target_type: targetType, target_id: targetId,
      reason: reason, details: details || '', status: 'open', created_at: BC.now(),
      reviewed_at: null, reviewed_by: null
    });

    // section 22: a single report never removes content; after several
    // independent reports the item is escalated to manual_review.
    var reportsForTarget = db.reports.filter(function (r) { return r.target_type === targetType && r.target_id === targetId; });
    var distinctReporters = {};
    reportsForTarget.forEach(function (r) { distinctReporters[r.reporter_user_id] = true; });

    if (Object.keys(distinctReporters).length >= 3) {
      if (targetType === 'post') {
        var post = BC.getPost(targetId);
        if (post && post.status === 'approved') {
          post.status = 'manual_review';
          logModeration('post', post.id, post.user_id, 'manual_review', 'system', 'Эскалировано после нескольких жалоб');
        }
      } else if (targetType === 'reply') {
        var reply = db.replies.filter(function (r) { return r.id === targetId; })[0];
        if (reply && reply.status === 'approved') {
          reply.status = 'manual_review';
          logModeration('reply', reply.id, reply.user_id, 'manual_review', 'system', 'Эскалировано после нескольких жалоб');
        }
      }
    }
    BC.persist();
    BC.emitChange();
  };

  /* ---------------- Moderation log ---------------- */
  function logModeration(targetType, targetId, userId, decision, source, reason) {
    db.moderationLogs.unshift({
      id: BC.uid('log'), target_type: targetType, target_id: targetId, user_id: userId,
      decision: decision, moderation_source: source, reason: reason, raw_score: null, created_at: BC.now()
    });
  }
  BC.logModeration = logModeration;

  /* ---------------- Moderator actions (section 42-43) ---------------- */
  BC.modApprove = function (targetType, targetId) {
    var item = targetType === 'post' ? BC.getPost(targetId) : db.replies.filter(function (r) { return r.id === targetId; })[0];
    if (!item) return;
    item.status = 'approved';
    item.approved_at = BC.now();
    logModeration(targetType, targetId, item.user_id, 'approved', 'human', 'Одобрено модератором');
    pushNotification(item.user_id, targetType === 'post' ? 'Ваш материал опубликован после проверки модератором.' : 'Ваш ответ опытом опубликован после проверки модератором.');
    BC.persist();
    BC.emitChange();
  };

  BC.modReject = function (targetType, targetId, reasonText) {
    var item = targetType === 'post' ? BC.getPost(targetId) : db.replies.filter(function (r) { return r.id === targetId; })[0];
    if (!item) return;
    item.status = 'rejected';
    item.moderation_reason = reasonText || item.moderation_reason || 'Нарушение правил сообщества';
    logModeration(targetType, targetId, item.user_id, 'rejected', 'human', item.moderation_reason);
    pushNotification(item.user_id, (targetType === 'post' ? 'Публикация' : 'Ответ опытом') + ' не размещена. Причина: ' + item.moderation_reason);
    BC.persist();
    BC.emitChange();
  };

  BC.modRequestEdit = function (targetType, targetId, reasonText) {
    var item = targetType === 'post' ? BC.getPost(targetId) : db.replies.filter(function (r) { return r.id === targetId; })[0];
    if (!item) return;
    item.status = 'needs_edit';
    item.moderation_reason = reasonText || item.moderation_reason || 'Требуется небольшое изменение формулировки.';
    logModeration(targetType, targetId, item.user_id, 'needs_edit', 'human', item.moderation_reason);
    pushNotification(item.user_id, (targetType === 'post' ? 'Ваш материал' : 'Ваш ответ') + ' требует изменения.');
    BC.persist();
    BC.emitChange();
  };

  BC.modRestrictUser = function (userId) {
    var st = ensureUserStatus(userId);
    st.warnings_count += 1;
    st.moderation_status = st.warnings_count >= 3 ? 'suspended' : 'restricted';
    st.trust_score -= 10;
    st.updated_at = BC.now();
    logModeration('user', userId, userId, st.moderation_status, 'human', 'Ограничение применено модератором');
    BC.persist();
    BC.emitChange();
  };

  /* ---------------- Moderator queue ---------------- */
  BC.moderationQueue = function () {
    var postItems = db.posts
      .filter(function (p) { return p.status === 'pending' || p.status === 'manual_review'; })
      .map(function (p) { return { kind: 'post', item: p }; });
    var replyItems = db.replies
      .filter(function (r) { return r.status === 'pending' || r.status === 'manual_review'; })
      .map(function (r) { return { kind: 'reply', item: r }; });
    return postItems.concat(replyItems).sort(function (a, b) {
      return new Date(a.item.created_at) - new Date(b.item.created_at);
    });
  };

  BC.openReportsCount = function () {
    var targets = {};
    db.reports.filter(function (r) { return r.status === 'open'; }).forEach(function (r) {
      targets[r.target_type + ':' + r.target_id] = true;
    });
    return Object.keys(targets).length;
  };
})();
