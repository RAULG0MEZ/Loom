function originAllowed(origin, env) {
  if (!origin) return false;
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = originAllowed(origin, env) ? origin : 'https://raulg0mez.github.io';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function jsonResponse(request, env, payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function validUid(uid) {
  return /^[a-f0-9]{32}$/i.test(String(uid || ''));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse(request, env, { ok: true });
    }

    if (request.method !== 'POST' || url.pathname !== '/delete') {
      return jsonResponse(request, env, { ok: false, error: 'Ruta no encontrada' }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(request, env, { ok: false, error: 'JSON inválido' }, 400);
    }

    const uid = String(body.uid || '').trim();
    const passcode = String(body.passcode || '');

    if (!validUid(uid)) {
      return jsonResponse(request, env, { ok: false, error: 'Video inválido' }, 400);
    }

    if (!env.DELETE_PASSCODE || passcode !== env.DELETE_PASSCODE) {
      return jsonResponse(request, env, { ok: false, error: 'Clave incorrecta' }, 401);
    }

    if (!env.CLOUDFLARE_STREAM_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
      return jsonResponse(request, env, { ok: false, error: 'Worker sin credenciales de Cloudflare' }, 500);
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`;
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_STREAM_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    let result = {};
    try {
      result = await response.json();
    } catch {
      result = { success: response.ok };
    }

    if (!response.ok || result.success === false) {
      const error = result.errors?.[0]?.message || result.messages?.[0]?.message || 'Cloudflare no pudo borrar el video';
      return jsonResponse(request, env, { ok: false, error }, response.status || 500);
    }

    return jsonResponse(request, env, { ok: true, uid });
  }
};
