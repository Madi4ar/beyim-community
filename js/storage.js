/* community_posts / community_experience_replies / community_reactions /
   community_bookmarks / community_reports / community_moderation_logs /
   community_user_status — emulated as a single localStorage document. */
(function () {
  var DB_KEY = 'beyim_community_db_v3';
  var BC = (window.BC = window.BC || {});

  var POST_TYPES = [
    { id: 'case', label: 'Мой кейс' },
    { id: 'advice', label: 'Нужен совет' },
    { id: 'worked', label: 'Что сработало' },
    { id: 'not_worked', label: 'Что не сработало' },
    { id: 'lesson_idea', label: 'Идея для урока' },
    { id: 'method_find', label: 'Методическая находка' },
    { id: 'question', label: 'Профессиональный вопрос' }
  ];

  var TAGS = ['Дисциплина', 'Методика', 'Классное руководство', 'Оценивание', 'AI',
    'Цифровые инструменты', 'Инклюзия', 'Психология', 'Управление классом',
    'Родители', 'Проектная работа', 'Исследование'];

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function now() { return new Date().toISOString(); }

  function minutesAgo(m) { return new Date(Date.now() - m * 60000).toISOString(); }

  function seedDb() {
    var me = 'u_me';
    var others = ['u_1021', 'u_8123', 'u_3344', 'u_5567', 'u_7788', 'u_9001'];

    var posts = [
      {
        id: uid('post'), user_id: others[0], type: 'advice', anonymous: false,
        title: 'Как вы работаете с учениками, которые полностью теряют мотивацию во второй четверти?',
        body: 'Во втором четверти у части класса резко падает интерес к предмету. Пробовал разные подходы, но хочу услышать, что реально сработало у коллег — особенно для подростков 7-8 класса.',
        tags: ['Управление классом', 'Психология'],
        status: 'approved', moderation_score: 'green', moderation_reason: null,
        created_at: minutesAgo(130), approved_at: minutesAgo(128), updated_at: minutesAgo(128)
      },
      {
        id: uid('post'), user_id: others[1], type: 'case', anonymous: true,
        title: 'Разделил задания по уровням сложности — вовлечённость выросла',
        body: 'В 7 классе было сильное расслоение по уровню подготовки. Начал делать три варианта одного задания: базовый, стандартный и усложнённый, с правом выбора самим учеником. Через две недели вовлечённость стала заметно выше, даже слабые ученики начали сдавать работы вовремя.',
        tags: ['Методика', 'Оценивание'],
        status: 'approved', moderation_score: 'green', moderation_reason: null,
        created_at: minutesAgo(60 * 20), approved_at: minutesAgo(60 * 20 - 2), updated_at: minutesAgo(60 * 20 - 2)
      },
      {
        id: uid('post'), user_id: others[2], type: 'lesson_idea', anonymous: false, isArticle: true,
        title: 'Мини-дебаты вместо устного опроса: как это изменило вовлечённость в 8 классе',
        body: 'Устный опрос по домашнему заданию редко работает так, как задумано: отвечают два-три человека, остальные пережидают. Я заменила его форматом мини-дебатов на 7 минут.\n\nМеханика простая: класс делится на пары, каждой паре достаётся спорный тезис по теме урока. У учеников есть минута на подготовку аргумента "за" или "против" — роли распределяются случайно, чтобы нельзя было заранее готовить только одну сторону. Затем 5 минут на сам раунд и короткую взаимную оценку.\n\nПервые две недели было непривычно — часть класса терялась без чёткого "правильного ответа". Но примерно с третьей недели я заметила, что ученики начали готовиться к урокам заранее, потому что никто не хочет "проиграть" в паре у всех на глазах. Это не соревнование ради соревнования: формат заставляет удерживать в голове оба взгляда на проблему, что для литературы и обществознания работает лучше, чем пересказ параграфа.\n\nЧто важно учесть: формат не подходит для тем, где нет пространства для интерпретации (например, формулы). И требует отдельного разговора о корректности аргументации — иначе часть пар уходит в эмоции вместо аргументов.',
        tags: ['Методика', 'Проектная работа'],
        status: 'approved', moderation_score: 'green', moderation_reason: null,
        created_at: minutesAgo(60 * 44), approved_at: minutesAgo(60 * 44 - 3), updated_at: minutesAgo(60 * 44 - 3)
      },
      {
        id: uid('post'), user_id: others[3], type: 'not_worked', anonymous: true,
        title: 'Система штрафных баллов за опоздания — не дала результата',
        body: 'Ввела систему штрафных баллов за опоздания на урок, думала, это дисциплинирует класс. По факту просто выросло напряжение и несколько конфликтов с родителями, опоздания не сократились. Сейчас пробую другой подход — разговор один на один в начале недели.',
        tags: ['Классное руководство', 'Родители'],
        status: 'approved', moderation_score: 'green', moderation_reason: null,
        created_at: minutesAgo(60 * 9), approved_at: minutesAgo(60 * 9 - 2), updated_at: minutesAgo(60 * 9 - 2)
      },
      {
        id: uid('post'), user_id: others[4], type: 'method_find', anonymous: false, isArticle: true,
        title: 'Диагностический тест перед контрольной: как за 5 дней понять, что повторять всем классом',
        body: 'Одна из самых затратных по времени частей подготовки к контрольной — урок повторения. Проблема в том, что без данных вы повторяете "всё подряд", а время на это обычно есть только одно.\n\nШаблон, который я использую уже два года: за 5 дней до контрольной ученики проходят короткий диагностический тест из 8 вопросов, построенный строго по структуре будущей контрольной — по одному-двум вопросам на каждую ключевую тему.\n\nПо итогам теста темы делятся на три группы: то, что не знает весь класс (выносится на фронтальное повторение), то, что не знают 3-5 человек (точечная работа в мини-группах, пока остальные делают самостоятельную практику), и то, что знают все (просто не трогаем). Это экономит до половины урока повторения — вместо повторения всего материала вы бьёте точно в пробелы.\n\nТехническая часть: тест можно собрать в любом бесплатном конструкторе форм с автоматической проверкой — важно, чтобы результаты были видны по каждому вопросу отдельно, а не только итоговым баллом, иначе диагностика не сработает.',
        tags: ['Оценивание', 'Цифровые инструменты'],
        status: 'approved', moderation_score: 'green', moderation_reason: null,
        created_at: minutesAgo(60 * 3), approved_at: minutesAgo(60 * 3 - 1), updated_at: minutesAgo(60 * 3 - 1)
      },
      {
        id: uid('post'), user_id: others[5], type: 'question', anonymous: false,
        title: 'Как коллеги относятся к использованию AI учениками при подготовке домашних заданий?',
        body: 'Все чаще вижу эссе, написанные явно с помощью нейросетей. Запрещать бессмысленно — ученики всё равно будут пользоваться. Как вы выстраиваете правила использования AI в своих классах, чтобы это помогало учиться, а не заменяло мышление?',
        tags: ['AI', 'Методика'],
        status: 'approved', moderation_score: 'green', moderation_reason: null,
        created_at: minutesAgo(20), approved_at: minutesAgo(18), updated_at: minutesAgo(18)
      }
    ];

    var replies = [
      {
        id: uid('rep'), post_id: posts[0].id, user_id: others[1], anonymous_alias: 2,
        similar_situation: 'yes', experience_text: 'У меня была похожая ситуация с 7 классом. Я попробовала разделить задания по уровням сложности. Сначала было непривычно, но через две недели вовлечённость стала выше.',
        result_type: 'worked', advice_text: 'Начните с одного предмета и одной темы, не пытайтесь перестроить сразу всё — так проще адаптировать систему под класс.',
        status: 'approved', moderation_score: 'green', moderation_reason: null,
        created_at: minutesAgo(118), approved_at: minutesAgo(117)
      },
      {
        id: uid('rep'), post_id: posts[0].id, user_id: others[2], anonymous_alias: 3,
        similar_situation: 'partial', experience_text: 'У меня не настолько выраженная потеря мотивации, но замечал похожее к концу четверти. Пробовал короткие проектные мини-задачи вместо стандартных уроков раз в неделю.',
        result_type: 'partial', advice_text: 'Важно не превращать это в награду только для сильных учеников — иначе эффект обратный.',
        status: 'approved', moderation_score: 'green', moderation_reason: null,
        created_at: minutesAgo(95), approved_at: minutesAgo(94)
      },
      {
        id: uid('rep'), post_id: posts[1].id, user_id: others[3], anonymous_alias: 2,
        similar_situation: 'yes', experience_text: 'В моей практике похожий подход сработал не сразу — пришлось объяснять ученикам, что выбор уровня не влияет на итоговую оценку негативно.',
        result_type: 'worked', advice_text: 'Проговорите правило оценивания заранее, иначе сильные ученики будут выбирать базовый уровень из страха ошибиться.',
        status: 'approved', moderation_score: 'green', moderation_reason: null,
        created_at: minutesAgo(60 * 18), approved_at: minutesAgo(60 * 18 - 1)
      }
    ];

    var reactions = [
      { id: uid('rx'), user_id: others[2], target_type: 'post', target_id: posts[0].id, reaction_type: 'useful', created_at: minutesAgo(100) },
      { id: uid('rx'), user_id: others[3], target_type: 'post', target_id: posts[0].id, reaction_type: 'useful', created_at: minutesAgo(90) },
      { id: uid('rx'), user_id: others[4], target_type: 'post', target_id: posts[0].id, reaction_type: 'support', created_at: minutesAgo(80) }
    ];

    return {
      me: me,
      role: 'user',
      users: {
        u_me: { display: 'Вы', status: null },
        u_1021: { display: 'Айгуль Нурлановна Сатпаева', status: 'Мастер урока' },
        u_8123: { display: 'Данияр Серикович Ахметов', status: 'Цифровой новатор' },
        u_3344: { display: 'Жанна Болатовна Исаева', status: 'Педагог-наставник' },
        u_5567: { display: 'Марат Ержанович Калиев', status: 'Активный участник' },
        u_7788: { display: 'Сауле Талгатовна Оспанова', status: 'Автор полезных кейсов' },
        u_9001: { display: 'Ерлан Абаевич Жумабеков', status: 'Экспертный автор' }
      },
      posts: posts,
      replies: replies,
      reactions: reactions,
      bookmarks: [],
      reports: [],
      moderationLogs: [],
      userStatus: {},
      notifications: [
        { id: uid('ntf'), user_id: 'u_me', text: 'Добро пожаловать в Beyim Community. Ваши публикации могут быть анонимными для сообщества.', read: true, created_at: minutesAgo(200) }
      ],
      aliases: {}
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (!raw) {
        var seeded = seedDb();
        localStorage.setItem(DB_KEY, JSON.stringify(seeded));
        return seeded;
      }
      return JSON.parse(raw);
    } catch (e) {
      var fresh = seedDb();
      localStorage.setItem(DB_KEY, JSON.stringify(fresh));
      return fresh;
    }
  }

  var db = load();

  function persist() {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  BC.db = db;
  BC.persist = persist;
  BC.uid = uid;
  BC.now = now;
  BC.POST_TYPES = POST_TYPES;
  BC.TAGS = TAGS;
  BC.postTypeLabel = function (id) {
    var t = POST_TYPES.filter(function (x) { return x.id === id; })[0];
    return t ? t.label : id;
  };
  BC.resetDb = function () {
    localStorage.removeItem(DB_KEY);
    location.reload();
  };
})();
