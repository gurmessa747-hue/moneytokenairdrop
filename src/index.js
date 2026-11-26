export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/referral") return handleReferral(request, env);
    if (url.pathname === "/withdraw") return handleWithdraw(request, env);
    return env.ASSETS.fetch(request);
  }
};

async function read(env, key) {
  const raw = await env.REFERRALS.get(key);
  return raw ? JSON.parse(raw) : null;
}
async function write(env, key, value) {
  await env.REFERRALS.put(key, JSON.stringify(value));
}
function userFrom(initData) {
  try { return JSON.parse(new URLSearchParams(initData || "").get("user") || "{}"); }
  catch { return {}; }
}

async function handleReferral(request, env) {
  if (request.method === "GET") {
    const id = new URL(request.url).searchParams.get("id");
    const row = id ? await read(env, "ref:" + id) : null;
    return Response.json({ friends: (row && row.friends) || [] });
  }

  const body = await request.json();
  const user = userFrom(body.initData);
  const id = String(user.id || "");
  if (!id) return Response.json({ ok: false }, { status: 401 });

  if (body.action === "join" && body.inviter && body.inviter !== id) {
    const owner = (await read(env, "ref:" + body.inviter)) || { friends: [] };
    if (!owner.friends.some(f => f.id === id)) {
      owner.friends.unshift({ id, name: user.first_name || "Miner", qualified: false, paid: false });
      await write(env, "ref:" + body.inviter, owner);
    }
    await write(env, "link:" + id, body.inviter);
    return Response.json({ ok: true });
  }

  if (body.action === "qualify") {
    const link = await read(env, "link:" + id);
    if (!link) return Response.json({ ok: true });
    const owner = (await read(env, "ref:" + link)) || { friends: [] };
    const friend = owner.friends.find(f => f.id === id);
    if (friend && !friend.qualified) {
      friend.qualified = true;
      await write(env, "ref:" + link, owner);
    }
    return Response.json({ ok: true });
  }

  if (body.action === "claim") {
    const owner = (await read(env, "ref:" + id)) || { friends: [] };
    const unpaid = owner.friends.filter(f => f.qualified && !f.paid);
    unpaid.forEach(f => f.paid = true);
    if (unpaid.length) await write(env, "ref:" + id, owner);
    return Response.json({ ok: true, paid: unpaid.length, friends: owner.friends });
  }

  return Response.json({ ok: false }, { status: 400 });
}

async function handleWithdraw(request, env) {
  return Response.json({ ok: true, items: [] });
  }
