(function () {
  var BC = (window.BC = window.BC || {});

  var REASONS = ['Оскорбление', 'Травля', 'Спам', 'Реклама', 'Персональные данные', 'Неприемлемый контент', 'Недостоверная информация', 'Другое'];

  BC.openReportModal = function (targetType, targetId) {
    var html =
      '<div class="modal-head">' +
        '<div class="modal-title">Пожаловаться</div>' +
        '<button class="modal-close" data-close>&times;</button>' +
      '</div>' +
      '<div class="modal-sub">Жалоба не удаляет публикацию автоматически. После нескольких независимых жалоб материал передаётся на ручную проверку.</div>' +
      '<div class="field">' +
        '<label>Причина</label>' +
        '<div class="radio-group">' +
        REASONS.map(function (r, i) {
          return '<label class="radio-option"><input type="radio" name="report-reason" value="' + BC.escapeHtml(r) + '"' + (i === 0 ? ' checked' : '') + '> ' + BC.escapeHtml(r) + '</label>';
        }).join('') +
        '</div>' +
      '</div>' +
      '<div class="field">' +
        '<label>Дополнительные детали (опционально)</label>' +
        '<textarea id="report-details" rows="3" placeholder="Опишите подробнее, если нужно"></textarea>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-secondary" data-close>Отмена</button>' +
        '<button class="btn btn-primary" id="report-submit-btn">Отправить жалобу</button>' +
      '</div>';

    BC.openModal(html, function (root) {
      root.querySelector('#report-submit-btn').addEventListener('click', function () {
        var reason = root.querySelector('input[name="report-reason"]:checked').value;
        var details = root.querySelector('#report-details').value;
        BC.createReport(targetType, targetId, reason, details);
        BC.closeModal();
        BC.toast('Жалоба отправлена. Спасибо, мы проверим публикацию.');
      });
    });
  };
})();
