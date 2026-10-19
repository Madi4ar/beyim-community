/* "Поделиться своим опытом" (sections 14-15, 73-75): quick free-text reply
   or a structured 4-step case, both routed through the same moderation pipeline. */
(function () {
  var BC = (window.BC = window.BC || {});

  var SITUATIONS = [['yes', 'Да'], ['partial', 'Частично'], ['no', 'Нет, но есть релевантный опыт']];
  var RESULTS = [['worked', 'Сработало'], ['partial', 'Частично сработало'], ['not_worked', 'Не сработало'], ['pending', 'Пока проверяю']];

  function radioGroup(name, options, defaultVal) {
    return '<div class="radio-group">' + options.map(function (o) {
      return '<label class="radio-option"><input type="radio" name="' + name + '" value="' + o[0] + '"' + (o[0] === defaultVal ? ' checked' : '') + '> ' + o[1] + '</label>';
    }).join('') + '</div>';
  }

  BC.openReplyForm = function (postId) {
    var mode = 'quick';

    function body() {
      return (
        '<div class="mode-switch">' +
          '<button type="button" data-mode="quick" class="' + (mode === 'quick' ? 'active' : '') + '">Короткий ответ</button>' +
          '<button type="button" data-mode="full" class="' + (mode === 'full' ? 'active' : '') + '">Структурированный кейс</button>' +
        '</div>' +
        (mode === 'quick'
          ? '<div class="field"><label>Поделитесь своим опытом</label>' +
            '<textarea id="rf-quick-text" rows="5" placeholder="Что вы делали в похожей ситуации и что получилось?"></textarea></div>'
          : '<div class="field"><label>Была ли у вас похожая ситуация?</label>' + radioGroup('rf-situation', SITUATIONS, 'yes') + '</div>' +
            '<div class="field"><label>Что вы сделали?</label><textarea id="rf-what" rows="3" placeholder="Опишите, что вы предприняли"></textarea></div>' +
            '<div class="field"><label>Что получилось?</label>' + radioGroup('rf-result', RESULTS, 'worked') + '</div>' +
            '<div class="field"><label>Какой совет вы бы дали?</label><textarea id="rf-advice" rows="3" placeholder="Поделитесь советом для коллег"></textarea></div>'
        )
      );
    }

    function render(root) {
      root.innerHTML =
        '<div class="modal-head">' +
          '<div class="modal-title">Поделиться своим опытом</div>' +
          '<button class="modal-close" data-close>&times;</button>' +
        '</div>' +
        '<div class="modal-sub">Расскажите, что вы делали в похожей ситуации и что получилось. Ваше имя не будет показано другим участникам.</div>' +
        '<div id="rf-body">' + body() + '</div>' +
        '<div class="modal-foot">' +
          '<button class="btn btn-secondary" data-close>Отмена</button>' +
          '<button class="btn btn-primary" id="rf-submit">Отправить</button>' +
        '</div>';

      root.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', BC.closeModal); });
      root.querySelectorAll('.mode-switch button').forEach(function (b) {
        b.addEventListener('click', function () {
          mode = b.getAttribute('data-mode');
          document.getElementById('rf-body').innerHTML = body();
        });
      });
      root.querySelector('#rf-submit').addEventListener('click', function () {
        var data;
        if (mode === 'quick') {
          var txt = document.getElementById('rf-quick-text').value.trim();
          if (!txt) { BC.toast('Опишите свой опыт перед отправкой.'); return; }
          data = { experience_text: txt, similar_situation: null, result_type: null, advice_text: '' };
        } else {
          var what = document.getElementById('rf-what').value.trim();
          if (!what) { BC.toast('Опишите, что вы сделали.'); return; }
          data = {
            experience_text: what,
            similar_situation: root.querySelector('input[name="rf-situation"]:checked').value,
            result_type: root.querySelector('input[name="rf-result"]:checked').value,
            advice_text: document.getElementById('rf-advice').value.trim()
          };
        }
        BC.createReply(postId, data);
        BC.closeModal();
        BC.toast('Ваш ответ отправлен. Проходит модерацию.');
      });
    }

    BC.openModal('', render);
  };

  BC.openEditReplyModal = function (replyId) {
    var reply = BC.db.replies.filter(function (r) { return r.id === replyId; })[0];
    if (!reply) return;

    function render(root) {
      root.innerHTML =
        '<div class="modal-head">' +
          '<div class="modal-title">Редактировать ответ опытом</div>' +
          '<button class="modal-close" data-close>&times;</button>' +
        '</div>' +
        (reply.moderation_reason ? '<div class="notice-box warn"><strong>Требуется небольшое изменение</strong>' + BC.escapeHtml(reply.moderation_reason) + '</div>' : '') +
        '<div class="field"><label>Что вы сделали</label><textarea id="er-what" rows="4">' + BC.escapeHtml(reply.experience_text) + '</textarea></div>' +
        '<div class="field"><label>Совет</label><textarea id="er-advice" rows="3">' + BC.escapeHtml(reply.advice_text || '') + '</textarea></div>' +
        '<div class="modal-foot">' +
          '<button class="btn btn-secondary" id="er-send-mod">Отправить на проверку модератору</button>' +
          '<button class="btn btn-primary" id="er-submit">Отправить на повторную проверку</button>' +
        '</div>';

      root.querySelector('#er-submit').addEventListener('click', function () {
        var what = root.querySelector('#er-what').value.trim();
        if (!what) { BC.toast('Опишите, что вы сделали.'); return; }
        BC.resubmitReply(replyId, { experience_text: what, advice_text: root.querySelector('#er-advice').value.trim() });
        BC.closeModal();
        BC.toast('Отправлено на повторную проверку.');
      });

      root.querySelector('#er-send-mod').addEventListener('click', function () {
        BC.sendReplyToModerator(replyId);
        BC.closeModal();
        BC.toast('Ответ отправлен на проверку модератору.');
      });
    }

    BC.openModal('', render);
  };
})();
