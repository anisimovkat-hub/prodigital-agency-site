exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  try {
    const TELEGRAM_BOT_TOKEN = '8511475134:AAFqi6EhRS9O51Fi7Ej_ClosY7gxV-P2I5Y';
    const TELEGRAM_CHAT_ID = '-5235848466';
    const data = JSON.parse(event.body || '{}');

    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const line = (label, value) => value ? `<b>${esc(label)}:</b> ${esc(value)}` : '';

    const message = [
      '<b>Новая заявка с сайта ProDigital</b>',
      line('Форма', data.form_name || 'project-brief'),
      line('Источник', data.source),
      line('Страница', data.page),
      line('URL', data.page_url),
      '',
      line('Имя', data.name),
      line('Телефон', data.phone),
      line('Telegram', data.telegram),
      line('Сайт', data.website),
      line('Соцсети', data.socials),
      line('Запускали рекламу', data.ad_history),
      line('Что уже пробовали', data.channels),
      '',
      line('Продукт / услуга', data.product),
      line('Результаты', data.results),
      line('Цели / проблемы', data.goals),
      line('Дополнительно', data.extra)
    ].filter(Boolean).join('\n');

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ok: false, error: result })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: String(error) })
    };
  }
};