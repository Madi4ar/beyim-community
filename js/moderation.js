/* Simulated AI-moderation (sections 9-11): keyword/regex heuristics standing
   in for a real moderation model, returning green / yellow / manual_review / red. */
(function () {
  var BC = (window.BC = window.BC || {});

  var THREATS = ['убью', 'угрожаю', 'расправлюсь', 'уничтожу тебя', 'найду тебя и', 'пожалеешь'];

  var PROFANITY = ['бляд', 'сука', 'хуй', 'пизд', 'ебат', 'гандон', 'мудак'];

  var INSULTS_PERSON = [
    'вы плохой педагог', 'ты плохой педагог', 'как можно быть таким педагогом',
    'ты тупой', 'вы тупые', 'вы идиот', 'ты идиот', 'ничтожество', 'бездарь', 'неуч',
    'вы ничего не понимаете', 'ты ничего не понимаешь'
  ];

  var AD_HOMINEM_SOFT = ['это глупость', 'это бред', 'что за глупость', 'какая глупость'];

  var SPAM_MARKERS = ['купить сейчас', 'переходи по ссылке', 'заработок без вложений',
    'скидка только сегодня', 'пиши в директ', 'подпишись на канал', 'www.', 'http://', 'https://'];

  var SEXUAL_MARKERS = ['порно', 'интим фото', 'эротическ'];

  var AMBIGUOUS_MARKERS = ['ирония конечно', 'ну конечно же', 'ага, молодцы', 'серьёзно? ну да ладно'];

  var PHONE_RE = /(\+?7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/;
  var EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/;
  var IIN_RE = /\b\d{12}\b/;
  var ADDRESS_RE = /\b(ул\.|улица|проспект|мкр\.?|мкрн\.?|дом\s?№?\s?\d+|кв\.\s?\d+)\b/i;

  function containsAny(lower, list) {
    for (var i = 0; i < list.length; i++) {
      if (lower.indexOf(list[i]) !== -1) return list[i];
    }
    return null;
  }

  function detectPersonalData(text) {
    var found = [];
    if (PHONE_RE.test(text)) found.push('номер телефона');
    if (EMAIL_RE.test(text)) found.push('электронная почта');
    if (IIN_RE.test(text)) found.push('ИИН');
    if (ADDRESS_RE.test(text)) found.push('домашний адрес');
    return found;
  }

  // Returns { level: 'green'|'yellow'|'manual_review'|'red', reasonCode, reasonText }
  BC.checkText = function (rawText) {
    var text = rawText || '';
    var lower = text.toLowerCase();

    var threat = containsAny(lower, THREATS);
    if (threat) {
      return { level: 'red', reasonCode: 'threats', reasonText: 'угрозы' };
    }

    var prof = containsAny(lower, PROFANITY);
    var insult = containsAny(lower, INSULTS_PERSON);
    if (prof || insult) {
      return { level: 'red', reasonCode: 'insults', reasonText: 'оскорбительная лексика' };
    }

    var sexual = containsAny(lower, SEXUAL_MARKERS);
    if (sexual) {
      return { level: 'red', reasonCode: 'sexual', reasonText: 'неприемлемый контент' };
    }

    var personalData = detectPersonalData(text);
    if (personalData.length) {
      return {
        level: 'yellow', reasonCode: 'personal_data',
        reasonText: 'Похоже, текст содержит персональные данные (' + personalData.join(', ') + '). Обезличьте ситуацию перед публикацией.'
      };
    }

    var ambiguous = containsAny(lower, AMBIGUOUS_MARKERS);
    if (ambiguous) {
      return { level: 'manual_review', reasonCode: 'ambiguous_tone', reasonText: 'AI не уверен в тональности текста — материал отправлен модератору.' };
    }

    var spam = containsAny(lower, SPAM_MARKERS);
    if (spam) {
      return { level: 'yellow', reasonCode: 'spam', reasonText: 'В тексте есть признаки рекламы или спама, которые могут нарушать правила профессионального общения.' };
    }

    var softAdHominem = containsAny(lower, AD_HOMINEM_SOFT);
    if (softAdHominem) {
      return { level: 'yellow', reasonCode: 'ad_hominem', reasonText: 'В тексте есть формулировки, которые могут нарушать правила профессионального общения.' };
    }

    return { level: 'green', reasonCode: null, reasonText: null };
  };

  BC.detectPersonalData = detectPersonalData;

  // Maps a moderation level to the post/reply lifecycle status (section 8, 10).
  BC.levelToStatus = function (level) {
    return ({ green: 'approved', yellow: 'needs_edit', manual_review: 'manual_review', red: 'rejected' })[level];
  };
})();
