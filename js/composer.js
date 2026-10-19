/* "Создать публикацию" (sections 5-7, 47, 74-76): type picker, title/body,
   tag picker, anonymous toggle (on by default), then premoderation. */
(function () {
  var BC = (window.BC = window.BC || {});

  BC.openComposer = function () {
    var selectedTags = [];
    var anonymous = true;

    function tagsHtml() {
      return BC.TAGS.map(function (t) {
        return '<button type="button" class="tag-chip' + (selectedTags.indexOf(t) !== -1 ? ' active' : '') + '" data-tag="' + BC.escapeHtml(t) + '">' + BC.escapeHtml(t) + '</button>';
      }).join('');
    }

    function render(root) {
      root.innerHTML =
        '<div class="modal-head">' +
          '<div class="modal-title">Создать публикацию</div>' +
          '<button class="modal-close" data-close>&times;</button>' +
        '</div>' +
        '<div class="modal-sub">Ваше имя не будет показано другим участникам. Публикация проходит модерацию перед появлением в общей ленте.</div>' +
        '<div class="field">' +
          '<label>Тип публикации</label>' +
          '<select id="cp-type">' + BC.POST_TYPES.map(function (t) { return '<option value="' + t.id + '">' + t.label + '</option>'; }).join('') + '</select>' +
        '</div>' +
        '<div class="field"><label>Заголовок</label><input type="text" id="cp-title" maxlength="140" placeholder="Коротко сформулируйте тему"></div>' +
        '<div class="field"><label>Текст</label><textarea id="cp-body" rows="6" placeholder="Расскажите о ситуации, кейсе или вопросе"></textarea></div>' +
        '<div class="field"><label>Теги</label><div class="tag-picker" id="cp-tags">' + tagsHtml() + '</div></div>' +
        '<label class="checkbox-row"><input type="checkbox" id="cp-anon" checked> Публиковать анонимно</label>' +
        '<label class="checkbox-row"><input type="checkbox" id="cp-article"> Опубликовать как статью (полный текст открывается отдельно, не анонимно)</label>' +
        '<div class="modal-foot">' +
          '<button class="btn btn-secondary" data-close>Отмена</button>' +
          '<button class="btn btn-primary" id="cp-submit">Опубликовать</button>' +
        '</div>';

      root.querySelector('#cp-tags').addEventListener('click', function (e) {
        var chip = e.target.closest('[data-tag]');
        if (!chip) return;
        var tag = chip.getAttribute('data-tag');
        var i = selectedTags.indexOf(tag);
        if (i === -1) selectedTags.push(tag); else selectedTags.splice(i, 1);
        chip.classList.toggle('active');
      });

      // An article is an authored, attributed piece — anonymity doesn't fit,
      // so checking one forces the other off instead of leaving a confusing combination.
      var articleCheckbox = root.querySelector('#cp-article');
      var anonCheckbox = root.querySelector('#cp-anon');
      articleCheckbox.addEventListener('change', function () {
        if (articleCheckbox.checked) { anonCheckbox.checked = false; anonCheckbox.disabled = true; }
        else { anonCheckbox.disabled = false; }
      });

      root.querySelector('#cp-submit').addEventListener('click', function () {
        var title = root.querySelector('#cp-title').value.trim();
        var text = root.querySelector('#cp-body').value.trim();
        if (!title || !text) { BC.toast('Заполните заголовок и текст публикации.'); return; }
        var data = {
          type: root.querySelector('#cp-type').value,
          title: title, body: text, tags: selectedTags.slice(),
          anonymous: articleCheckbox.checked ? false : anonCheckbox.checked,
          isArticle: articleCheckbox.checked
        };
        BC.createPost(data);
        BC.closeModal();
        BC.toast('Опубликовано · проходит модерацию');
        BC.go('my');
      });
    }

    BC.openModal('', render);
  };

  BC.openEditPostModal = function (postId) {
    var post = BC.getPost(postId);
    if (!post) return;
    var selectedTags = (post.tags || []).slice();

    function tagsHtml() {
      return BC.TAGS.map(function (t) {
        return '<button type="button" class="tag-chip' + (selectedTags.indexOf(t) !== -1 ? ' active' : '') + '" data-tag="' + BC.escapeHtml(t) + '">' + BC.escapeHtml(t) + '</button>';
      }).join('');
    }

    function render(root) {
      root.innerHTML =
        '<div class="modal-head">' +
          '<div class="modal-title">Редактировать публикацию</div>' +
          '<button class="modal-close" data-close>&times;</button>' +
        '</div>' +
        (post.moderation_reason ? '<div class="notice-box warn"><strong>Требуется небольшое изменение</strong>' + BC.escapeHtml(post.moderation_reason) + '</div>' : '') +
        '<div class="field"><label>Заголовок</label><input type="text" id="ep-title" maxlength="140" value="' + BC.escapeHtml(post.title) + '"></div>' +
        '<div class="field"><label>Текст</label><textarea id="ep-body" rows="6">' + BC.escapeHtml(post.body) + '</textarea></div>' +
        '<div class="field"><label>Теги</label><div class="tag-picker" id="ep-tags">' + tagsHtml() + '</div></div>' +
        '<div class="modal-foot">' +
          '<button class="btn btn-secondary" id="ep-send-mod">Отправить на проверку модератору</button>' +
          '<button class="btn btn-primary" id="ep-submit">Отправить на повторную проверку</button>' +
        '</div>';

      root.querySelector('#ep-tags').addEventListener('click', function (e) {
        var chip = e.target.closest('[data-tag]');
        if (!chip) return;
        var tag = chip.getAttribute('data-tag');
        var i = selectedTags.indexOf(tag);
        if (i === -1) selectedTags.push(tag); else selectedTags.splice(i, 1);
        chip.classList.toggle('active');
      });

      root.querySelector('#ep-submit').addEventListener('click', function () {
        var title = root.querySelector('#ep-title').value.trim();
        var text = root.querySelector('#ep-body').value.trim();
        if (!title || !text) { BC.toast('Заполните заголовок и текст публикации.'); return; }
        BC.resubmitPost(postId, { title: title, body: text, tags: selectedTags.slice() });
        BC.closeModal();
        BC.toast('Отправлено на повторную проверку.');
      });

      root.querySelector('#ep-send-mod').addEventListener('click', function () {
        BC.sendPostToModerator(postId);
        BC.closeModal();
        BC.toast('Публикация отправлена на проверку модератору.');
      });
    }

    BC.openModal('', render);
  };

  // "Переформулировать с AI" (section 10 Yellow) — a light-touch stub that
  // softens the flagged ad-hominem phrasing automatically before resubmitting.
  BC.aiRephraseAndResubmit = function (kind, id) {
    var SOFTEN = [
      [/это глупость/gi, 'я не согласен с этим подходом'],
      [/это бред/gi, 'я смотрю на это иначе'],
      [/вы ничего не понимаете/gi, 'мне кажется, здесь есть другой взгляд'],
      [/ты ничего не понимаешь/gi, 'мне кажется, здесь есть другой взгляд']
    ];
    function soften(text) {
      SOFTEN.forEach(function (pair) { text = text.replace(pair[0], pair[1]); });
      return text;
    }
    if (kind === 'post') {
      var post = BC.getPost(id);
      if (!post) return;
      BC.resubmitPost(id, { title: soften(post.title), body: soften(post.body), tags: post.tags });
    } else {
      var reply = BC.db.replies.filter(function (r) { return r.id === id; })[0];
      if (!reply) return;
      BC.resubmitReply(id, { experience_text: soften(reply.experience_text), advice_text: soften(reply.advice_text) });
    }
    BC.toast('Текст переформулирован и отправлен на повторную проверку.');
  };
})();
