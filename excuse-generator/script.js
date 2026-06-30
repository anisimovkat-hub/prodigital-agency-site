const EXCUSES = [
  "Будильник прозвенел, я его выключил рукой мудрости, а не разума.",
  "Стоял в пробке такой плотности, что в ней уже образовалась своя экосистема.",
  "Соседский кот устроил забастовку прямо у моей двери — пришлось вести переговоры.",
  "Лифт застрял между этажами вместе со мной и моим чувством пунктуальности.",
  "Автобус уехал ровно за три секунды до того, как я до него добежал.",
  "Искал второй носок 20 минут. Это была личная драма уровня детектива.",
  "У телефона за ночь сел заряд, а вместе с ним и будильник.",
  "Заблокировал свою же машину собственной машиной — долгая история.",
  "Курьер привёз посылку именно в тот момент, когда я выходил из дома.",
  "Пролил кофе на единственную чистую рубашку и провёл экстренную смену образа.",
  "Ключи решили поиграть в прятки именно сегодня.",
  "Зашёл утром в новости на одну минуту — очнулся через сорок.",
  "Сделал шаг назад, чтобы оценить выходной образ, и понял, что время тоже сделало шаг назад.",
  "Дорогу перекрыли из-за съёмок фильма, в котором я, к сожалению, не снимался.",
  "Маршрутка решила сделать незапланированную остановку у каждого столба.",
  "Навигатор повёл меня живописным путём через три соседних города.",
  "У подъезда образовалась очередь из одного человека, и этим человеком был я, забывший пропуск.",
  "Зарядка от телефона осталась дома, а вместе с ней и желание спешить без связи с миром.",
  "Внезапно вспомнил, что не выключил утюг, и вернулся для очной ставки с розеткой.",
  "Поезд метро объявили технический перерыв ровно на платформе, где стоял я.",
  "Голубь сидел на капоте машины и явно не планировал уступать дорогу.",
  "Зашёл в лифт с соседом, разговорились про ремонт, вышел этажом позже нужного.",
  "Погода решила, что сегодня отличный день для ливня именно в момент моего выхода.",
  "Доставка еды перепутала адрес, и мне пришлось лично восстанавливать справедливость.",
  "Уронил телефон в процессе завязывания шнурков — спасательная операция заняла время.",
  "Будильник прозвенел голосом кота из интернета, и я десять минут искал источник звука.",
  "Зашёл проверить почту на работе из дома и не заметил, как стал работать из дома.",
  "Соседи проводили внеплановую репетицию оркестра, было невозможно уйти, не дослушав.",
  "Решил, что сегодня отличный день для нового рекорда по медленному завтраку.",
  "Парковка оказалась занята целым свадебным кортежем — пришлось ждать, пока распишутся."
];

const excuseBox = document.getElementById("excuseBox");
const excuseText = document.getElementById("excuseText");
const generateBtn = document.getElementById("generateBtn");
const copyBtn = document.getElementById("copyBtn");
const metaRow = document.getElementById("metaRow");
const believabilityEl = document.getElementById("believability");
const genCountEl = document.getElementById("genCount");
const toast = document.getElementById("toast");
const lateNumberEl = document.getElementById("lateNumber");

let pool = [];
let genCount = 0;
let currentExcuse = "";

function refillPool() {
  pool = [...EXCUSES];
}

function nextExcuse() {
  if (pool.length === 0) refillPool();
  const i = Math.floor(Math.random() * pool.length);
  return pool.splice(i, 1)[0];
}

function generate() {
  currentExcuse = nextExcuse();
  genCount += 1;

  excuseText.textContent = currentExcuse;
  excuseBox.classList.add("filled");
  excuseBox.classList.remove("shake");
  void excuseBox.offsetWidth;
  excuseBox.classList.add("shake");

  const believability = 62 + Math.floor(Math.random() * 35);
  believabilityEl.textContent = `Правдоподобность: ${believability}%`;
  genCountEl.textContent = `Сгенерировано: ${genCount}`;
  metaRow.hidden = false;
  copyBtn.hidden = false;
}

generateBtn.addEventListener("click", generate);

copyBtn.addEventListener("click", async () => {
  if (!currentExcuse) return;
  try {
    await navigator.clipboard.writeText(currentExcuse);
    showToast("Скопировано!");
  } catch (e) {
    showToast("Не удалось скопировать");
  }
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 1800);
}

lateNumberEl.textContent = (140000 + Math.floor(Math.random() * 9000)).toLocaleString("ru-RU");
