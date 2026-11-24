// 网站后台接口（Cloudflare Pages），数据存在 KV，绑定名 CAPTIONS
//
// 一、视频字幕 /api/cap
//   GET    ?list=1   → { ok, items:[{v,title,author,n,tr,dur,at}] }
//   GET    ?v=<ID>   → { ok, v, title, author, cues:[{s,e,t,r}] }
//   POST             → 写入
//   DELETE ?v=<ID>   → 删除
//
// 二、生词本 /api/vocab（整份存在 KV 的 "vocab" 这一条里）
//   GET              → { ok, custom, progress, deleted, pending }
//   GET  ?history=1  → { ok, days:[日期…] }   后台存档（每天第一次改动前存一份，保留 30 天）
//   GET  ?at=日期     → 那天的存档
//   POST {state}     → 和云端合并后保存，返回合并结果 { ok, state }
//   POST {add:[词条]} → 加入完整词条：从待整理队列和已删除列表里移除同名词（插件用）
//   POST {patch:{srs,progress,deleted}} → 只改复习进度、掌握状态、删除词条（插件用，返回 { ok, changed }）
//   POST {replace:{…}} → 整份覆盖（还原用：内容取自存档或仓库里的 data/vocab.json）
// 不设口令：谁都能写，被乱改时用存档或仓库备份还原（GitHub Actions 每 6 小时把生词本存进仓库 data/vocab.json）
//
// 三、插件数据 /api/ext（整份存在 KV 的 "ext" 这一条里）：已保存的词和句子、颜色标记、标签、配图选择、插件设置，以及录音截图的索引
//   每一项是 "种类|名字" → { v 内容, at 改动时间 } 或 { del:1, at }（删除记号，保留 120 天）；同一项以 at 新的为准，多台设备各改各的也能合并
//   GET              → { ok, ver, items }（只返回没删的）
//   GET  ?history=1 / ?at=日期 → 和生词本一样的每日存档（30 天）
//   POST {changes:{项:{v,at}|{del:1,at}}} → 合并后返回 { ok, ver, items }；"med|…" 项被删除时，对应的录音截图也一起删
//
// 四、录音和截图 /api/media（每条一个 KV 记录 "m:" + 插件里的键，如 m:med:w:apple；内容 { aud, img, img2, t, tr, v, s, at… }）
//   GET  ?k=med:w:apple → { ok, rec }
//   POST {k, rec}       → 保存一条（单条最大 8MB）
//
// 六、家人（多用户）/api/users：不设密码，只是把各人的数据分开
//   GET                         → { ok, users:[{id, name}] }，第一个 id 为 "" 的是原来的主人（数据就是上面那些原样的 KV 记录）
//   POST {add:"名字"}            → 新建一个用户，返回 { ok, user:{id, name}, users }
//   POST {rename:{id, name}}    → 改名字
//   POST {remove:id}            → 删掉一个家人：只有他的生词本和插件数据都是空的才删（加错了名字用），有内容的拒绝（409）
//   其它接口带 ?u=<id> 就读写这个人的数据：生词本、插件数据、录音截图、每日存档的 KV 键前面加 "u/<id>/"（如 u/u2/vocab、u/u2/m:med:w:apple）；
//   不带 u（或 u 为空）就是主人。视频字幕 /api/cap、例句 /api/sent 大家共用。不认识的 u 返回 404，免得打错字写到一份没人看的数据里。
//   学习语言：上面这些再带 &lang=de 就是这个人的德语那一份（键再加 "l/de/"，如 u/u2/l/de/vocab）；英语不带 lang，和以前一样。不支持的语言也返回 404
//
// 五、例句 /api/sent?w=单词（网站「🔊 练习」用：像 PhrasePump 一样每次换几句例句听）
//   → { ok, w, items:[{en, zh}] }，来自 Tatoeba 例句库（只要 14 个词以内、带中文翻译、确实包含这个词的），在 KV 里缓存 30 天（"s/单词"）
//   GET ?pump=数量 → 随机的额外句子（5–12 个词、带中文），练习名额没用完时补满（同 PhrasePump 的「pump」），不缓存
// 七、查词 /api/dict、抓文章 /api/readurl、今日新闻 /api/news、每日听力 /api/sme、AI 写作评分 /api/ai、语音转文字 /api/stt、AI 语音 /api/tts：见各自函数上面的说明
//   生词本回收站：GET /api/vocab?trash=1 → { items:[{e 词条, at 删除时间}] }（30 天，按人分开）；POST {untrash:id} 从回收站拿掉
const API_PATHS = ["/api/cap"], VOCAB_PATH = "/api/vocab", VOCAB_KEY = "vocab", EXT_PATH = "/api/ext", EXT_KEY = "ext", MEDIA_PATH = "/api/media", SENT_PATH = "/api/sent";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type,x-key", "access-control-allow-methods": "GET,POST,DELETE,OPTIONS" } });
const okId = v => /^[\w-]{11}$/.test(v || "");
// 缓存类写入：KV 当天写入额度（1000 次）用完时 put 会抛错，缓存存不进去不该让这次请求失败（AI / Whisper 已经花了额度）
const cput = (kv, k, v, o) => kv.put(k, v, o).catch(() => {});
// 设备发上来的改动时间不能比服务器现在还晚（时钟快的设备会永远赢、项目被「冻住」）；已存的未来时间也按现在算
const atOk = t => Math.min(+t || 0, Date.now() + 5000);
// ?fresh=1（跳过缓存重新抓）只给带对口令的人用（还没设口令时谁都能用），免得被人用 GET 刷光 KV 写入额度
const freshOf = async (req, u, kv) => !!u.searchParams.get("fresh") && (!kv || (await authOf(req, kv)) !== "bad");
// ---------- 家人（多用户） ----------
const USERS_KEY = "users", DEF_USERS = [{ id: "", name: "Ray" }];
let usersMem = null, usersAt = 0;
async function usersList(kv, fresh) {
  if (!fresh && usersMem && Date.now() - usersAt < 30000) return usersMem;
  const d = await kv.get(USERS_KEY, "json"); usersMem = Array.isArray(d) && d.length ? d : DEF_USERS; usersAt = Date.now(); return usersMem;
}
// 这次请求是谁、学哪种语言：?u=<id>&lang=<语言>；返回 KV 键前缀（主人学英语是 ""），不认识的人 / 不支持的语言返回 null
//   语言：英语不带参数（和以前一样，不用迁移）；其它语言在人的前缀后面再加 "l/<语言>/"，如 u/u2/l/de/vocab、l/de/mine:err
const LANG_OK = /^(en|de)$/;
async function userPre(req, kv) {
  const q = new URL(req.url).searchParams, id = q.get("u") || "", lg = q.get("lang") || "";
  if (lg && !LANG_OK.test(lg)) return null;
  const lp = lg && lg !== "en" ? "l/" + lg + "/" : "";
  if (!id) return lp;
  if (!/^[a-z0-9]{1,12}$/.test(id)) return null;
  let L = await usersList(kv); if (!L.some(x => x.id === id)) L = await usersList(kv, true);
  return L.some(x => x.id === id) ? "u/" + id + "/" + lp : null;
}
const noUser = () => json({ ok: false, error: "unknown user" }, 404);

// ---------- 写入保护（口令）/api/auth ----------
// 平时的同步、加词、练习、插件上传都不用口令；只有「大改动」要：整份还原（replace）、删视频字幕、改名 / 删家人，
//   以及一次删很多条（生词本 > 20 条、插件数据 > 30 项、个人资料 > 30 项）、一次改写很多已有词条（> 60 条），
//   或者当天不带口令的删除 / 改写累计超过上限（生词本删 40 条、改写 150 条；插件数据删 80 项）。
// 口令只存加盐的 SHA-256（KV「auth」= {salt, h, at}）；网页存在本机 localStorage「auth:key」，每个请求带请求头 x-key。
// 还没设口令时一切照旧（谁都能写），网站上会提示去设；忘了口令：Cloudflare 后台 → KV → CAPTIONS 删掉「auth」这一条，再在网站上重新设。
//   GET  /api/auth                → { ok, set 设过没有, valid 这次带的口令对不对 }
//   POST /api/auth {set:"新口令"} → 还没设过：直接设；已经设过：要带对的 x-key（= 改口令）。口令至少 8 位。
const AUTH_KEY = "auth";
let authMem = null, authAt = 0, authFail = 0, authFailAt = 0;
async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
async function authDoc(kv, fresh) { if (!fresh && authMem !== null && Date.now() - authAt < 30000) return authMem; authMem = (await kv.get(AUTH_KEY, "json")) || false; authAt = Date.now(); return authMem; }
// → "none" 没设口令 | "ok" 口令对 | "bad" 没带或不对
async function authOf(req, kv) {
  const d = await authDoc(kv); if (!d || !d.h) return "none";
  const k = req.headers.get("x-key") || ""; if (!k) return "bad";
  if (authFail > 20 && Date.now() - authFailAt < 60000) return "bad"; // 同一台机房一分钟内错太多次：先一律当错（防猜）
  if ((await sha(d.salt + "|" + k)) === d.h) return "ok";
  authFail = Date.now() - authFailAt < 60000 ? authFail + 1 : 1; authFailAt = Date.now(); return "bad";
}
const needKey = why => json({ ok: false, error: "needkey", why }, 403);
// 当天不带口令的删除 / 改写累计（KV「guard:<人>:<日期>」，只在真的有删除、改写时才写一次）
async function guardDay(kv, who, add, lim) {
  const k = "guard:" + who + ":" + bjDay(), cur = (await kv.get(k, "json")) || {};
  for (const f in add) if ((+cur[f] || 0) + add[f] > lim[f]) return false;
  if (Object.values(add).some(v => v > 0)) { for (const f in add) cur[f] = (+cur[f] || 0) + add[f]; await kv.put(k, JSON.stringify(cur), { expirationTtl: 3 * 86400 }); }
  return true;
}
async function auth(req, env) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const kv = env.CAPTIONS; if (!kv) return json({ ok: false, error: "KV binding CAPTIONS is missing" }, 500);
  try {
    if (req.method === "GET") { const d = await authDoc(kv, true), a = await authOf(req, kv); return json({ ok: true, set: !!(d && d.h), valid: a === "ok" }); }
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
    const b = JSON.parse((await req.text()) || "{}"), nk = String(b.set || "");
    if (nk.length < 8 || nk.length > 200) return json({ ok: false, error: "口令至少 8 位" }, 400);
    const d = await authDoc(kv, true); if (d && d.h && (await authOf(req, kv)) !== "ok") return needKey("change");
    const salt = crypto.getRandomValues(new Uint8Array(16)).reduce((s, x) => s + x.toString(16).padStart(2, "0"), "");
    const doc = { salt, h: await sha(salt + "|" + nk), at: Date.now() }; await kv.put(AUTH_KEY, JSON.stringify(doc)); authMem = doc; authAt = Date.now();
    return json({ ok: true, set: true });
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}
async function users(req, env) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const kv = env.CAPTIONS; if (!kv) return json({ ok: false, error: "KV binding CAPTIONS is missing" }, 500);
  try {
    const L = (await usersList(kv, true)).map(x => Object.assign({}, x));
    if (req.method === "GET") return json({ ok: true, users: L });
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
    const b = JSON.parse((await req.text()) || "{}"), nm = v => String(v == null ? "" : v).replace(/[<>"&]/g, "").trim().slice(0, 20);
    if (typeof b.add === "string") {
      const name = nm(b.add); if (!name) return json({ ok: false, error: "name" }, 400);
      if (L.some(x => x.name === name)) return json({ ok: false, error: "这个名字已经有了" }, 409);
      if (L.length >= 20) return json({ ok: false, error: "too many" }, 400);
      let n = 2; while (L.some(x => x.id === "u" + n) || (await kv.list({ prefix: "u/u" + n + "/", limit: 1 })).keys.length) n++; // 删掉的人留下的数据还在（KV 列表有延迟）：编号不重复用
      const user = { id: "u" + n, name }; L.push(user);
      await kv.put(USERS_KEY, JSON.stringify(L)); usersMem = L; usersAt = Date.now();
      return json({ ok: true, user, users: L });
    }
    if ((isObj(b.rename) || b.remove) && (await authOf(req, kv)) === "bad") return needKey("users");
    if (isObj(b.rename)) {
      const x = L.find(y => y.id === String(b.rename.id || "")), name = nm(b.rename.name);
      if (!x || !name) return json({ ok: false, error: "bad body" }, 400);
      if (L.some(y => y !== x && y.name === name)) return json({ ok: false, error: "这个名字已经有了" }, 409);
      x.name = name; await kv.put(USERS_KEY, JSON.stringify(L)); usersMem = L; usersAt = Date.now();
      return json({ ok: true, users: L });
    }
    if (typeof b.remove === "string" && b.remove) {
      const x = L.find(y => y.id === b.remove); if (!x) return json({ ok: false, error: "not found" }, 404);
      const pre = "u/" + x.id + "/";
      for (const lp of ["", "l/de/"]) { // 每种学习语言都要是空的
        const v = vnorm(await kv.get(pre + lp + VOCAB_KEY, "json")), e = await kv.get(pre + lp + EXT_KEY, "json");
        if (v.custom.length || v.pending.length || Object.keys(v.srs || {}).length || Object.keys(live((e && e.items) || {})).filter(k => !k.startsWith("set|")).length) return json({ ok: false, error: "这个人已经有生词或保存的内容，不能删" }, 409);
        for (const mk of MINE_LIST) { const m = await kv.get(pre + lp + "mine:" + mk, "json"); if (m && Object.values(m.items || {}).some(x => x && !x.del)) return json({ ok: false, error: "这个人已经有错题本、阅读或练习记录，不能删" }, 409); }
      }
      const left = L.filter(y => y !== x); await kv.put(USERS_KEY, JSON.stringify(left)); usersMem = left; usersAt = Date.now();
      let cur; do { const r = await kv.list({ prefix: pre, cursor: cur }); for (const k of r.keys) await kv.delete(k.name); cur = r.list_complete ? null : r.cursor; } while (cur);
      return json({ ok: true, users: left });
    }
    return json({ ok: false, error: "bad body" }, 400);
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}
// 列表信息放在每条记录的 metadata 里（上限 1024 字节，所以这里把标题、作者截短；完整标题在记录正文里）
const meta = d => { const last = d.cues[d.cues.length - 1]; return { title: [...d.title].slice(0, 100).join(""), author: [...d.author].slice(0, 50).join(""), lang: String(d.lang || "en").slice(0, 8), n: d.cues.length, tr: d.cues.filter(c => c.r).length, dur: Math.round(last.e || last.s), at: d.at }; };
const clean = (b, at) => ({ v: b.v, title: String(b.title || "").slice(0, 300), author: String(b.author || "").slice(0, 120), lang: String(b.lang || "en").slice(0, 12), tl: String(b.tl || "").slice(0, 12), at: at || Date.now(), cues: b.cues.slice(0, 6000).map(c => ({ s: +c.s || 0, e: +c.e || 0, t: String(c.t || "").slice(0, 600), r: String(c.r || "").slice(0, 600) })).filter(c => c.t) });
const put = (kv, d) => kv.put("v/" + d.v, JSON.stringify(d), { metadata: meta(d) });
async function listAll(kv) {
  const out = []; let cursor;
  do { const r = await kv.list({ prefix: "v/", cursor }); for (const k of r.keys) out.push(Object.assign({ v: k.name.slice(2) }, k.metadata || {})); cursor = r.list_complete ? null : r.cursor; } while (cursor);
  return out.sort((a, b) => (b.at || 0) - (a.at || 0));
}

async function cap(req, env, u) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const kv = env.CAPTIONS;
  if (!kv) return json({ ok: false, error: "KV binding CAPTIONS is missing" }, 500);
  try {
    if (req.method === "GET") {
      if (u.searchParams.get("list")) return json({ ok: true, items: (await listAll(kv)).slice(0, 300) });
      const v = u.searchParams.get("v"); if (!okId(v)) return json({ ok: false, error: "bad id" }, 400);
      const d = await kv.get("v/" + v, "json");
      return d ? json(Object.assign({ ok: true }, d)) : json({ ok: false, error: "not found" }, 404);
    }
    if (req.method === "DELETE") {
      const v = u.searchParams.get("v"); if (!okId(v)) return json({ ok: false, error: "bad id" }, 400);
      if ((await authOf(req, kv)) === "bad") return needKey("cap");
      await kv.delete("v/" + v);
      return json({ ok: true });
    }
    if (req.method === "POST") {
      const raw = await req.text(); if (raw.length > 2000000) return json({ ok: false, error: "too large" }, 413);
      const b = JSON.parse(raw); if (!okId(b.v) || !Array.isArray(b.cues) || !b.cues.length) return json({ ok: false, error: "bad body" }, 400);
      const doc = clean(b); if (!doc.cues.length) return json({ ok: false, error: "bad body" }, 400);
      const old = kv.getWithMetadata ? await kv.getWithMetadata("v/" + doc.v) : null, on = (old && old.metadata && +old.metadata.n) || 0;
      if (on >= 20 && doc.cues.length < on * 0.5 && (await authOf(req, kv)) === "bad") return needKey("cap"); // 用少得多的字幕盖掉已有的 = 变相删除：要口令
      await put(kv, doc);
      return json({ ok: true, n: doc.cues.length });
    }
    return json({ ok: false, error: "method" }, 405);
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}

// ---------- 生词本 ----------
const vdef = () => ({ custom: [], progress: {}, deleted: [], pending: [], srs: {}, progAt: {}, pendAdd: {}, pendDel: {} });
const isObj = x => x && typeof x === "object" && !Array.isArray(x);
// progAt = 掌握状态的修改时间 { 词条id: 毫秒 }；pendAdd / pendDel = 待整理队列里每个词最近一次加入 / 拿掉的时间 { 小写词: 毫秒 }（「清空」才不会被别的设备的旧缓存并回来）
const vnorm = s => ({ custom: Array.isArray(s && s.custom) ? s.custom : [], progress: isObj(s && s.progress) ? s.progress : {}, deleted: Array.isArray(s && s.deleted) ? s.deleted : [], pending: Array.isArray(s && s.pending) ? s.pending : [], srs: isObj(s && s.srs) ? s.srs : {},
  progAt: isObj(s && s.progAt) ? s.progAt : {}, pendAdd: isObj(s && s.pendAdd) ? s.pendAdd : {}, pendDel: isObj(s && s.pendDel) ? s.pendDel : {} });
const tmax = (a, b) => { const o = Object.assign({}, a), cut = Date.now() - 90 * 86400e3; for (const k in b) if (atOk(b[k]) > (+o[k] || 0)) o[k] = atOk(b[k]); for (const k in o) if (!(+o[k] > cut)) delete o[k]; return o; }; // 每个键取较新的时间；90 天前的丢掉
const pendKeep = (w, add, del) => { const k = (w + "").toLowerCase(); return !del[k] || (+add[k] || 0) > del[k]; };
// 复习进度（网站「🔊 练习」和插件复习页共用）：{ 词条id: { b 级别, n 次数, due 下次复习时间, at 最近练习时间 } }；同一个词以 at 新的为准
function srsMerge(a, b) { const o = Object.assign({}, a); for (const k in b) { const x = b[k]; if (!isObj(x)) continue; if (+x.at > Date.now() + 5000) x.at = Date.now(); if (!o[k] || (+x.at || 0) >= atOk(o[k].at)) o[k] = x; } return o; }
// 2026-11-20 在线上测试「🔊 练习」时误写进生词本的 3 条复习记录（按精确的 at 认）：任何设备再推上来都不收，possessions 跟着带上来的「已掌握」也不收
const POISON = { v_possessions: 1795107503971, v_motion: 1795106191839, v_guys: 1795104545153 };
function unpoison(st) {
  if (!isObj(st)) return st; let hit = false;
  if (isObj(st.srs)) for (const k in POISON) if (st.srs[k] && +st.srs[k].at === POISON[k]) { delete st.srs[k]; hit = true; }
  if (hit && isObj(st.progress) && st.progress.v_possessions === "known") delete st.progress.v_possessions;
  return st;
}
// 和网页里的 mergeState 一样：两份取并集；同一个 id 以 b 为准（除非 a 的修改时间 u 更新）；删除会传播
function vmerge(a, b) {
  const bNew = isObj(b && b.progAt), bPend = isObj(b && b.pendDel) || isObj(b && b.pendAdd); // 新版网页才带时间；旧版照旧（推上来的赢、队列取并集）
  a = vnorm(a); b = vnorm(b);
  const byId = {};
  a.custom.forEach(e => { if (e && e.id) byId[e.id] = e; });
  b.custom.forEach(e => { if (e && e.id && !((+(byId[e.id] || {}).u || 0) > (+e.u || 0))) byId[e.id] = e; }); // 词条带修改时间 u（改过内容的）：以新的为准，免得别的设备的旧缓存盖回去
  const deleted = Array.from(new Set([...a.deleted, ...b.deleted]));
  const del = new Set(deleted);
  const custom = Object.values(byId).filter(e => !del.has(e.id));
  // 掌握状态：两边都有时间就按新的为准（插件里标的「已掌握」不会被别的标签页的旧缓存改回去）；没时间的按以前的规矩
  const progress = {}, progAt = tmax(a.progAt, bNew ? b.progAt : {});
  if (!bNew) Object.assign(progress, a.progress, b.progress);
  else for (const k of new Set([...Object.keys(a.progress), ...Object.keys(b.progress)])) {
    const ta = atOk(a.progAt[k]), tb = atOk(b.progAt[k]), w = ta > tb ? a : tb > ta ? b : (k in b.progress ? b : a);
    if (k in w.progress) progress[k] = w.progress[k];
  }
  const pendAdd = tmax(a.pendAdd, bPend ? b.pendAdd : {}), pendDel = tmax(a.pendDel, bPend ? b.pendDel : {});
  const pend = {}; [...a.pending, ...b.pending].forEach(w => { if (w && pendKeep(w, pendAdd, pendDel)) pend[(w + "").toLowerCase()] = w; });
  return { custom, progress, deleted, pending: Object.values(pend), srs: srsMerge(a.srs, b.srs), progAt, pendAdd, pendDel };
}
// 和插件原来的 cloudAdd 一样：同名词已存在就跳过；加入时从待整理队列里去掉
// 删过的词再加回来：换一个新 id（删除记录只增不减，别的设备缓存里还有旧 id 的删除记录，用旧 id 会被它再删一次）
function vadd(d, entries) {
  d = vnorm(d); let n = 0; const del = new Set(d.deleted), ids = [];
  for (const e of entries) {
    if (!e || !e.id || !e.word) continue;
    const lw = String(e.word).toLowerCase();
    d.pending = d.pending.filter(w => (w + "").toLowerCase() !== lw);
    if (d.custom.some(x => x && (x.id === e.id || (x.word || "").toLowerCase() === lw))) continue;
    if (del.has(e.id)) { const old = e.id; e.id = String(old).slice(0, 80) + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); ids.push([old, e.id]); }
    d.custom.push(e); n++;
  }
  return { d, n, ids };
}
async function vocab(req, env) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const kv = env.CAPTIONS;
  if (!kv) return json({ ok: false, error: "KV binding CAPTIONS is missing" }, 500);
  try {
    const pre = await userPre(req, kv); if (pre === null) return noUser();
    const VK = pre + VOCAB_KEY; // 这个人的生词本（主人就是 "vocab"）
    const stored = vnorm(await kv.get(VK, "json")), before = JSON.stringify(stored); // 先记下原样：合并函数会就地改数组
    if (req.method === "GET") {
      const q = new URL(req.url).searchParams;
      if (q.get("trash")) { const now = Date.now(); return json({ ok: true, items: ((await kv.get(VK + ":trash", "json")) || []).filter(t => t && t.e && now - t.at < 30 * 86400e3) }); } // 回收站
      if (q.get("history")) { const l = await kv.list({ prefix: VK + "@" }); return json({ ok: true, days: l.keys.map(k => k.name.slice(VK.length + 1)).sort().reverse() }); }
      const at = q.get("at");
      if (at) { if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return json({ ok: false, error: "bad date" }, 400); const d = await kv.get(VK + "@" + at, "json"); return d ? json(Object.assign({ ok: true, at }, vnorm(d))) : json({ ok: false, error: "not found" }, 404); }
      return json(Object.assign({ ok: true }, stored));
    }
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
    const raw = await req.text(); if (raw.length > 5000000) return json({ ok: false, error: "too large" }, 413);
    const b = JSON.parse(raw || "{}");
    let next, added = 0;
    if (typeof b.untrash === "string") { const tk = VK + ":trash", L = ((await kv.get(tk, "json")) || []).filter(t => t && t.e && t.e.id !== b.untrash); await kv.put(tk, JSON.stringify(L)); return json({ ok: true, items: L }); } // 恢复后从回收站拿掉（恢复本身由网页用新 id 加回去：删除记录只增不减）
    let ids = [];
    if (Array.isArray(b.add)) { const r = vadd(stored, b.add.slice(0, 2000)); next = r.d; added = r.n; ids = r.ids; }
    else if (b.state && typeof b.state === "object") {
      // 旧版网页（词条写死在页面里）会把搬进来的词当成重复草稿删掉，所以只接受新版网页（v:2）的整份同步
      if (b.v !== 2) return json({ ok: false, error: "page outdated, please reload" }, 409);
      next = vmerge(stored, unpoison(b.state));
    }
    else if (b.replace && typeof b.replace === "object") next = vnorm(b.replace);
    else if (isObj(b.patch)) { // 只改复习进度 / 掌握状态（插件每练一张卡发一次，不用传整本生词本）
      unpoison(b.patch);
      if (isObj(b.patch.progress) && b.patch.progress.v_possessions === "known" && Date.now() < Date.UTC(2026, 11, 1) && !(stored.srs.v_possessions && (stored.srs.v_possessions.s >= 42 || stored.srs.v_possessions.h >= 42)) && !(isObj(b.patch.srs) && b.patch.srs.v_possessions && (b.patch.srs.v_possessions.s >= 42 || b.patch.srs.v_possessions.h >= 42))) delete b.patch.progress.v_possessions; // 插件里测试时误标的「已知」写回来的：12 月前不收（真练到已掌握会带着稳定度 ≥ 42）
      next = vnorm(JSON.parse(before)); next.srs = srsMerge(next.srs, isObj(b.patch.srs) ? b.patch.srs : {});
      if (isObj(b.patch.progress)) for (const k in b.patch.progress) { const v = b.patch.progress[k]; if ((v === "known" || v === "learning") && next.progress[k] !== v) { next.progress[k] = v; next.progAt[k] = Date.now(); } }
      if (Array.isArray(b.patch.deleted) && b.patch.deleted.length) { const del = new Set(next.deleted.concat(b.patch.deleted.filter(x => typeof x === "string").slice(0, 500))); next.deleted = [...del]; next.custom = next.custom.filter(e => !del.has(e.id)); } // 插件「已保存」页里删除生词本词条
    }
    else return json({ ok: false, error: "bad body" }, 400);
    const changed = JSON.stringify(next) !== before;
    if (changed) {
      // 写入保护：整份还原、一次删 / 改很多条、当天累计太多 → 要口令（见上面 /api/auth）
      const A = await authOf(req, kv);
      if (A === "bad") {
        if (b.replace) return needKey("replace");
        // 插件、书签带不了口令，所以只有真的删 / 改写已有词条时才数（patch 只会删，不会改写内容）
        const old = Array.isArray(b.add) || isObj(b.patch) ? null : JSON.parse(before).custom, nx = new Set(next.custom.map(e => e && e.id));
        let rm = 0, rw = 0;
        if (!old) rm = Math.max(0, JSON.parse(before).custom.filter(e => e && e.id && !nx.has(e.id)).length);
        else { const by = new Map(next.custom.filter(e => e && e.id).map(e => [e.id, e])); for (const e of old) { if (!e || !e.id) continue; const y = by.get(e.id); if (!y) rm++; else if (JSON.stringify(y) !== JSON.stringify(e)) rw++; } }
        if (rm > 20 || rw > 60) return needKey("big");
        if ((rm || rw) && !(await guardDay(kv, pre + "vocab", { rm, rw }, { rm: 40, rw: 150 }))) return needKey("day");
      }
      // 回收站：这次被删掉的词条整条存进 VK + ":trash"（30 天内能在网站上恢复）
      const gone = new Set(next.deleted), had = JSON.parse(before).custom.filter(e => e && e.id && gone.has(e.id) && !next.custom.some(x => x && x.id === e.id));
      if (had.length) { const tk = VK + ":trash", now = Date.now(), old = ((await kv.get(tk, "json")) || []).filter(t => t && t.e && now - t.at < 30 * 86400e3 && !had.some(e => e.id === t.e.id)); await kv.put(tk, JSON.stringify(had.map(e => ({ e, at: now })).concat(old).slice(0, 500))); }
      const day = VK + "@" + new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // 北京时间的日期
      if (!(await kv.get(day))) await kv.put(day, before, { expirationTtl: 30 * 86400 }); // 当天第一次改动前，存一份改动前的样子
      await kv.put(VK, JSON.stringify(next));
    }
    return json(isObj(b.patch) ? { ok: true, changed } : Object.assign({ ok: true, changed, added, total: next.custom.length, state: next }, ids.length ? { ids } : {}));
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}

// ---------- 插件数据 ----------
const bjDay = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // 北京时间的日期
const live = items => { const o = {}; for (const k in items) if (isObj(items[k]) && !items[k].del) o[k] = items[k]; return o; };
async function ext(req, env) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const kv = env.CAPTIONS;
  if (!kv) return json({ ok: false, error: "KV binding CAPTIONS is missing" }, 500);
  try {
    const pre = await userPre(req, kv); if (pre === null) return noUser();
    const EK = pre + EXT_KEY; // 这个人的插件数据（主人就是 "ext"）
    const raw0 = await kv.get(EK), doc = (raw0 && JSON.parse(raw0)) || { ver: 0, items: {} };
    if (!isObj(doc.items)) doc.items = {};
    if (req.method === "GET") {
      const q = new URL(req.url).searchParams;
      if (q.get("history")) { const l = await kv.list({ prefix: EK + "@" }); return json({ ok: true, days: l.keys.map(k => k.name.slice(EK.length + 1)).sort().reverse() }); }
      const at = q.get("at");
      if (at) { if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return json({ ok: false, error: "bad date" }, 400); const d = await kv.get(EK + "@" + at, "json"); return d ? json({ ok: true, at, ver: d.ver, items: live(d.items || {}) }) : json({ ok: false, error: "not found" }, 404); }
      return json({ ok: true, ver: doc.ver, items: live(doc.items) });
    }
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
    const raw = await req.text(); if (raw.length > 20000000) return json({ ok: false, error: "too large" }, 413);
    const b = JSON.parse(raw || "{}");
    const A = await authOf(req, kv);
    if (b.replace && A === "bad") return needKey("replace");
    if (b.replace && isObj(b.replace.items)) { // 整份还原（内容取自存档或仓库里的 data/ext.json）
      const day = EK + "@" + bjDay(); if (raw0 && !(await kv.get(day))) await kv.put(day, raw0, { expirationTtl: 30 * 86400 });
      const now = Date.now(), items = {}; for (const k in b.replace.items) { const x = b.replace.items[k]; if (isObj(x)) items[k] = { v: x.v, at: now }; }
      for (const k in doc.items) if (!items[k]) items[k] = { del: 1, at: now };
      const next = { ver: now, items }; await kv.put(EK, JSON.stringify(next)); return json({ ok: true, ver: next.ver, items: live(items) });
    }
    if (!isObj(b.changes)) return json({ ok: false, error: "bad body" }, 400);
    let changed = false; const gone = [];
    for (const k in b.changes) {
      const x = b.changes[k]; if (!isObj(x) || typeof k !== "string" || k.length > 600 || !k.includes("|")) continue;
      const at = atOk(x.at), old = doc.items[k];
      if (old && atOk(old.at) > at) continue;
      if (x.del) { if (!old || !old.del) { doc.items[k] = { del: 1, at }; changed = true; if (k.startsWith("med|")) gone.push(k.slice(4)); } } /* 重发的删除不再删一遍（每天只有 1000 次删除额度） */
      else if (!old || old.del || JSON.stringify(old.v) !== JSON.stringify(x.v)) { doc.items[k] = { v: x.v, at }; changed = true; }
    }
    if (changed && A === "bad") { // 写入保护：一次删太多、当天累计删太多 → 要口令
      const prev = (raw0 && JSON.parse(raw0).items) || {}, rm = Object.keys(b.changes).filter(k => isObj(b.changes[k]) && b.changes[k].del && isObj(prev[k]) && !prev[k].del).length;
      const rw = Object.keys(b.changes).filter(k => isObj(b.changes[k]) && !b.changes[k].del && isObj(prev[k]) && !prev[k].del && !k.startsWith("med|") && JSON.stringify(prev[k].v) !== JSON.stringify(b.changes[k].v)).length; // 改写已有的项（改写很多 = 变相删除）
      if (rm > 30 || rw > 300) return needKey("big");
      if (rm && !(await guardDay(kv, pre + "ext", { rm }, { rm: 80 }))) return needKey("day");
    }
    if (changed) {
      const cut = Date.now() - 120 * 86400e3; for (const k in doc.items) if (doc.items[k].del && doc.items[k].at < cut) delete doc.items[k];
      const day = EK + "@" + bjDay(); if (raw0 && !(await kv.get(day))) await kv.put(day, raw0, { expirationTtl: 30 * 86400 });
      doc.ver = Math.max(Date.now(), (+doc.ver || 0) + 1); await kv.put(EK, JSON.stringify(doc)); // 同一毫秒里改两次也要换版本号（设备靠它判断云端变没变）
    }
    for (const m of gone) if (m.startsWith("med:")) await kv.delete(pre + "m:" + m);
    return json({ ok: true, changed, ver: doc.ver, items: live(doc.items) });
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}
async function media(req, env) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const kv = env.CAPTIONS;
  if (!kv) return json({ ok: false, error: "KV binding CAPTIONS is missing" }, 500);
  try {
    const pre = await userPre(req, kv); if (pre === null) return noUser();
    const okK = k => typeof k === "string" && k.startsWith("med:") && k.length < 480;
    if (req.method === "GET") {
      const k = new URL(req.url).searchParams.get("k"); if (!okK(k)) return json({ ok: false, error: "bad key" }, 400);
      const rec = await kv.get(pre + "m:" + k, "json"); return rec ? json({ ok: true, k, rec }) : json({ ok: false, error: "not found" }, 404);
    }
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
    const raw = await req.text(); if (raw.length > 8000000) return json({ ok: false, error: "too large" }, 413);
    const b = JSON.parse(raw || "{}"); if (!okK(b.k) || !isObj(b.rec)) return json({ ok: false, error: "bad body" }, 400);
    await kv.put(pre + "m:" + b.k, JSON.stringify(b.rec));
    return json({ ok: true });
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}

// ---------- 例句（Tatoeba） ----------
async function sent(req, env, u) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const pn = Math.min(30, +u.searchParams.get("pump") || 0), de = u.searchParams.get("lang") === "de", FROM = de ? "deu" : "eng"; // 🇩🇪 lang=de：Tatoeba 的德语句子（带中文翻译）
  if (pn > 0) {
    try {
      const out = [];
      for (let i = 0; i < 3 && out.length < pn; i++) {
        const r = await fetch("https://tatoeba.org/en/api_v0/search?from=" + FROM + "&query=&sort=random&word_count_min=5&word_count_max=12&to=cmn&trans_filter=limit&trans_to=cmn&rand_seed=" + Math.random().toString(36).slice(2, 8), { headers: { "User-Agent": "ruilearning-my (personal study site)" } });
        if (!r.ok) break; const j = await r.json();
        (j.results || []).forEach(x => { const ts = (x.translations || []).flat().filter(t => t && t.lang === "cmn"), t = ts.find(t => t.script === "Hans") || ts[0]; if (x.text && t && x.text.length <= 90 && !out.some(o => o.en === x.text)) out.push({ en: String(x.text), zh: String(t.text || "") }); });
      }
      return json({ ok: true, items: out.slice(0, pn) });
    } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
  }
  const w = String(u.searchParams.get("w") || "").normalize("NFC").toLowerCase().trim();
  if (!(de ? /^\p{L}[\p{L}' -]{0,40}$/u : /^[a-z][a-z' -]{0,40}$/).test(w)) return json({ ok: false, error: "bad word" }, 400);
  const kv = env.CAPTIONS, key = (de ? "s/de/" : "s/") + w;
  try {
    const hit = kv && (await kv.get(key, "json")); if (hit) return json({ ok: true, w, items: hit, cached: true });
    const r = await fetch("https://tatoeba.org/en/api_v0/search?from=" + FROM + "&query=" + encodeURIComponent(w.includes(" ") ? '"' + w + '"' : w) + "&sort=relevance&word_count_max=14&to=cmn&trans_filter=limit&trans_to=cmn", { headers: { "User-Agent": "ruilearning-my (personal study site)" }, cf: { cacheTtl: 86400 } });
    if (!r.ok) return json({ ok: false, error: "tatoeba " + r.status }, 502);
    const j = await r.json(), stem = w.length > 4 ? w.replace(de ? /(en|er|es|e|n|s|t|st)$/ : /(e|s|es|ed|ing|y)$/, "") : w;
    const re = de ? new RegExp("(^|[^\\p{L}])" + stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"), "iu") : new RegExp("\\b" + stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"), "i"); // 德语：\b 认不出 ä ö ü ß
    const items = (j.results || []).map(x => { const ts = (x.translations || []).flat().filter(t => t && t.lang === "cmn"), t = ts.find(t => t.script === "Hans") || ts[0]; return { en: String(x.text || ""), zh: t ? String(t.text || "") : "" }; })
      .filter(x => x.en && x.zh && x.en.length <= 100 && re.test(x.en)).slice(0, 12);
    if (kv && items.length) await cput(kv, key, JSON.stringify(items), { expirationTtl: 30 * 86400 }); // 没有例句的不存（随便编的词也会写一条，白占当天写入额度）
    return json({ ok: true, w, items });
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}

// ---------- 个人的学习资料 /api/mine（按人分开，换设备也在）：阅读的文章、作文批改历史、词汇量测试 ----------
// GET  ?k=reading|writing|vtest → { ok, items:{ id:{v, at} | {del:1, at} } }（删除记号保留 60 天）
// POST {k, changes:{ id:{v,at}|{del:1,at} }} → 同一项以 at 新的为准，返回合并后的 { ok, items }
const MINE_LIST = ["reading", "writing", "vtest", "speak", "daily", "sme", "err", "exam", "trip"], MINE_K = new RegExp("^(" + MINE_LIST.join("|") + ")$"); // trip：「📍 吉隆坡景点大全」勾的去过 / 想去（kl-sights.html） // err：「❌ 错题本」（errbook.js）；exam：雅思听力 / 阅读模考的成绩（exam.js） // daily：「📅 每日」的设置、手动打勾、每天完成几项；sme：「📻 6 分钟英语」听过哪几期 // speak：口语页的练习记录、每日打卡、AI 陪练记录、录音存档索引（speak.js）
async function mine(req, env, u) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const kv = env.CAPTIONS; if (!kv) return json({ ok: false, error: "KV binding CAPTIONS is missing" }, 500);
  try {
    const pre = await userPre(req, kv); if (pre === null) return noUser();
    if (req.method === "GET") {
      const k = u.searchParams.get("k") || ""; if (!MINE_K.test(k)) return json({ ok: false, error: "bad k" }, 400);
      if (u.searchParams.get("history")) { const l = await kv.list({ prefix: pre + "mine:" + k + "@" }); return json({ ok: true, days: l.keys.map(x => x.name.split("@").pop()).sort().reverse() }); } // 每天的存档（30 天）
      const at = u.searchParams.get("at"); if (at) { if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return json({ ok: false, error: "bad date" }, 400); const d = await kv.get(pre + "mine:" + k + "@" + at, "json"); return d ? json({ ok: true, at, items: d.items || {} }) : json({ ok: false, error: "not found" }, 404); }
      return json({ ok: true, items: ((await kv.get(pre + "mine:" + k, "json")) || {}).items || {} });
    }
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
    const raw = await req.text(); if (raw.length > 3000000) return json({ ok: false, error: "too large" }, 413);
    const b = JSON.parse(raw || "{}"); if (!MINE_K.test(b.k || "") || !isObj(b.changes)) return json({ ok: false, error: "bad body" }, 400);
    const key = pre + "mine:" + b.k, raw0 = await kv.get(key), cur = ((raw0 && JSON.parse(raw0)) || {}).items || {}, now = Date.now(); let changed = false;
    // 写入保护（同 /api/ext）：一次删 > 30 项、当天不带口令累计删 > 80 项 → 要口令
    const live0 = id => isObj(b.changes[id]) && cur[id] && !cur[id].del, ids = Object.keys(b.changes);
    const rm = ids.filter(id => live0(id) && (b.changes[id].del || b.changes[id].v == null)).length; // 写成空值 = 变相删除
    const rw = ids.filter(id => live0(id) && !b.changes[id].del && b.changes[id].v != null && JSON.stringify(cur[id].v) !== JSON.stringify(b.changes[id].v)).length; // 一次改写很多已有的项也要口令（同 /api/ext）
    if ((rm || rw > 300) && (await authOf(req, kv)) === "bad") { if (rm > 30 || rw > 300) return needKey("big"); if (!(await guardDay(kv, pre + "mine", { rm }, { rm: 80 }))) return needKey("day"); }
    for (const id in b.changes) { const x = b.changes[id]; if (!isObj(x) || !(+x.at) || String(id).length > 200) continue; const at = atOk(x.at); if (x.del && now - at > 60 * 86400e3) continue; /* 过期的删除记号（后台已经清掉了）不再收 */ if (!cur[id] || at > atOk(cur[id].at)) { const nx = x.del ? { del: 1, at } : { v: x.v, at }; if (!cur[id] || JSON.stringify(cur[id]) !== JSON.stringify(nx)) changed = true; cur[id] = nx; } }
    for (const id in cur) if (cur[id].del && now - cur[id].at > 60 * 86400e3) { delete cur[id]; changed = true; }
    if (changed) {
      const out = JSON.stringify({ items: cur }); if (out.length > 20000000) return json({ ok: false, error: "too large" }, 413);
      const day = key + "@" + bjDay(); if (raw0 && !(await kv.get(day))) await kv.put(day, raw0, { expirationTtl: 30 * 86400 }); // 当天第一次改动前存一份（30 天），误删了能找回
      await kv.put(key, out);
    }
    return json({ ok: true, items: cur });
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}

// ---------- 查词 /api/dict?w=单词或短语 ----------
// → { ok, word, phon, audio, zh 常用中文, zhs:[{pos, terms}], en:[{pos, def, ex}], examples:[[英, 中]] }，大家共用，KV 缓存 30 天（"d/词"）
// 来源都是免费的：中文 = 谷歌翻译（插件同款接口），音标 / 英文释义 / 发音 = dictionaryapi.dev，例句 = Tatoeba（同 /api/sent）
const UA = { "User-Agent": "ruilearning-my (personal study site)" };
let G_DOWN = 0; // 谷歌拦了这台机房（403 / 429 / 连不上）：10 分钟内不再去问，省得每次白等几秒
async function gtrans(text, tl, bd, sl) {
  sl = sl === "de" ? "de" : "en";
  let blocked = 0;
  for (const host of Date.now() < G_DOWN ? [] : ["translate.googleapis.com", "clients5.google.com"]) { // 后台机房的 IP 有时被谷歌拦：换个入口再试
    try { const r = await fetch("https://" + host + "/translate_a/single?client=" + (host[0] === "c" ? "dict-chrome-ex" : "gtx") + "&sl=" + sl + "&tl=" + tl + "&dt=t" + (bd ? "&dt=bd" : "") + "&dj=1&q=" + encodeURIComponent(text), { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" } });
      if (r.ok) { const j = await r.json(); if (j && (j.sentences || []).some(x => x.trans)) return j; } else if (r.status === 403 || r.status === 429 || r.status >= 500) blocked++; } catch (e) { blocked++; }
  }
  if (blocked >= 2) G_DOWN = Date.now() + 10 * 60000;
  if (text.length <= 480) try { // 再不行用 MyMemory（免费，每天有额度；超过 500 字它不翻）
    const r = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + sl + "|" + tl, { headers: UA });
    const j = r.ok && (await r.json()), t = j && j.responseData && j.responseData.translatedText;
    if (t && !/MYMEMORY WARNING/i.test(t)) return { sentences: [{ trans: t }], dict: [] };
  } catch (e) {}
  return null;
}
// 🇩🇪 德语查词（/api/dict?lang=de&w=…）：中文（谷歌，按德语翻）+ 维基词典英文版的德语词条（词性、英文释义、德语例句、名词的性 der/die/das、音标；
//   变形如 ging 会给出原形 lemma）+ Tatoeba 德语例句；存 KV「d/de/词」30 天。结构和英语的一样，多 gender、lemma 两个字段
const WIKT_UA = { "User-Agent": "ruilearning-my/1.0 (https://ruilearning-my.pages.dev; personal study site)" }; // 维基媒体要求 UA 带联系方式，不然容易被限流
const stripHtml = h => String(h || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(); // 解码出来的 <…> 再去一遍（不然 &lt;img onerror&gt; 会变成真标签）；&amp; 最后解，免得 &amp;lt; 被解两次
// 维基共享资源的录音地址要用文件名的 MD5 算目录（Workers 的 crypto.subtle 不一定有 MD5，这里自己算）；用转好的 mp3（iPhone Safari 放不了 .ogg）
function md5(str) {
  const b = new TextEncoder().encode(str), n = ((b.length + 8) >>> 6) + 1, x = new Uint32Array(n * 16);
  for (let i = 0; i < b.length; i++) x[i >> 2] |= b[i] << ((i % 4) * 8);
  x[b.length >> 2] |= 0x80 << ((b.length % 4) * 8); x[n * 16 - 2] = b.length * 8;
  const K = [], S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21]; for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let o = 0; o < x.length; o += 16) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g; const r = i >> 4;
      if (r === 0) { F = (B & C) | (~B & D); g = i; } else if (r === 1) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; } else if (r === 2) { F = B ^ C ^ D; g = (3 * i + 5) % 16; } else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      const t = D; D = C; C = B; const sum = (A + F + K[i] + x[o + g]) >>> 0, sh = S[r * 4 + (i % 4)]; B = (B + ((sum << sh) | (sum >>> (32 - sh)))) >>> 0; A = t;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  return [a0, b0, c0, d0].map(v => [0, 8, 16, 24].map(s => ((v >>> s) & 255).toString(16).padStart(2, "0")).join("")).join("");
}
const commonsMp3 = f => { const n = String(f).trim().replace(/ /g, "_"), name = n.charAt(0).toUpperCase() + n.slice(1), h = md5(name), e = encodeURIComponent(name); return "https://upload.wikimedia.org/wikipedia/commons/" + (/\.mp3$/i.test(name) ? "" : "transcoded/") + h[0] + "/" + h.slice(0, 2) + "/" + e + (/\.mp3$/i.test(name) ? "" : "/" + e + ".mp3"); }; // 原文件就是 mp3 的没有转码版
async function wiktDe(w) {
  const cap = w.charAt(0).toUpperCase() + w.slice(1), tries = [...new Set([w, cap, w.toLowerCase()])];
  for (const t of tries) {
    let j = null; try { const r = await fetch("https://en.wiktionary.org/api/rest_v1/page/definition/" + encodeURIComponent(t), { headers: WIKT_UA, cf: { cacheTtl: 86400 } }); if (r.status === 429 || r.status >= 500) return { busy: true }; if (r.ok) j = await r.json(); } catch (e) { return { busy: true }; } // 被限流 / 连不上：别再试别的写法，也别存
    if (!j || !Array.isArray(j.de) || !j.de.length) continue;
    const en = [], lemmas = []; let nDef = 0, nForm = 0;
    j.de.forEach(x => (x.definitions || []).slice(0, 4).forEach(df => {
      const def = stripHtml(df.definition); if (!def) return; nDef++;
      const lm = /\b(?:plural|singular|participle|preterite|subjunctive|imperative|inflection|form|comparative|superlative|genitive|dative|accusative|nominative|diminutive)\b[^.;]*?\bof\s+(\p{L}+)\s*$/u.exec(def); if (lm && lm[1] !== t) { lemmas.push(lm[1]); nForm++; } /* 只认「…的变形」：plural of Haus、preterite of gehen */
      if (en.length < 6) en.push({ pos: String(x.partOfSpeech || "").toLowerCase(), def, ex: df.parsedExamples && df.parsedExamples[0] ? stripHtml(df.parsedExamples[0].example) : "" });
    }));
    if (!en.length) continue;
    let gender = "", phon = "", audio = "";
    try { // 名词的性、音标：页面源码里的 {{de-noun|n…}}、{{IPA|de|…}}
      const r = await fetch("https://en.wiktionary.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&page=" + encodeURIComponent(t), { headers: WIKT_UA, cf: { cacheTtl: 86400 } });
      const wt = r.ok ? String(((await r.json()).parse || {}).wikitext || "") : "", i = wt.indexOf("==German==");
      if (i >= 0) { const rest = wt.slice(i + 10), e = rest.search(/\n==[^=]/), sec = e < 0 ? rest : rest.slice(0, e);
        const g = /\{\{de-noun\|([mfn])\b/.exec(sec) || /\{\{de-ndecl\|([mfn])\b/.exec(sec); if (g) gender = { m: "der", f: "die", n: "das" }[g[1]];
        const ip = /\{\{IPA\|de\|([^}|]+)/.exec(sec); if (ip) phon = ip[1].trim();
        const au = /\{\{audio\|de\|([^}|]+\.(?:ogg|oga|wav|mp3|flac))/i.exec(sec); if (au) audio = commonsMp3(au[1]); } // 🎙 真人录音（维基共享资源）
    } catch (e) {}
    return { title: t, en, gender, phon, audio, lemma: nDef && nForm === nDef ? lemmas[0] : "" }; // 只有全是「…的变形」才算有原形（Essen 有「Esse 的复数」这一条，但它本身就是原形）
  }
  return null;
}
async function dictDe(req, env, u) {
  const w = String(u.searchParams.get("w") || "").normalize("NFC").trim().replace(/\s+/g, " ");
  if (!w || w.length > 80 || !/^\p{L}[\p{L}0-9' .,?!-]*$/u.test(w)) return json({ ok: false, error: "bad word" }, 400);
  const kv = env.CAPTIONS, key = "d/de2/" + w; // de2：加了真人录音（audio）以后换的键，旧的不用； 德语大小写不同是不同的词（arm 穷 / Arm 胳膊、essen / Essen）：按原样存
  try {
    const hit = kv && (await kv.get(key, "json")); if (hit && !(await freshOf(req, u, kv))) return json(Object.assign({ ok: true, cached: true }, hit));
    const one = w.split(" ").length <= 3, single = !w.includes(" ");
    const [g, wk0, ex] = await Promise.all([
      gtrans(w, "zh-CN", one, "de").catch(() => null),
      single ? wiktDe(w).catch(() => ({ busy: true })) : null,
      w.length <= 40 ? sent(new Request("https://x/"), env, new URL("https://x/api/sent?lang=de&w=" + encodeURIComponent(w.toLowerCase()))).then(r => r.json()).catch(() => null) : null,
    ]);
    const busy = !!(wk0 && wk0.busy), wk = busy ? null : wk0;
    const out = { word: wk && wk.title || w, phon: wk ? wk.phon : "", audio: wk ? wk.audio || "" : "", zh: "", zhs: [], en: wk ? wk.en : [], examples: [], gender: wk ? wk.gender : "", lemma: wk ? wk.lemma : "" };
    if (g) { out.zh = (g.sentences || []).map(x => x.trans || "").join(""); out.zhs = (g.dict || []).slice(0, 4).map(x => ({ pos: x.pos || "", terms: (x.terms || []).slice(0, 6) })); }
    if (ex && ex.ok) out.examples = (ex.items || []).slice(0, 5).map(x => [x.en, x.zh]);
    if (!out.zh && !out.en.length) return json({ ok: false, error: "not found", word: w }, 404);
    if (kv && !busy && out.zh && (out.en.length || out.zhs.length || out.examples.length)) await cput(kv, key, JSON.stringify(out), { expirationTtl: ((single && !wk) || (w.length <= 40 && !(ex && ex.ok)) ? 1 : 30) * 86400 }); // 维基词典被限流：不存；没有词条 / 例句没取到：只存 1 天
    return json(Object.assign({ ok: true }, out));
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}
async function dict(req, env, u) {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (u.searchParams.get("lang") === "de") return dictDe(req, env, u);
  const w = String(u.searchParams.get("w") || "").trim().replace(/\s+/g, " ");
  if (!w || w.length > 80 || !/^[A-Za-z][A-Za-z0-9' .,?!-]*$/.test(w)) return json({ ok: false, error: "bad word" }, 400);
  const kv = env.CAPTIONS, key = "d/" + w.toLowerCase();
  try {
    const hit = kv && (await kv.get(key, "json")); if (hit && !(await freshOf(req, u, kv))) return json(Object.assign({ ok: true, cached: true }, hit));
    const one = w.split(" ").length <= 3, exOn = /^[a-z][a-z' -]{0,40}$/i.test(w);
    const [g, d, ex] = await Promise.all([
      gtrans(w, "zh-CN", one).catch(() => null),
      one ? fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(w.toLowerCase()), { headers: UA }).then(r => r.ok ? r.json() : r.status === 404 ? [] : null).catch(() => null) : null, // 404 = 词典里真没有；其它失败 = null
      exOn ? sent(new Request("https://x/"), env, new URL("https://x/api/sent?w=" + encodeURIComponent(w.toLowerCase()))).then(r => r.json()).catch(() => null) : null,
    ]);
    const out = { word: w, phon: "", audio: "", zh: "", zhs: [], en: [], examples: [] };
    if (g) { out.zh = (g.sentences || []).map(x => x.trans || "").join(""); out.zhs = (g.dict || []).slice(0, 4).map(x => ({ pos: x.pos || "", terms: (x.terms || []).slice(0, 6) })); }
    if (Array.isArray(d) && d[0]) {
      const ps = d.flatMap(x => x.phonetics || []);
      out.phon = (d.find(x => x.phonetic) || {}).phonetic || (ps.find(p => p.text) || {}).text || "";
      out.audio = ((ps.find(p => /-us\.mp3$/.test(p.audio || "")) || ps.find(p => p.audio)) || {}).audio || "";
      d.forEach(x => (x.meanings || []).forEach(m => (m.definitions || []).slice(0, 3).forEach(df => { if (out.en.length < 6) out.en.push({ pos: m.partOfSpeech || "", def: df.definition || "", ex: df.example || "" }); })));
    }
    if (ex && ex.ok) out.examples = (ex.items || []).slice(0, 5).map(x => [x.en, x.zh]);
    if (!out.zh && !out.en.length) return json({ ok: false, error: "not found", word: w }, 404);
    const full = (!one || d !== null) && (!exOn || (ex && ex.ok)); // 词典、例句有一个没连上：只存 1 天，过后再补全
    if (kv && out.zh && (out.en.length || out.zhs.length || out.examples.length)) await cput(kv, key, JSON.stringify(out), { expirationTtl: (full ? 30 : 1) * 86400 }); // 中文没取到的不缓存，下次再试
    return json(Object.assign({ ok: true }, out));
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}

// ---------- 抓文章正文 /api/readurl?url=… （「📰 阅读」用）→ { ok, title, text }：只取标题和正文段落（p、h1–h3、li、blockquote），不存 ----------
async function readurl(req, env, u) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const x = await extractArticle(u.searchParams.get("url") || "");
  return x.ok ? json(x) : json({ ok: false, error: x.error }, x.status || 500);
}
// 抓网页、抽出标题和正文 → {ok, title, text, url} 或 {ok:false, error, status}（/api/readurl 和 /api/news 共用）
async function extractArticle(url) {
  let t; try { t = new URL(url); } catch (e) { return { ok: false, error: "bad url", status: 400 }; }
  if (!/^https?:$/.test(t.protocol)) return { ok: false, error: "bad url", status: 400 };
  try {
    const r = await fetch(t.toString(), { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "Accept": "text/html" }, redirect: "follow" });
    if (!r.ok) return { ok: false, error: "http " + r.status, status: 502 };
    if (!/html/i.test(r.headers.get("content-type") || "")) return { ok: false, error: "not html", status: 415 };
    let title = "", og = "", skip = 0, cur = null; const blocks = [];
    const B = { element(el) { if (skip) return; cur = { t: el.tagName, s: "" }; blocks.push(cur); el.onEndTag(() => { cur = null; }); }, text(x) { if (cur && !skip) cur.s += x.text; } };
    const SK = { element(el) { skip++; el.onEndTag(() => { skip--; }); } };
    await new HTMLRewriter()
      .on("title", { text(x) { title += x.text; } })
      .on('meta[property="og:title"]', { element(el) { og = el.getAttribute("content") || ""; } })
      .on("script,style,nav,footer,aside,form,noscript,figure", SK)
      .on("p,h1,h2,h3,li,blockquote", B)
      .transform(r).arrayBuffer();
    const dec = s => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, "—").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/\s+/g, " ").trim();
    const paras = blocks.map(b => ({ t: b.t, s: dec(b.s) })).filter(b => b.s && !/<iframe|^Embed\b/i.test(b.s) && (b.t[0] === "h" || b.s.split(" ").length >= (b.t === "li" ? 6 : 5)));
    const text = paras.map(b => b.s).join("\n\n").slice(0, 60000);
    if (text.split(/\s+/).length < 40) return { ok: false, error: "no article text", status: 422 };
    return { ok: true, title: dec(og || title).slice(0, 200), text, url: t.toString() };
  } catch (e) { return { ok: false, error: String(e && e.message || e), status: 500 }; }
}

// ---------- 今日新闻 /api/news?d=YYYY-MM-DD （「📰 阅读」顶部「每天一篇」）→ { ok, date, src, url, title, text, words, pub, list:[{t, u, s, p}] } ----------
// 从 BBC / Guardian / NPR 的 RSS 取最近两天的头条，按日期「随机」排（同一天大家拿到同一篇），挑第一篇能抓到 250–1500 词正文的；
// 结果存 KV「news/日期」3 天（不分家人）。list 是当天其它头条（「换一篇」「其它头条」用，前端再走 /api/readurl 抓正文）。?fresh=1 不用缓存重新挑
const NEWS_FEEDS = [
  ["BBC", "https://feeds.bbci.co.uk/news/world/rss.xml"], ["BBC", "https://feeds.bbci.co.uk/news/rss.xml"],
  ["BBC", "https://feeds.bbci.co.uk/news/technology/rss.xml"], ["BBC", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"],
  ["Guardian", "https://www.theguardian.com/world/rss"], ["Guardian", "https://www.theguardian.com/science/rss"], ["Guardian", "https://www.theguardian.com/technology/rss"],
  ["NPR", "https://feeds.npr.org/1001/rss.xml"],
];
// 🇩🇪 学德语（?lang=de）：tagesschau（ARD 新闻，正文干净；DW、Deutschlandfunk 的网页抽出来夹着导航，没用）
const NEWS_FEEDS_DE = [["tagesschau", "https://www.tagesschau.de/xml/rss2/"], ["tagesschau", "https://www.tagesschau.de/wissen/index~rss2.xml"], ["tagesschau", "https://www.tagesschau.de/ausland/index~rss2.xml"], ["tagesschau", "https://www.tagesschau.de/wirtschaft/index~rss2.xml"]];
// tagesschau 正文里的「Stand: 日期」、结尾的「Dieses Thema im Programm…」「Mehr zum Thema」去掉
const deClean0 = t => { const P = t.split("\n\n"), out = []; for (const p of P) { if (/^(Dieses Thema im Programm|Mehr zum Thema|Über dieses Thema berichtete|Weitere Informationen|Quelle:)/i.test(p.trim())) break; if (/^Stand: \d/.test(p.trim())) continue; out.push(p); } return out.join("\n\n"); };
// 再去掉 tagesschau 正文里夹着的「相关文章」（一行标题 + 一段以「… mehr」结尾的摘要）和页脚「tagesschau.de | 标题 | 日期 | 时间」
const deClean = t => { const P = deClean0(t).split("\n\n"), out = []; for (const p of P) { const q = p.trim(); if (/^tagesschau\.de \|/.test(q) || /\|\s*\d{1,2}\.\d{1,2}\.\d{4}\s*\|/.test(q)) continue; if (/(\s|…|\.\.\.)mehr$/.test(q)) { const last = out[out.length - 1]; if (last && last.length < 160 && !/[.!?:]$/.test(last.trim())) out.pop(); continue; } out.push(p); } return out.join("\n\n"); };
function rssItems(xml, src) {
  const dec = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;|&#x27;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/\s+/g, " ").trim();
  const tag = (x, n) => { const m = x.match(new RegExp("<" + n + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + n + ">")); return m ? dec(m[1]) : ""; };
  return (xml.match(/<item[\s>][\s\S]*?<\/item>/g) || []).map(x => {
    let u = tag(x, "link"); if (src === "BBC") u = u.replace(/\?.*$/, "");
    return { t: tag(x, "title"), u, s: src, p: Date.parse(tag(x, "pubDate")) || 0 };
  }).filter(i => i.t && /^https:\/\//.test(i.u) && !/\/(videos?|live|sounds|av|audio|gallery|picture|in-pictures|ng-interactive|multimedia|livestream|liveblog)\//.test(i.u) && !/liveblog|-livestream/.test(i.u));
}
const newsDay = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
async function news(req, env, u) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const qd = u.searchParams.get("d") || "", today = newsDay(), lo = new Date(Date.now() + 8 * 3600e3 - 30 * 86400e3).toISOString().slice(0, 10);
  const de = u.searchParams.get("lang") === "de", d = /^\d{4}-\d{2}-\d{2}$/.test(qd) && qd >= lo && qd <= today ? qd : today, key = "news/" + (de ? "de/" : "") + d; // 只认最近 30 天（随便写个日期就多存一条，会被刷写入额度）
  if (!(await freshOf(req, u, env.CAPTIONS))) { const c = await env.CAPTIONS.get(key, "json"); if (c) return json(c); }
  const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" };
  const got = await Promise.all((de ? NEWS_FEEDS_DE : NEWS_FEEDS).map(([s, f]) => fetch(f, { headers: UA }).then(r => (r.ok ? r.text() : "")).then(x => rssItems(x, s)).catch(() => [])));
  const now = Date.now(), seen = new Set(); let all = [];
  for (const L of got) for (const i of L) { const k = i.t.toLowerCase(); if (seen.has(k) || seen.has(i.u)) continue; seen.add(k); seen.add(i.u); all.push(i); }
  const within = h => all.filter(i => i.p && now - i.p < h * 3600e3), r2 = within(48); all = r2.length >= 8 ? r2 : within(7 * 24); // 最近两天的；太少就放宽到一周，更旧的不要
  const h = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  all.sort((a, b) => h(d + a.u) - h(d + b.u));
  if (!all.length) return json({ ok: false, error: "no feeds" }, 502);
  let pick = null;
  for (const i of all.slice(0, 8)) {
    const x = await extractArticle(i.u); if (!x.ok) continue; if (de) x.text = deClean(x.text);
    const n = x.text.split(/\s+/).length; if (n < 250) continue;
    let text = x.text.replace(/^[^\n]{0,200}\n\n/, m => (/[.!?"”“»«]\s*$/.test(m.trim()) && !/^[„"«»“]/.test(m.trim()) ? m : "")); // 第一段是标题（没有句号）就去掉，免得读两遍
    if (n > 1500) { const P = text.split("\n\n"), out = []; let c = 0; for (const p of P) { if (c > 1200) break; out.push(p); c += p.split(/\s+/).length; } text = out.join("\n\n"); }
    pick = { src: i.s, url: i.u, title: i.t || x.title, text, words: text.split(/\s+/).length, pub: i.p }; break;
  }
  if (!pick) return json({ ok: false, error: "no article" }, 502);
  const out = { ok: true, date: d, ...pick, list: all.filter(i => i.u !== pick.url).slice(0, 15).map(({ t, u, s, p }) => ({ t, u, s, p })) };
  await cput(env.CAPTIONS, key, JSON.stringify(out), { expirationTtl: 3 * 86400 });
  return json(out);
}

// ---------- 每日听力 /api/sme：BBC、VOA、NPR、Breaking News English 的栏目（「🎧 听 → 📻 听力节目」）----------
// BBC：s = ree Real Easy English（慢速简单对话）/ tews The English We Speak（地道说法）/ news Learning English from the News（新闻英语）/ sme 6 Minute English
//      drama 广播剧（名著改编，期号 drama/<名字>）/ eau English at University（18 集情景剧）：这两个早就不更新了，目录页一页就是全部
// VOA（美国之音慢速英语，美国政府作品属公有领域；2025 年 3 月起停更，旧节目还在）：期号 = 栏目 + "/" + 文章号（如 vst/7504521）
//      vst American Stories（美国故事）/ vwd Words and Their Stories（词语故事）/ vgr Everyday Grammar（每日语法）/ vnw As It Is（慢速新闻）
//      目录：learningenglish.voanews.com/z/<栏目号>?p=0..4（一页 12 篇）；一期：/a/<文章号>.html（会跳到带标题的地址）的正文 <div class="wsw">、「Words in This Story」生词表、voa-audio.voanews.eu 的 mp3
// NPR（美国公共广播电台播客，正常语速，主持人对话；一直在更新）：nup Up First（每日新闻）/ nsw Short Wave（科学）/ npm Planet Money（经济）
//      Life Kit 试过：四成节目 NPR 没放文稿（页面上标着 no-transcript），没加
//      目录：feeds.npr.org/<节目号>/podcast.xml 的前 60 期（整份 RSS 有好几 MB，读够就停）；期号 = 栏目 + "/" + NPR 稿件号（如 nsw/nx-s1-6045648）
//      一期：mp3 用目录里的（去掉广告追踪的跳转，直接 npr.simplecastaudio.com）；文稿 www.npr.org/transcripts/<稿件号>（「名字: 台词」；NPR 一般播出后 1–2 天才放文稿，没有就报 "no transcript yet"）
// Breaking News English（分级新闻，每三四天一篇，简单篇、进阶篇轮流）：简单篇有 Level 0–3，进阶篇有 Level 4–6，每级有自己的文本和朗读 mp3
//      栏目 bn1 = 简单篇 Level 1、bn3 = 简单篇 Level 3、bn5 = 进阶篇 Level 5、bn6 = 进阶篇 Level 6；期号 = 栏目 + "/" + 月份/文章名（如 bn3/2611/261119-gta-6）
//      目录：首页（标题提示里写着是简单篇还是进阶篇）+ 首页链着的最近一期存档页（没写的：看有没有 Level 0 页面，结果存 KV「bne/k/<文章>」）；
//      所有文章先存一份「bne/arts」6 小时，四个栏目从里面挑。一期：<文章>-<级别>.html 的 <article>（Level 3 / 6 是文章本页，没有后缀）、<文章>-<级别>.mp3
// BBC 每周的栏目往年的也列：6 分钟英语、地道说法从 2022 年起，新闻英语从 2024 年起（BBC 网站更早的页面没有了）
// 故事类栏目（story）：同一个故事的几集排在一起、按第 1 集 → 最后一集；故事之间新的在前
// GET /api/sme?s=tews → { ok, s, list:[{id, t 标题, d 日期, p 一句简介, img}] }：今年和去年的节目目录（新的在前），KV「sme/list/<s>」存 12 小时（6 Minute English 还是「sme/list」）
// GET /api/sme?ep=6-minute-english_2026/ep-261119 → { ok, id, s, title, mp3, intro, q:[问题, 选项…], vocab:[[词, 英文解释, 例句?]], heads:[[新闻标题, 来源]], lines:[{who, t}] }：KV「sme/ep/…」存 90 天
// GET /api/sme?ep=…&zh=1 → { ok, intro, q:[], vocab:[], heads:[], lines:[] } 和上面一一对应的中文（谷歌翻译），KV「sme/zh/…」存 180 天
const SME_S = {
  ree: { slug: "real-easy-english", yearly: false, re: /^real-easy-english\/\d{6}$/ },
  tews: { slug: "the-english-we-speak", yearly: true, from: 2022, re: /^the-english-we-speak_\d{4}\/(ep-)?\d{6}$/ },
  news: { slug: "learning-english-from-the-news", yearly: true, from: 2024, re: /^learning-english-from-the-news_\d{4}\/\d{6}$/ },
  sme: { slug: "6-minute-english", yearly: true, from: 2022, re: /^6-minute-english_\d{4}\/(ep-)?\d{6}$/ }, // 有几期地址里没有 ep-（如 6-minute-english_2025/250417）
  drama: { slug: "drama", yearly: false, re: /^drama\/[a-z0-9-]{3,60}$/, idp: "drama/[a-z0-9-]{3,60}", story: true, skip: /^drama\/elephant-/ }, // The White Elephant 只有视频
  eau: { slug: "english-at-university", yearly: false, re: /^english-at-university\/ep-\d{6}$/, story: true },
  vst: { voa: 1581, re: /^vst\/\d{5,9}$/, story: true },
  vwd: { voa: 987, re: /^vwd\/\d{5,9}$/ },
  vgr: { voa: 4456, re: /^vgr\/\d{5,9}$/ },
  vnw: { voa: 3521, re: /^vnw\/\d{5,9}$/ },
  nup: { npr: 510318, re: /^nup\/[a-z0-9-]{6,30}$/ },
  nsw: { npr: 510351, re: /^nsw\/[a-z0-9-]{6,30}$/ },
  npm: { npr: 510289, re: /^npm\/[a-z0-9-]{6,30}$/ },
  bn1: { bne: 1, re: /^bn1\/\d{4}\/\d{6}-[a-z0-9-]{1,80}$/ },
  bn3: { bne: 3, re: /^bn3\/\d{4}\/\d{6}-[a-z0-9-]{1,80}$/ },
  bn5: { bne: 5, re: /^bn5\/\d{4}\/\d{6}-[a-z0-9-]{1,80}$/ },
  bn6: { bne: 6, re: /^bn6\/\d{4}\/\d{6}-[a-z0-9-]{1,80}$/ },
};
const smeOf = ep => Object.keys(SME_S).find(k => SME_S[k].re.test(ep)) || "";
const VOA = "https://learningenglish.voanews.com", BNE = "https://breakingnewsenglish.com/";
function smeLines(h) {
  const dec = s => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&hellip;/g, "…").replace(/&pound;/g, "£").replace(/&euro;/g, "€").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
  // 说话人 / 生词：「<strong>Name</strong><br />」或「<strong>Name<br /></strong>」→ 单独一行「@@Name」
  return dec(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<strong>([^<]{1,60})<br[^>]*>\s*<\/strong>|<strong>([^<]{1,60})<\/strong>\s*<br[^>]*>/gi, (m, x, y) => "\n@@" + (x || y) + "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|h\d|li|div|dt|dd)>/gi, "\n").replace(/<[^>]+>/g, "")).split("\n").map(s => s.replace(/\s+/g, " ").trim()).filter(s => s && s !== "@@");
}
function smeParse(html) {
  const L0 = smeLines(html), L = L0.map(s => s.replace(/^@@/, "")), at = (re, from) => { for (let i = from || 0; i < L.length; i++) if (re.test(L[i])) return i; return -1; };
  const og = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || "";
  const mp3 = ((html.match(/href="\s*(https?:\/\/downloads\.bbc\.co\.uk\/[^"]+\.mp3)"/) || [])[1] || "").replace(/^http:/, "https:"); // 老节目（广播剧、大学英语）是 http 地址
  const iI = at(/^(Introduction|The story)$/i), iH = at(/^News headlines$/i), iQ = at(/^This week'?s question$/i), iV = at(/^(Vocabulary|Key words and phrases)$/i), iT = at(/^Transcript$/i);
  const iEnd = at(/^(Next|Previous)$|^(Latest|Download|Episode \d+$|Take the quiz|Note: This podcast)/i, Math.max(iI, iV, iT, 0) + 1); // 「Next.」可能是台词（大学英语），只认单独的 Next
  // 广播剧有的没有「Transcript」标题：播放器下面几段简介，接着就是「说话人 / 台词」
  let iT2 = -1, iA = -1;
  if (iT < 0 && iI < 0) { iA = at(/^To play this (audio|video)/i); if (iA >= 0) { for (let i = iA + 1; i < L0.length && (iV < 0 || i < iV); i++) if (/^@@/.test(L0[i]) && L0[i + 1] && !/^@@/.test(L0[i + 1])) { iT2 = i; break; } } }
  const marks = [iI, iH, iQ, iV, iT, iEnd].filter(x => x >= 0).sort((x, y) => x - y);
  const end = a => { const n = marks.find(x => x > a); return n == null ? Math.min(L.length, a + 80) : n; };
  const seg = (a, raw) => (a < 0 ? [] : (raw ? L0 : L).slice(a + 1, end(a)));
  const intro = iT2 > 0 ? L.slice(iA + 1, iT2).join(" ") : seg(iI).join(" ");
  const q = seg(iQ).filter(s => !/^Listen to the programme/i.test(s));
  const heads = []; { const H = seg(iH); for (let i = 0; i < H.length; i++) { if (H[i + 1] && H[i + 1].length < 40 && H[i].length > H[i + 1].length) { heads.push([H[i], H[i + 1]]); i++; } else heads.push([H[i], ""]); } }
  const V0 = seg(iV, true), vocab = [];
  if (V0.some(s => /^@@/.test(s))) { for (const s of V0) { if (/^@@/.test(s)) vocab.push([s.slice(2).trim(), ""]); else if (vocab.length) { const v = vocab[vocab.length - 1]; if (!v[1]) v[1] = s; else if (!v[2]) v[2] = s; } } }
  else if (V0.filter(s => / [-–] /.test(s)).length >= Math.max(2, V0.length / 2)) { for (const s of V0) { const m = s.match(/^(.{1,60}?) [-–] (.+)$/); if (m) vocab.push([m[1].trim(), m[2].trim()]); } } // 大学英语：一行「词 - 解释」
  else for (let i = 0; i + 1 < V0.length; i += 2) vocab.push([V0[i], V0[i + 1]]);
  const T = (iT < 0 ? (iT2 < 0 ? [] : L0.slice(iT2, iV > iT2 ? iV : end(iT2))) : L0.slice(iT + 1, end(iT))).filter(s => !/^(@@)?Note: This is not a word-for-word transcript/i.test(s));
  const lines = []; let who = "";
  for (let i = 0; i < T.length; i++) { const s = T[i]; if (/^@@/.test(s)) { who = s.slice(2).trim(); continue; } lines.push({ who, t: s }); }
  return { title: og.split(" / ").pop().replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").trim(), mp3, intro, q, vocab: vocab.filter(v => v[0] && v[1]), heads, lines };
}
function smeIndex(html, slug, idp) {
  const out = [], seen = new Set(), re = new RegExp('<a\\s+href="/learningenglish/english/features/(' + (idp || slug + '(?:_\\d{4})?/(?:ep-)?\\d{6}') + ')"><img src="([^"]+)"[\\s\\S]*?<h2><a\\s+href="[^"]+">([^<]+)</a></h2>[\\s\\S]*?<h3>([\\s\\S]*?)</h3>\\s*<p>([^<]*)</p>', "g");
  const dec = s => s.replace(/&amp;/g, "&").replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  let m; while ((m = re.exec(html))) { if (seen.has(m[1])) continue; seen.add(m[1]); const d = (m[4].match(/(\d{1,2} \w{3} \d{4})/) || [])[1] || ""; out.push({ id: m[1], img: m[2], t: dec(m[3]), d, p: dec(m[5]) }); }
  return out;
}
// 故事类栏目的排序：同一个故事（标题去掉「Part 2」「Episode 3」以后一样）排在一起、按集数从前往后；故事之间按最近一集的日期新的在前
const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
function storySort(list) {
  const PN = /[,:\-–]?\s*\b(?:(?:part|episode|chapter)\s+(\d+|[a-z]+)|ep\.?\s*(\d+))\b.*$/i; // 「Part Two」「Episode 3」「ep 05」
  const key = t => String(t || "").replace(PN, "").replace(/['"‘’“”,]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const no = t => { const m = String(t || "").match(PN); return m ? (+(m[1] || m[2]) || NUMW[String(m[1] || "").toLowerCase()] || 0) : 0; };
  const day = x => Date.parse(x.d) || 0, G = new Map(), nt = t => String(t || "").replace(/^(\d+)\s*[-–:]\s*/, "Episode $1 - "); // 大学英语后几集叫「18 - Emergency」
  list.forEach(x => { const k = key(nt(x.t)); if (!G.has(k)) G.set(k, []); G.get(k).push(x); });
  const gs = [...G.values()].map(g => ({ g: g.sort((a, b) => no(nt(a.t)) - no(nt(b.t)) || day(a) - day(b)), d: Math.max(...g.map(day)) }));
  return gs.sort((a, b) => b.d - a.d).flatMap(x => x.g);
}
const voaTxt = h => String(h || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&hellip;/g, "…").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/[\u200b-\u200d\ufeff]/g, "").replace(/\s+/g, " ").trim();
// VOA 栏目目录页 → [{id, t, d, img, p:""}]
function voaIndex(html, s) {
  const out = [], seen = new Set();
  for (const m of html.matchAll(/<a href="\/a\/[a-z0-9-]+\/(\d{5,9})\.html"\s+class="img-wrap[^"]*" title="([^"]*)">([\s\S]*?)<\/a>\s*<div class="media-block__content">([\s\S]*?)<\/div>/g)) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    const img = ((m[3].match(/<img src="(https:\/\/gdb\.voanews\.com\/[^"]+)"/) || [])[1] || "").replace(/_w\d+_r1\./, "_w320_r1.");
    const d = voaTxt((m[4].match(/<span class="date[^"]*"\s*>([^<]+)</) || [])[1] || "");
    out.push({ id: s + "/" + m[1], img, t: voaTxt(m[2]), d, p: "" });
  }
  return out;
}
// VOA 一篇文章 → 和 BBC 一样的结构 { title, mp3, intro, q:[], vocab:[[词, 解释]], heads:[], lines:[{who:"", t}] }
function voaParse(html) {
  const meta = k => voaTxt((html.match(new RegExp('<meta content="([^"]*)" property="og:' + k + '"')) || html.match(new RegExp('<meta property="og:' + k + '" content="([^"]*)"')) || [])[1] || "");
  const au = [...new Set((html.match(/https?:\/\/(voa-audio\.voanews\.eu|voa-video\.voanews\.eu|av\.voanews\.com)\/[^"'\s<>]+?\.mp3/g) || []).map(u => u.replace(/^http:/, "https:").replace(/^https:\/\/av\.voanews\.com\/Videoroot\//, "https://voa-video.voanews.eu/")))]; // 2015 年前后的老文章：av.voanews.com 会跳到 voa-video.voanews.eu
  const mp3 = au.find(u => /_hq\.mp3$/.test(u)) || au[0] || "";
  const i = html.indexOf('<div class="wsw">'), j = i < 0 ? -1 : html.indexOf('id="comments"', i);
  const body = i < 0 ? "" : html.slice(i, j > i ? j : i + 200000);
  const lines = [], vocab = []; let sec = "t";
  const parts = []; // 老文章整个故事在一个 <p> 里、用 <br> 分段：拆开当成一段一段
  for (const m of body.matchAll(/<(p|h2|h3|h4)\b[^>]*>([\s\S]*?)<\/\1>/g)) m[1] === "p" ? m[2].split(/(?:<br[^>]*>\s*)+/i).forEach(x => parts.push(["p", x])) : parts.push([m[1], m[2]]);
  for (const [tag, raw] of parts) {
    const t = voaTxt(raw); if (!t || /^_+$/.test(t) || /^No media source currently available/i.test(t)) continue;
    if (tag !== "p" || /^<strong>[^<]*<\/strong>$/.test(raw.trim())) { // 小标题：生词表 / 练习 / 讨论题之后都不是节目里念的
      if (/^words in this (story|lesson|report)|^vocabulary|^words to know/i.test(t)) { sec = "v"; continue; }
      if (/^(practice|quiz|test yourself|we want to hear from you|now it'?s your turn|what do you think|your thoughts|discussion|___)/i.test(t)) { sec = "x"; continue; }
      if (tag !== "p") { if (sec === "t") lines.push({ who: "", t }); continue; }
    }
    if (/^(now it'?s your turn|download a lesson plan|click on the image)/i.test(t)) { if (sec === "t") sec = "x"; continue; }
    if (sec === "v" || (sec === "x" && /^[a-z][a-z' -]{0,40} [-–] (n|v|adj|adv|phrase|idiom|prep|conj|pron)\.? /i.test(t))) { // 生词：「<strong>词</strong> –n. 解释」或纯文字「词 - v. 解释」
      const w = raw.match(/^\s*<strong>([\s\S]*?)<\/strong>\s*([\s\S]*)$/), a = w ? [voaTxt(w[1]), voaTxt(w[2]).replace(/^[-–—]\s*/, "")] : (t.match(/^(.{1,40}?) [-–] (.+)$/) || []).slice(1);
      if (a[0] && a[1]) vocab.push(a); continue;
    }
    if (sec !== "t") continue;
    if (/\b(wrote|adapted|edited|reported|produced)\b.{0,120}\b(VOA Learning English|for VOA)\b|\breported (on )?(this|the) story for\b|^_{3,}|^(Copyright|Original story by)\b/i.test(t)) continue; // 署名：节目里不念
    lines.push({ who: "", t });
  }
  return { title: meta("title") || voaTxt((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ""), mp3, intro: meta("description"), q: [], vocab, heads: [], lines };
}
// NPR：RSS 有好几 MB，边下边找，够 n 期就停（Workers 的 CPU 时间有限）
async function nprFeed(pid, n) {
  const r = await fetch("https://feeds.npr.org/" + pid + "/podcast.xml", { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/rss+xml,text/xml" } }); if (!r.ok || !r.body) return "";
  const rd = r.body.getReader(), dec = new TextDecoder(); let x = "", k = 0, pos = 0, c = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; x += dec.decode(value, { stream: true }); let i; while (c <= n && (i = x.indexOf("</item>", pos)) >= 0) { c++; pos = i + 7; } if (c > n) { try { await rd.cancel(); } catch (e) {} break; } pos = Math.max(pos, x.length - 7); if (++k > 400) break; } // 每次只从上次找到的地方往后找（整份从头找，长的节目单很费 CPU）
  return x;
}
const nprMp3 = u => { u = String(u || "").replace(/&amp;/g, "&"); const m = u.match(/(npr\.simplecastaudio\.com|[a-z0-9-]+\.npr\.org)\/[^?"]+?\.mp3/); return m ? "https://" + m[0] : /^https:\/\//.test(u) ? u : ""; }; // 去掉 podtrac / spotify 这些广告追踪的跳转
function nprIndex(xml, s) {
  const out = [], dd = d => { const t = Date.parse(d); return t ? new Date(t).toUTCString().slice(5, 16) : ""; };
  for (const it of xml.split("<item>").slice(1)) {
    const g = re => (it.match(re) || [])[1] || "";
    const link = g(/<link>([^<]+)<\/link>/), sid = (link.match(/npr\.org\/\d{4}\/\d\d\/\d\d\/([a-z0-9-]{6,30})\//) || [])[1]; if (!sid) continue; // 没有稿件号的（预告、特别节目）没有文稿
    const mp3 = nprMp3(g(/<enclosure[^>]*\burl="([^"]+)"/)); if (!mp3) continue;
    const img = (g(/<media:thumbnail[^>]*\burl="([^"]+)"/) || g(/<itunes:image href="([^"]+)"/)).replace(/&amp;/g, "&").replace(/\/resize\/\d+\//, "/resize/480/");
    out.push({ id: s + "/" + sid, t: voaTxt(g(/<title>([\s\S]*?)<\/title>/).replace(/^<!\[CDATA\[|\]\]>$/g, "")), d: dd(g(/<pubDate>([^<]+)<\/pubDate>/)), img, p: "", mp3, dur: +g(/<itunes:duration>(\d+)<\/itunes:duration>/) || 0 });
  }
  return out;
}
// NPR 文稿页 → [{who, t}]：一段一个 <p>，开头「EMILY KWONG:」是说话人；[MUSIC PLAYING] 这种不是话
function nprParse(html) {
  let i = html.indexOf('class="transcript storytext"'); if (i < 0) return { lines: [], intro: "" }; i = html.indexOf(">", i) + 1;
  const seg = html.slice(i, i + 600000), lines = [];
  for (const raw of seg.split(/<p\b[^>]*>|<\/p>/)) {
    if (/<\/div>\s*<\/div>|class="disclaimer"|transcripts are created/i.test(raw) && lines.length) break;
    const t = voaTxt(raw); if (!t || t === "Transcript" || /^\[[^\]]*\]$/.test(t) || /^(Copyright|NPR transcripts are)/i.test(t)) continue;
    const m = t.match(/^([A-Z][A-Z.'\- ]{1,40}?(?:, [A-Z ]{2,30})?)(?: \([^)]{1,40}\))?: (.+)$/);
    if (m) lines.push({ who: m[1].trim(), t: m[2].trim() }); else if (lines.length) lines.push({ who: lines[lines.length - 1].who, t }); else lines.push({ who: "", t });
  }
  let intro = voaTxt((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ""); if (/NPR\+|sponsor|Support public media/i.test(intro)) intro = ""; // 有的只是广告词
  return { lines: lines.filter(l => l.t.replace(/\[[^\]]*\]/g, "").trim()), intro };
}
// Breaking News English：首页 / 存档页 → 文章 [{base:"2611/261119-gta-6", t, d, img, k:"e" 简单篇 | "h" 进阶篇 | "" 没写}]
function bneIndex(html) {
  const out = [], seen = new Set();
  for (const m of html.matchAll(/<h3><a href="(\d{4}\/(\d\d)(\d\d)(\d\d)-[a-z0-9-]{1,80})\.html"([^>]*)>([^<]+)<\/a>/g)) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    const k = /elementary|pre-intermediate/i.test(m[5]) ? "e" : /intermediate level and above|upper-intermediate|advanced/i.test(m[5]) ? "h" : "";
    out.push({ base: m[1], t: voaTxt(m[6]), d: new Date(Date.UTC(2000 + +m[2], +m[3] - 1, +m[4])).toUTCString().slice(5, 16), img: BNE + m[1] + ".jpg", k });
  }
  return out;
}
const bneFile = (base, lv) => BNE + base + (lv === 3 || lv === 6 ? "" : "-" + lv); // Level 3（简单篇）/ 6（进阶篇）就是文章本页
async function bneArts(env, UA) {
  const kv = env.CAPTIONS, hit = await kv.get("bne/arts", "json"); if (hit && Date.now() - hit.at < 2 * 3600e3) return hit.arts; // 2 小时（以前 6 小时，加上列表缓存，新文章最晚半天才出现）
  const home = await fetch(BNE, { headers: UA }).then(r => (r.ok ? r.text() : "")).catch(() => "");
  const arc = (home.match(/href="(\d{4}-\d{4}\.html)"/g) || []).map(x => x.slice(6, -1)).sort().pop();
  const arts = bneIndex(home); if (arc) { const h2 = await fetch(BNE + arc, { headers: UA }).then(r => (r.ok ? r.text() : "")).catch(() => ""); bneIndex(h2).forEach(a => { if (!arts.some(b => b.base === a.base)) arts.push(a); }); }
  let n = 0;
  for (const a of arts) { // 存档页没写是简单篇还是进阶篇：有没有 Level 0 页面（结果长期存着，一篇只问一次）
    if (a.k) continue; const c = await kv.get("bne/k/" + a.base); if (c) { a.k = c; continue; } if (++n > 30) continue;
    const r = await fetch(BNE + a.base + "-0.html", { method: "HEAD", headers: UA }).catch(() => null); if (!r) continue;
    a.k = r.ok ? "e" : r.status === 403 || r.status === 404 ? "h" : ""; if (a.k) await cput(kv, "bne/k/" + a.base, a.k, r.status === 403 ? { expirationTtl: 7 * 86400 } : undefined); // 403 也可能是临时被拦：只记 7 天
  }
  if (!arts.length) return hit ? hit.arts : [];
  await cput(kv, "bne/arts", JSON.stringify({ at: Date.now(), arts })); return arts;
}
// 一篇的某一级：<article> 里的正文（两段，<br><br> 分开）→ 按句子分行
function bneParse(html) {
  const a = (html.match(/<article>([\s\S]*?)<\/article>/) || [])[1] || "";
  const title = voaTxt((html.match(/The Reading \/ Listening - ([\s\S]*?) - Level \d/) || [])[1] || "");
  const lines = [];
  a.split(/<br\s*\/?>\s*<br\s*\/?>|<\/p>/i).map(voaTxt).filter(Boolean).forEach((para, pi) => {
    (para.match(/[^.!?]+(?:[.!?]+["”’']?|$)/g) || [para]).map(x => x.trim()).filter(Boolean).forEach(t => lines.push({ who: "", t, par: pi }));
  });
  // 引号里的句号别拆开：前一句以引号开头没结束（左右引号数不一样）就并回去
  const out = []; for (const l of lines) { const prev = out[out.length - 1]; if (prev && prev.par === l.par && ((prev.t.match(/"/g) || []).length % 2 === 1)) prev.t += " " + l.t; else out.push(l); }
  return { title, lines: out.map(l => ({ who: "", t: l.t })) };
}
// 一批英文句子 → 一样多的中文：按行拼起来（每段不超过 1500 字）交给谷歌翻译，行数对不上就拆小再试
// Workers AI 翻译（不靠谷歌）：大模型一次翻 20 句（一次请求最多 50 个外部调用，一句一句翻会超）；没翻出来的再用翻译模型 m2m100 单句补（最多 12 句）
async function aiTrans(env, arr, idx, sl) {
  const SL = sl === "de" ? "German" : "English";
  const out = {}; if (!env.AI || !idx.length) return out;
  const B = []; for (let k = 0; k < idx.length && k < 200; k += 20) B.push(idx.slice(k, k + 20));
  for (let k = 0; k < B.length; k += 4) await Promise.all(B.slice(k, k + 4).map(async part => {
    let got = null;
    await aiJson(env, [{ role: "system", content: 'Translate each ' + SL + ' text into natural Simplified Chinese. Reply with ONLY JSON {"zh":[...]} with exactly one Chinese string per input, same order.' }, { role: "user", content: JSON.stringify(part.map(i => clip(arr[i], 800))) }],
      o => Array.isArray(o && o.zh) && o.zh.length === part.length && o.zh.every(x => typeof x === "string") && !!(got = o.zh), 3000).catch(() => null);
    if (got) part.forEach((i, n) => { if (got[n].trim() && /[\u4e00-\u9fff]/.test(got[n])) out[i] = got[n].trim(); });
  }));
  const left = idx.filter(i => !out[i]).slice(0, 12);
  const one = async i => { try { const r = await env.AI.run("@cf/meta/m2m100-1.2b", { text: clip(arr[i], 1000), source_lang: sl === "de" ? "de" : "en", target_lang: "zh" }); const t = r && String(r.translated_text || "").trim(); if (t && t !== arr[i].trim()) out[i] = t; } catch (e) {} };
  for (let k = 0; k < left.length; k += 5) await Promise.all(left.slice(k, k + 5).map(one));
  return out;
}
async function smeZh(arr, env, sl) {
  const out = arr.map(() => "");
  async function run(idx, depth) {
    const text = idx.map(i => arr[i].replace(/\s+/g, " ")).join("\n"), j = await gtrans(text, "zh-CN", false, sl);
    const zh = j ? (j.sentences || []).map(x => x.trans || "").join("").split("\n").map(x => x.trim()) : [];
    if (zh.length === idx.length) { idx.forEach((i, k) => { out[i] = zh[k]; }); return; }
    if (idx.length === 1) { out[idx[0]] = zh.join(" ").trim(); return; }
    if (!j) return; // 整个没翻成（谷歌拦了）：别拆开再试，一次请求只有 50 个外部调用，留给后面的 Workers AI
    if (depth < 3) { const h = Math.ceil(idx.length / 2); await run(idx.slice(0, h), depth + 1); await run(idx.slice(h), depth + 1); }
  }
  const chunks = []; let cur = [], len = 0;
  arr.forEach((s, i) => { if (!s) return; if (cur.length && len + s.length > 1500) { chunks.push(cur); cur = []; len = 0; } cur.push(i); len += s.length + 1; });
  if (cur.length) chunks.push(cur);
  for (let i = 0; i < chunks.length; i += 4) await Promise.all(chunks.slice(i, i + 4).map(c => run(c, 0).catch(() => {})));
  const miss = arr.map((t, i) => (t && !out[i] ? i : -1)).filter(i => i >= 0); // 谷歌没翻出来的：用 Workers AI 补
  if (miss.length && env) { const a = await aiTrans(env, arr, miss, sl); for (const i in a) out[i] = a[i]; }
  return out;
}
// GET /api/sme?al=<期号>&part=N → { ok, part, parts, total, words:[[词, 开始秒, 结束秒]] }：逐句精听用的「每个词在第几秒」
//   把这一期的 mp3 按 1MB 一段（约 1 分钟）切开交给 Workers AI Whisper（每分钟约 47 neurons，一期约 300），时间从这一段开头算；
//   网页（listen.js）按 段号 × 1MB ÷ 文件大小 × 总时长 换成整期的时间，再和文稿逐词对齐。每段结果存 KV「sme/al/<期号>/<段号>」180 天（家里人共用，只花一次）
const AL_PART = 1000000;
async function smeAlign(env, u) {
  const ep = u.searchParams.get("al") || "", part = Math.max(0, Math.min(40, +u.searchParams.get("part") || 0));
  if (!smeOf(ep)) return json({ ok: false, error: "bad ep" }, 400);
  return alignPart(env, "sme/al/" + ep + "/" + part, "sme/ep/" + ep, part, "en");
}
// 把一期 mp3 的第 part 段（1MB）交给 Whisper，存 KV（BBC 英语、DW 德语共用）
async function alignPart(env, key, epKey, part, lang) {
  const kv = env.CAPTIONS;
  const hit = await kv.get(key, "json"); if (hit) return json(Object.assign({ ok: true, cached: true }, hit));
  if (!env.AI) return json({ ok: false, error: "noai" }, 503);
  const x = await kv.get(epKey, "json"); if (!x || !x.mp3) return json({ ok: false, error: "open the episode first" }, 409);
  try {
    const r = await fetch(x.mp3, { headers: { Range: "bytes=" + part * AL_PART + "-" + ((part + 1) * AL_PART - 1) } });
    if (r.status !== 206 && r.status !== 200) return json({ ok: false, error: "mp3 " + r.status }, 502);
    let buf = new Uint8Array(await r.arrayBuffer()), total = +((r.headers.get("content-range") || "").split("/")[1]) || 0;
    if (r.status === 200) { total = buf.length; buf = buf.subarray(part * AL_PART, (part + 1) * AL_PART); } // 不支持分段下载：整份下来自己切
    const parts = Math.max(1, Math.ceil(total / AL_PART)); if (!buf.length) return json({ ok: false, error: "past end", parts }, 400);
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    const o = await env.AI.run("@cf/openai/whisper-large-v3-turbo", { audio: btoa(bin), language: lang });
    const words = [];
    for (const sg of (o && o.segments) || []) {
      if (Array.isArray(sg.words) && sg.words.length) sg.words.forEach(w => words.push([String(w.word || "").trim(), Math.round((+w.start || 0) * 100) / 100, Math.round((+w.end || 0) * 100) / 100]));
      else String(sg.text || "").trim().split(/\s+/).forEach((w, i, a) => { const st = +sg.start || 0, d = ((+sg.end || st) - st) / a.length; words.push([w, Math.round((st + d * i) * 100) / 100, Math.round((st + d * (i + 1)) * 100) / 100]); }); // 没有逐词时间：按段内平均分
    }
    if (!words.length) return json({ ok: false, error: "no words" }, 502);
    const out = { part, parts, total, words: words.filter(w => w[0]) };
    if (part === 0 && buf[0] === 73 && buf[1] === 68 && buf[2] === 51) out.id3 = 10 + ((buf[6] & 127) << 21 | (buf[7] & 127) << 14 | (buf[8] & 127) << 7 | (buf[9] & 127)); // 文件开头的 ID3 标签（封面图等）不是声音：换算时间时要扣掉
    await cput(kv, key, JSON.stringify(out), { expirationTtl: 180 * 86400 });
    return json(Object.assign({ ok: true }, out));
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 502); }
}
// ---------- 🇩🇪 德国之声 DW「Langsam gesprochene Nachrichten」慢速德语新闻（🧩 练习课的德语素材） ----------
// GET /api/dw?list=1 → { ok, list:[{id, t, d, img}] }（KV dw/list 3 小时）
// GET /api/dw?ep=<文章号> → { ok, id, title, mp3, lines:[{who 新闻标题, t 正文}], vocab:[] }（KV dw/ep/<号> 一年）
// GET /api/dw?ep=<号>&zh=1 → { ok, lines:[中文] }（谷歌 → Workers AI，KV dw/zh/<号> 一年，家里人共用）
// GET /api/dw?al=<号>&part=N → 和 /api/sme?al= 一样（Whisper 德语）
const DW_UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "Accept": "text/html" };
const dwTxt = h => String(h || "").replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&#160;|&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
function dwParse(id, h) {
  const title = dwTxt((h.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").replace(/\s*\|.*$/, "");
  const mp3 = (h.match(/<source src="(https:\/\/radiodownloaddw-a\.akamaihd\.net\/[^"]+?langsamenachrichten\/[^"]+?\.mp3)"/) || h.match(/"(https:\/\/radiodownloaddw-a\.akamaihd\.net\/[^"]+?langsamenachrichten\/[^"]+?\.mp3)"/) || [])[1] || "";
  const i = h.indexOf('data-testid="richtext-content-container"'), body = i < 0 ? "" : h.slice(i, h.indexOf("</article>", i) > 0 ? h.indexOf("</article>", i) : i + 60000);
  const lines = []; let who = "";
  for (const m of body.matchAll(/<(h2|p)[^>]*>([\s\S]*?)<\/\1>/g)) { const t = dwTxt(m[2]); if (!t) continue; if (m[1] === "h2") who = t; else lines.push({ who, t }); }
  return { id, title, mp3, lines, vocab: [] };
}
async function dw(req, env, u) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const kv = env.CAPTIONS, q = k => u.searchParams.get(k) || "";
  const id = q("ep") || q("al"); if (id && !/^\d{5,10}$/.test(id)) return json({ ok: false, error: "bad id" }, 400);
  try {
    if (q("al")) return alignPart(env, "dw/al/" + id + "/" + Math.max(0, Math.min(40, +q("part") || 0)), "dw/ep/" + id, Math.max(0, Math.min(40, +q("part") || 0)), "de");
    if (q("list")) {
      const hit = await kv.get("dw/list", "json"); if (hit && Date.now() - hit.at < 3 * 3600e3) return json({ ok: true, list: hit.list, cached: true });
      const r = await fetch("https://learngerman.dw.com/de/langsam-gesprochene-nachrichten/s-60040332", { headers: DW_UA });
      if (!r.ok) { if (hit) return json({ ok: true, list: hit.list, stale: true }); return json({ ok: false, error: "dw " + r.status }, 502); }
      const h = await r.text(), seen = {}, list = [];
      for (const m of h.matchAll(/href="\/de\/(\d{2})(\d{2})(\d{4})-langsam-gesprochene-nachrichten\/a-(\d+)"/g)) { if (seen[m[4]]) continue; seen[m[4]] = 1; list.push({ id: m[4], t: "Nachrichten vom " + m[1] + "." + m[2] + "." + m[3], d: m[3] + "-" + m[2] + "-" + m[1], img: "" }); }
      list.sort((a, b) => (a.d < b.d ? 1 : -1));
      if (!list.length) return json({ ok: false, error: "no episodes" }, 502);
      await cput(kv, "dw/list", JSON.stringify({ at: Date.now(), list }));
      return json({ ok: true, list });
    }
    if (!id) return json({ ok: false, error: "need list / ep / al" }, 400);
    let ep = await kv.get("dw/ep/" + id, "json");
    if (!ep) {
      const r = await fetch("https://learngerman.dw.com/de/x/a-" + id, { headers: DW_UA }); if (!r.ok) return json({ ok: false, error: "dw " + r.status }, 502);
      ep = dwParse(id, await r.text()); if (!ep.mp3 || !ep.lines.length) return json({ ok: false, error: "这一期不是慢速新闻（没有音频或文稿）" }, 404);
      await cput(kv, "dw/ep/" + id, JSON.stringify(ep), { expirationTtl: 365 * 86400 });
    }
    if (q("zh")) {
      const hit = await kv.get("dw/zh/" + id, "json"); if (hit) return json({ ok: true, lines: hit, cached: true });
      const zh = await smeZh(ep.lines.map(l => l.t), env, "de");
      if (zh.every(Boolean)) await cput(kv, "dw/zh/" + id, JSON.stringify(zh), { expirationTtl: 365 * 86400 });
      return json({ ok: zh.some(Boolean), lines: zh });
    }
    return json(Object.assign({ ok: true }, ep));
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 502); }
}
// 🇩🇪 「📻 听力节目」学德语时的栏目 s=dw：DW「Langsam gesprochene Nachrichten」（慢速新闻），期号 dw/<文章号>；
//   数据就是 /api/dw 的（同一份 KV 缓存），这里换成 /api/sme 的样子，听力页不用分两套
const DW_MP3 = /^https:\/\/radiodownloaddw-a\.akamaihd\.net\/[^?#]+\.mp3$/;
async function smeDw(req, env, u) {
  const q = k => u.searchParams.get(k) || "", num = v => (/^dw\/(\d{5,10})$/.exec(v || "") || [])[1] || "";
  const call = async qs => { const r = await dw(req, env, new URL("https://x/api/dw?" + qs)); return { status: r.status, j: await r.json() }; };
  if (q("s") === "dw" && !q("ep")) { const { status, j } = await call("list=1"); if (!j.ok) return json(j, status); return json({ ok: true, s: "dw", list: (j.list || []).map(x => ({ id: "dw/" + x.id, t: x.t, d: x.d, p: "", img: "" })) }); } // p 是简介（BBC 的有），DW 列表没有
  if (q("al")) { const id = num(q("al")); if (!id) return json({ ok: false, error: "bad id" }, 400); const { status, j } = await call("al=" + id + "&part=" + (+q("part") || 0)); return json(j, status); }
  if (q("mp3")) { // 📥 离线下载：同 BBC，只转打开过的那期
    const id = num(q("mp3")), x = id && (await env.CAPTIONS.get("dw/ep/" + id, "json"));
    if (!x || !DW_MP3.test(x.mp3 || "")) return json({ ok: false, error: "open the episode first" }, 409);
    const r = await fetch(x.mp3); if (!r.ok) return json({ ok: false, error: "mp3 " + r.status }, 502);
    return new Response(r.body, { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400", ...(r.headers.get("content-length") ? { "content-length": r.headers.get("content-length") } : {}) } });
  }
  const id = num(q("ep")); if (!id) return json({ ok: false, error: "bad ep" }, 400);
  if (q("zh")) {
    if (q("co")) { const hit = await env.CAPTIONS.get("dw/zh/" + id, "json"); return json(hit ? { ok: true, id: "dw/" + id, intro: "", q: [], vocab: [], vex: [], heads: [], lines: hit, cached: true } : { ok: false, error: "not cached" }); }
    const { status, j } = await call("zh=1&ep=" + id); return json(j.ok ? { ok: true, id: "dw/" + id, intro: "", q: [], vocab: [], vex: [], heads: [], lines: j.lines } : j, status);
  }
  const { status, j } = await call("ep=" + id); if (!j.ok) return json(j, status);
  return json({ ok: true, id: "dw/" + id, s: "dw", url: "https://learngerman.dw.com/de/x/a-" + id, title: j.title, mp3: j.mp3, intro: "", q: [], vocab: [], heads: [], lines: j.lines });
}
async function sme(req, env, u, ctx) {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (u.searchParams.get("s") === "dw" || /^dw\//.test(u.searchParams.get("ep") || u.searchParams.get("al") || u.searchParams.get("mp3") || "")) return smeDw(req, env, u);
  if (u.searchParams.get("al")) return smeAlign(env, u);
  if (u.searchParams.get("mp3")) { // 📥 离线下载：BBC 的 mp3 没开跨域，这里转一手（只转打开过的那几期、只转 downloads.bbc.co.uk / voa-audio.voanews.eu）
    const x = await env.CAPTIONS.get("sme/ep/" + u.searchParams.get("mp3"), "json");
    if (!x || !/^https:\/\/(downloads\.bbc\.co\.uk|voa-audio\.voanews\.eu|voa-video\.voanews\.eu|npr\.simplecastaudio\.com|breakingnewsenglish\.com)\/[^?#]+\.mp3$/.test(x.mp3 || "")) return json({ ok: false, error: "open the episode first" }, 409);
    const r = await fetch(x.mp3); if (!r.ok) return json({ ok: false, error: "mp3 " + r.status }, 502);
    return new Response(r.body, { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400", ...(r.headers.get("content-length") ? { "content-length": r.headers.get("content-length") } : {}) } });
  }
  const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "Accept": "text/html" };
  const BASE = "https://www.bbc.co.uk/learningenglish/english/features/", ep = u.searchParams.get("ep") || "", fresh = await freshOf(req, u, env.CAPTIONS);
  if (ep) {
    const s = smeOf(ep); if (!s) return json({ ok: false, error: "bad ep" }, 400);
    const key = "sme/ep/" + ep; let x = fresh ? null : await env.CAPTIONS.get(key, "json");
    if (!x) {
      try {
        const S = SME_S[s], sub = ep.slice(s.length + 1);
        if (S.npr) { // 目录里有 mp3、标题、日期；文稿另取
          const lk = "sme/list/" + s; let L = await env.CAPTIONS.get(lk, "json"), it = L && (L.list || []).find(i => i.id === ep);
          if (!it) { const lst = nprIndex(await nprFeed(S.npr, 200), s); it = lst.find(i => i.id === ep); }
          if (!it) return json({ ok: false, error: "not in feed" }, 404);
          const url = "https://www.npr.org/transcripts/" + sub, r = await fetch(url, { headers: UA }); if (!r.ok) return json({ ok: false, error: "http " + r.status }, 502);
          const p = nprParse(await r.text()); if (p.lines.length < 6) return json({ ok: false, error: "no transcript yet" }, 404); // 新节目的文稿 NPR 晚一两天才放：别存，下次再试
          x = { ok: true, id: ep, s, url, title: it.t, mp3: it.mp3, intro: p.intro, q: [], vocab: [], heads: [], lines: p.lines };
        } else if (S.bne != null) {
          const url = bneFile(sub, S.bne) + ".html", r = await fetch(url, { headers: UA }); if (!r.ok) return json({ ok: false, error: r.status === 403 || r.status === 404 ? "no such level" : "http " + r.status }, 502);
          const p = bneParse(await r.text()); if (p.lines.length < 4) return json({ ok: false, error: "no transcript" }, 502);
          x = { ok: true, id: ep, s, url, title: p.title, mp3: bneFile(sub, S.bne) + ".mp3", intro: "", q: [], vocab: [], heads: [], lines: p.lines };
        } else {
          const src = S.voa ? VOA + "/a/" + sub + ".html" : BASE + ep;
          const r = await fetch(src, { headers: UA }); if (!r.ok) return json({ ok: false, error: "http " + r.status }, 502);
          const p = S.voa ? voaParse(await r.text()) : smeParse(await r.text()); if (!p.mp3 || (p.lines.length < 6 && !(s === "news" && (p.intro || p.vocab.length)))) return json({ ok: false, error: "no transcript" }, 502);
          x = { ok: true, id: ep, s, url: S.voa ? r.url || src : BASE + ep, ...p };
        }
        await cput(env.CAPTIONS, key, JSON.stringify(x), { expirationTtl: 90 * 86400 });
      } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 502); }
    }
    if (!u.searchParams.get("zh")) return json(x);
    const zk = "sme/zh/" + ep; if (!fresh) { const c = await env.CAPTIONS.get(zk, "json"); if (c) return json(c); }
    if (u.searchParams.get("co")) return json({ ok: false, error: "not cached" }); // 只要存好的：网页先自己在浏览器里翻（快、不花额度）
    const q = x.q || [], V = x.vocab || [], H = x.heads || [], Ls = x.lines || [];
    const all = [x.intro || "", ...q, ...V.map(v => v[1] || ""), ...V.map(v => v[2] || ""), ...H.map(h => h[0]), ...Ls.map(l => l.t)];
    const zh = await smeZh(all, env); let i = 1; const take = n => { const r = zh.slice(i, i + n); i += n; return r; };
    const out = { ok: true, id: ep, intro: zh[0], q: take(q.length), vocab: take(V.length), vex: take(V.length), heads: take(H.length), lines: take(Ls.length) };
    const got = zh.filter(Boolean).length; if (!got) return json({ ok: false, error: "translate failed" }, 502);
    if (got >= all.filter(Boolean).length * 0.9) await cput(env.CAPTIONS, zk, JSON.stringify(out), { expirationTtl: 180 * 86400 }); // 大部分翻好了才存，没翻全的下次再试
    return json(out);
  }
  const s = SME_S[u.searchParams.get("s") || "sme"] ? (u.searchParams.get("s") || "sme") : "", S = SME_S[s]; if (!S) return json({ ok: false, error: "bad s" }, 400);
  const lk = s === "sme" ? "sme/list" : "sme/list/" + s;
  // 列表缓存：先马上给存着的；存了超过一段时间（分级新闻 / NPR 2 小时、BBC 每周的 3 小时）就在后台重新抓一次，下次打开就是新的
  //   （以前直接存 6–12 小时，分级新闻的文章索引还另外缓存 6 小时，新出的一期最晚要半天才看得到）；不再更新的栏目（广播剧、VOA…）一周
  const ttl = S.story || S.voa ? 7 * 86400 : 2 * 86400, stale = S.story || S.voa ? 7 * 86400e3 : S.npr || S.bne != null ? 2 * 3600e3 : 3 * 3600e3;
  if (!fresh) {
    const c = await env.CAPTIONS.get(lk, "json");
    const busy = Date.now() - (SME_BUSY[lk] || 0) < 60e3 || Date.now() < (SME_FAIL[lk] || 0); // 正在后台抓（最多算 1 分钟，卡住也会放开）/ 刚抓失败，10 分钟内不再打上游
    if (c && !(Date.now() - (+c.at || 0) > stale && ctx && ctx.waitUntil && !busy)) return json(c);
    if (c) { SME_BUSY[lk] = Date.now(); ctx.waitUntil(smeList(env, s, S, lk, ttl).then(r => { if (!r) SME_FAIL[lk] = Date.now() + 600e3; }, () => { SME_FAIL[lk] = Date.now() + 600e3; }).finally(() => { delete SME_BUSY[lk]; })); return json(c); }
  }
  const out = await smeList(env, s, S, lk, ttl);
  return out ? json(out) : json({ ok: false, error: "no list" }, 502);
}
const SME_BUSY = {}, SME_FAIL = {};
// 抓一个栏目的期数列表、排好序、存进 KV（带抓的时间 at）
async function smeList(env, s, S, lk, ttl) {
  const BASE = "https://www.bbc.co.uk/learningenglish/english/features/", UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" };
  const y = +newsDay().slice(0, 4), seen = new Set(), seenT = new Set(), list = [];
  const add = i => { const tk = i.t.toLowerCase(); if (seen.has(i.id) || (S.story && seenT.has(tk)) || (S.skip && S.skip.test(i.id))) return; seen.add(i.id); seenT.add(tk); list.push(i); }; // 广播剧同一集有两个地址（alice-ep01 / aliceinwonderland-ep01）：按标题去重
  if (S.voa) { const pages = await Promise.all([0, 1, 2, 3, 4].map(p => fetch(VOA + "/z/" + S.voa + (p ? "?p=" + p : ""), { headers: UA }).then(r => (r.ok ? r.text() : "")).catch(() => ""))); pages.forEach(h => voaIndex(h, s).forEach(add)); }
  else if (S.npr) { try { nprIndex(await nprFeed(S.npr, 60), s).slice(0, 60).forEach(add); } catch (e) {} }
  else if (S.bne != null) { try { (await bneArts(env, UA)).filter(a => a.k === (S.bne <= 3 ? "e" : "h")).forEach(a => add({ id: s + "/" + a.base, t: a.t, d: a.d, img: a.img, p: "" })); } catch (e) {} }
  else for (const page of S.yearly ? Array.from({ length: Math.max(2, y - (S.from || y - 1) + 1) }, (_, k) => S.slug + "_" + (y - k)) : [S.slug]) { // 每周的栏目：今年往前一直到 from 年
    try { const r = await fetch(BASE + page, { headers: UA }); if (r.ok) smeIndex(await r.text(), S.slug, S.idp).forEach(add); } catch (e) {}
  }
  if (!list.length) return null;
  if (S.story) { const st = storySort(list); list.length = 0; list.push(...st); }
  else if (S.voa || S.npr || S.bne != null) list.sort((p, q) => (Date.parse(q.d) || 0) - (Date.parse(p.d) || 0));
  else { const idk = x => (x.id.match(/\d{6}$/) || [""])[0]; list.sort((p, q) => (Date.parse(q.d) || 0) - (Date.parse(p.d) || 0) || idk(q).localeCompare(idk(p))); } // BBC 每周的：按页面上写的日期，新的在前（期号不一定对：ep-261122 其实是 11 月 12 日的）
  const out = { ok: true, s, at: Date.now(), list: list.slice(0, 300) }; await cput(env.CAPTIONS, lk, JSON.stringify(out), { expirationTtl: ttl }); return out;
}

// ---------- AI（Cloudflare Workers AI，免费额度每天 1 万 neurons；要在 Pages 项目「设置 → 绑定」里加 Workers AI，变量名 AI）----------
// POST /api/ai {task:"write", type:t1|t2|mail|free, prompt, text} → { ok, band:{TR,CC,LR,GRA,overall}, summary_zh, strengths_zh:[], improve_zh:[], rewrite }；没开 AI 时 { ok:false, error:"noai" }
// POST /api/stt（请求体就是录音文件）→ { ok, text }：跟读打分用（Whisper 语音转文字）
const AI_MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-4-scout-17b-16e-instruct"]; // 备用：原来的 llama-3.1-8b-instruct 2026-05-30 下线了
// 🇩🇪 学德语（请求里 lang:"de"）：下面每个提示词都有德语版；返回的 JSON 结构和英语完全一样（字段名 en 里放德语），网页不用分两套解析
//   德语评分不用雅思：每项 0–25 分（同歌德 / telc 的四项），总分 0–100（60 及格），另给一个 CEFR 估计
const isDe = b => b && b.lang === "de";
const DE_WHO = "The learner is a Chinese native speaker learning German (beginner to intermediate, about CEFR A1-B1), living in Kuala Lumpur, Malaysia, working as a software developer. Their words come from speech recognition, so ignore capitalisation, punctuation and obvious mis-hearings; never comment on pronunciation.";
const DE_RULE = "Always write correct, natural, modern Standard German as spoken in Germany (correct ä/ö/ü/ß, noun capitalisation, articles, cases, verb position).";
const WRITE_SYS_DE = `You are a strict, experienced examiner for German as a foreign language (Goethe-Zertifikat / telc, levels A2-B1). Assess the candidate's German text with the four criteria used in those exams, each scored 0-25 points: Erfüllung der Aufgabe (TR), Kohärenz (CC), Wortschatz (LR), Strukturen / grammatische Richtigkeit (GRA). Be realistic for learners. ${DE_RULE}
Reply with ONLY one JSON object, no markdown, exactly in this shape:
{"band":{"TR":0,"CC":0,"LR":0,"GRA":0,"overall":0},"cefr":"A2","summary_zh":"2-3 sentences in Simplified Chinese","strengths_zh":["..."],"improve_zh":["specific, actionable advice in Simplified Chinese; quote the original German phrase and give a corrected / better German version"],"rewrite":"an improved version of the whole answer in German, same ideas and similar length, at about one CEFR level above the candidate"}
Give 2-4 strengths_zh and 3-6 improve_zh. Each of TR/CC/LR/GRA is an integer 0-25; overall = their sum (0-100). cefr is your estimate of the text's level (A1, A2, B1, B2 or C1).`;
const WRITE_SYS = `You are a strict, experienced IELTS writing examiner. Assess the candidate's answer using the official IELTS Writing band descriptors (Task Response / Task Achievement, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy). Use half bands (e.g. 6.5). Be realistic: most learner essays score 5.0-7.0; penalise answers under the word limit or off topic.
Reply with ONLY one JSON object, no markdown, exactly in this shape:
{"band":{"TR":0,"CC":0,"LR":0,"GRA":0,"overall":0},"summary_zh":"2-3 sentences in Simplified Chinese","strengths_zh":["..."],"improve_zh":["specific, actionable advice in Simplified Chinese; quote the original phrase and give a better English version"],"rewrite":"an improved version of the whole answer in English, same ideas and similar length, band 8 level"}
Give 2-4 strengths_zh and 3-6 improve_zh. overall = mean of the four, rounded to the nearest half band.`;
// 口语（web/speak.js）：AI 陪练聊天、聊完总结、话题回答点评。学习者：中文母语、住吉隆坡、程序员、英语约 B1
const SPEAK_WHO_EN = "The learner is a Chinese native speaker (about CEFR B1) living in Kuala Lumpur, Malaysia, working as a software developer. Their words come from speech recognition, so ignore capitalisation, punctuation and obvious mis-hearings; never comment on pronunciation.";
const SPEAK_WHO = SPEAK_WHO_EN;
const CHAT_SYS_DE = scene => `You are a friendly, natural German conversation partner (Gesprächspartner). ${DE_WHO}
Situation: ${scene || "casual chat about daily life, work or hobbies"}. Stay in character for this situation. ${DE_RULE} The learner imitates you, so never use broken German or dialect.
Reply in natural spoken German, 1-2 short sentences (under 25 words), simple (A2 level: common words, short main clauses), and usually end with a question to keep the conversation going. Use "du" in casual situations and "Sie" with strangers, staff or officials, as a German would.
Also check the learner's LAST message for a clear grammar or word-choice mistake (gender/article, case, verb position, conjugation, wrong word; not style, not punctuation, not capitalisation).
Reply with ONLY one JSON object, no markdown: {"reply":"your reply in German","fix":null}  or, if the last learner message had a real mistake: {"reply":"...","fix":{"bad":"the wrong part they said","good":"the corrected German","why_zh":"一句简体中文解释"}}`;
const CHAT_SYS = scene => `You are a friendly, natural English conversation partner. ${SPEAK_WHO}
Situation: ${scene || "casual chat about daily life, work or hobbies"}. Stay in character for this situation, but always speak correct, natural English (never broken English or local slang the learner might copy), because the learner imitates you.
Reply in natural spoken American English, 1-2 short sentences (under 30 words), simple enough for B1, and usually end with a question to keep the conversation going.
Also check the learner's LAST message for a clear grammar or word-choice mistake (not style, not punctuation).
Reply with ONLY one JSON object, no markdown: {"reply":"your reply","fix":null}  or, if the last learner message had a real mistake: {"reply":"...","fix":{"bad":"the wrong part they said","good":"the corrected version","why_zh":"一句简体中文解释"}}`;
const CHATSUM_SYS = `You are an English speaking coach. ${SPEAK_WHO} Review the whole conversation (the learner is "user").
Reply with ONLY one JSON object, no markdown:
{"summary_zh":"2-3 sentences in Simplified Chinese: how they did overall","good_zh":["things they did well, Simplified Chinese"],"fixes":[{"bad":"what they said","good":"correct / more natural version","why_zh":"简体中文解释"}],"phrases":[{"en":"a useful natural expression for this situation they could use next time","zh":"中文"}]}
Give 1-3 good_zh, up to 6 fixes (only real problems, most important first), and 4-6 phrases.`;
const CHATSUM_SYS_DE = `You are a German speaking coach. ${DE_WHO} ${DE_RULE} Review the whole conversation (the learner is "user").
Reply with ONLY one JSON object, no markdown:
{"summary_zh":"2-3 sentences in Simplified Chinese: how they did overall","good_zh":["things they did well, Simplified Chinese"],"fixes":[{"bad":"what they said","good":"correct / more natural German","why_zh":"简体中文解释（性、格、词序、变位……）"}],"phrases":[{"en":"a useful natural German expression for this situation they could use next time","zh":"中文"}]}
Give 1-3 good_zh, up to 6 fixes (only real problems, most important first), and 4-6 phrases.`;
const SPEAKRATE_SYS_DE = `You are a strict, experienced examiner for spoken German as a foreign language (Goethe-Zertifikat / telc, A2-B1). ${DE_WHO}
Assess the transcript of their spoken answer to the question with three criteria, each an integer 0-25 points: Flüssigkeit und Kohärenz (FC), Wortschatz (LR), Strukturen / grammatische Richtigkeit (GRA). You cannot hear pronunciation, so do not score it. Be realistic for learners. ${DE_RULE}
Reply with ONLY one JSON object, no markdown:
{"band":{"FC":0,"LR":0,"GRA":0,"overall":0},"cefr":"A2","summary_zh":"2-3 sentences in Simplified Chinese","strengths_zh":["..."],"fixes":[{"bad":"exact phrase they said","good":"correct / better German","why_zh":"简体中文解释"}],"better":"an improved version of their answer in natural spoken German, same ideas, about 70-120 words, about one CEFR level above the candidate","better_zh":"中文翻译"}
Give 1-3 strengths_zh and 3-6 fixes. overall = round((FC+LR+GRA)/75*100), i.e. 0-100. cefr is your estimate (A1, A2, B1, B2).`;
const SPEAKRATE_SYS = `You are a strict, experienced IELTS speaking examiner. ${SPEAK_WHO}
Assess the transcript of their spoken answer to the question, using IELTS Speaking band descriptors for Fluency and Coherence (FC), Lexical Resource (LR) and Grammatical Range and Accuracy (GRA); you cannot hear pronunciation, so do not score it. Use half bands. Be realistic: short or simple answers score 4.5-6.0.
Reply with ONLY one JSON object, no markdown:
{"band":{"FC":0,"LR":0,"GRA":0,"overall":0},"summary_zh":"2-3 sentences in Simplified Chinese","strengths_zh":["..."],"fixes":[{"bad":"exact phrase they said","good":"better English","why_zh":"简体中文解释"}],"better":"an improved version of their answer, spoken style, same ideas, about 110-150 words, band 7.5 level","better_zh":"中文翻译"}
Give 1-3 strengths_zh and 3-6 fixes. overall = mean of the three, rounded to the nearest half band.`;
const HOWTO_SYS = `You help a Chinese learner say things in natural English. ${SPEAK_WHO}
They give you something in Chinese (or mixed Chinese/English). Translate the WHOLE meaning into natural spoken English, keeping every detail (who, what, when, words like "bug" or "boss"). Use normal capitalisation and punctuation.
Give three versions: casual (随意), neutral (中性), formal (正式). note_zh says in a few Chinese words when to use it.
Example. Input: 不好意思，能帮我打包吗
Output: {"items":[{"reg":"随意","en":"Sorry, can I get this to go?","note_zh":"在小店、mamak 随口说"},{"reg":"中性","en":"Excuse me, could you pack this up for me?","note_zh":"餐厅里礼貌地说"},{"reg":"正式","en":"Excuse me, would it be possible to have this packed to take away?","note_zh":"高级餐厅、很客气"}],"words":[{"en":"to go","zh":"打包带走"},{"en":"pack up","zh":"打包"}]}
Reply with ONLY one JSON object in exactly that shape, no markdown.`;
const HOWTO_SYS_DE = `You help a Chinese learner say things in natural German. ${DE_WHO} ${DE_RULE}
They give you something in Chinese (or mixed Chinese/English/German). Translate the WHOLE meaning into natural spoken German, keeping every detail (who, what, when). Use normal capitalisation and punctuation.
Give three versions: casual (随意, with du / among friends), neutral (中性, polite everyday, usually Sie), formal (正式, very polite / written-like, Sie). note_zh says in a few Chinese words when to use it.
Example. Input: 不好意思，能帮我打包吗
Output: {"items":[{"reg":"随意","en":"Sorry, kann ich das mitnehmen?","note_zh":"在小店、快餐店随口说"},{"reg":"中性","en":"Entschuldigung, könnten Sie mir das bitte einpacken?","note_zh":"餐厅里礼貌地说"},{"reg":"正式","en":"Entschuldigen Sie bitte, wäre es möglich, mir den Rest einzupacken?","note_zh":"很客气的场合"}],"words":[{"en":"mitnehmen","zh":"带走"},{"en":"einpacken","zh":"打包"}]}
Reply with ONLY one JSON object in exactly that shape, no markdown.`;
const USEWORD_SYS_DE = `You are a friendly German teacher. ${DE_WHO} ${DE_RULE}
The learner was asked to say one German sentence using a target word or phrase. Judge whether they used it correctly and naturally (meaning, grammar, gender/case, verb position, collocation).
Reply with ONLY one JSON object, no markdown: {"correct":true,"fixed":"their sentence corrected (same as theirs if already fine)","why_zh":"简体中文：哪里对 / 哪里错","better":"one more natural German example sentence with the target","better_zh":"中文"}`;
const JUDGE_SYS_DE = `You are a friendly German speaking coach. ${DE_WHO} ${DE_RULE}
Someone asked the learner a question in German and they answered quickly in speech. Judge if the answer makes sense as a reply (it does not need to be long or perfect).
Reply with ONLY one JSON object, no markdown: {"correct":true,"fb_zh":"简体中文：一两句反馈","fix":null,"better":"a natural German reply a fluent speaker might give, 1-2 sentences"}  — set "fix" to {"bad":"...","good":"...","why_zh":"..."} only for a clear grammar/word mistake.`;
const COACH_SYS_DE = `You are a warm, practical German speaking coach writing in Simplified Chinese for a beginner who does not know how to start practising speaking German. ${DE_WHO}
You get their self-assessment and their practice history. Make a concrete plan for the NEXT 7 DAYS using only these sections of the app (use the key in "sec"):
rescue (救命句：听不懂/想不起时的 40 句), intro (自我介绍), daily (每日一练), dialog (情景对话：听全文、跟读、角色扮演), func (常用表达), drill (句型操练), pron (发音：最小对立词、发音规则、重音、绕口令、数字), shadow (跟读), quick (快问快答), chat (AI 陪练), howto (这句话德语怎么说), topic (话题卡，AI 点评), mock (歌德 B1 口语模拟考).
Reply with ONLY one JSON object, no markdown:
{"level_zh":"一句话判断他现在的水平","advice_zh":"2-3 句最重要的建议","days":[{"day":1,"title":"今天的主题","steps":[{"do_zh":"具体做什么、做多久","sec":"rescue"}]}],"encourage_zh":"一句鼓励"}
In "do_zh" write plain Chinese for the learner (never write the section keys like rescue/dialog in the text; the button shows the section). Exactly 7 days, 2-4 steps each, about 15-20 minutes a day, start easy (listen and repeat, Umlaute) and build up to talking with the AI and topics.`;
const USEWORD_SYS = `You are a friendly English teacher. ${SPEAK_WHO}
The learner was asked to say one sentence using a target word or phrase. Judge whether they used it correctly and naturally (meaning, grammar, collocation).
Reply with ONLY one JSON object, no markdown: {"correct":true,"fixed":"their sentence corrected (same as theirs if already fine)","why_zh":"简体中文：哪里对 / 哪里错","better":"one more natural example sentence with the target","better_zh":"中文"}`;
const JUDGE_SYS = `You are a friendly English speaking coach. ${SPEAK_WHO}
Someone asked the learner a question and they answered quickly in speech. Judge if the answer makes sense as a reply (it does not need to be long or perfect).
Reply with ONLY one JSON object, no markdown: {"correct":true,"fb_zh":"简体中文：一两句反馈","fix":null,"better":"a natural reply a fluent speaker might give, 1-2 sentences"}  — set "fix" to {"bad":"...","good":"...","why_zh":"..."} only for a clear grammar/word mistake.`;
const COACH_SYS = `You are a warm, practical English speaking coach writing in Simplified Chinese for a complete beginner who does not know how to start practising speaking. ${SPEAK_WHO}
You get their self-assessment and their practice history. Make a concrete plan for the NEXT 7 DAYS using only these sections of the app (use the key in "sec"):
rescue (救命句：听不懂/想不起时的 40 句), intro (自我介绍 12 句), daily (每日一练), dialog (情景对话：听全文、跟读、角色扮演), func (常用表达), drill (句型操练), pron (发音：最小对立词、连读、重音、绕口令、数字), shadow (跟读 120 句), clip (原声跟读), quick (快问快答), chat (AI 陪练), howto (这句话英语怎么说), topic (话题卡，AI 点评), mock (雅思口语模拟考).
Reply with ONLY one JSON object, no markdown:
{"level_zh":"一句话判断他现在的水平","advice_zh":"2-3 句最重要的建议","days":[{"day":1,"title":"今天的主题","steps":[{"do_zh":"具体做什么、做多久","sec":"rescue"}]}],"encourage_zh":"一句鼓励"}
In "do_zh" write plain Chinese for the learner (never write the section keys like rescue/dialog in the text; the button shows the section). Exactly 7 days, 2-4 steps each, about 15-20 minutes a day, start easy (listen and repeat) and build up to talking with the AI and topics.`;
// 「📰 今日新闻」的 AI 简化版 + 读后小测：POST /api/ai {task:"newsimp", url, title, text} → { ok, simple, summary_zh, quiz:[{q, opts, ans, why_zh}], words:[{en, zh}] }；
// 同一篇（按网址）存 KV「news/simp/哈希」7 天，全家共用，一篇只花一次额度
const NEWSIMP_SYS = `You are an expert ESL materials writer. The reader is a Chinese native speaker at about CEFR B1 who lives in Kuala Lumpur.
Rewrite the news article for them in 250-350 words (never more than 380 words; leave out minor details), CEFR B1 English, short clear sentences, explain or replace rare words, keep all key facts, names and numbers correct, neutral tone. Separate paragraphs with a blank line.
Then write 4 multiple-choice comprehension questions about the article (in English, 3 options each, only one correct) and pick 6-8 useful words or phrases from the ORIGINAL article that a B1 learner probably does not know.
Reply with ONLY one JSON object, no markdown:
{"simple":"the rewritten article","summary_zh":"两句简体中文概括","quiz":[{"q":"question","opts":["A","B","C"],"ans":0,"why_zh":"简体中文：为什么"}],"words":[{"en":"word or phrase as used in the article","zh":"中文意思"}]}`;
const NEWSIMP_SYS_DE = `You are an expert writer of materials for German as a foreign language. The reader is a Chinese native speaker learning German (about CEFR A2-B1) who lives in Kuala Lumpur. ${DE_RULE}
Rewrite the news article for them in 200-300 German words (never more than 330 words; leave out minor details), CEFR A2-B1 German ("einfache Sprache"): short main clauses, few subordinate clauses, common words, explain or replace rare words, keep all key facts, names and numbers correct, neutral tone. Separate paragraphs with a blank line.
Then write 4 multiple-choice comprehension questions about the article (in simple German, 3 options each, only one correct) and pick 6-8 useful words or phrases from the ORIGINAL article that an A2-B1 learner probably does not know (nouns with their article, e.g. "die Regierung").
Reply with ONLY one JSON object, no markdown:
{"simple":"the rewritten article","summary_zh":"两句简体中文概括","quiz":[{"q":"question","opts":["A","B","C"],"ans":0,"why_zh":"简体中文：为什么"}],"words":[{"en":"German word or phrase as used in the article","zh":"中文意思"}]}`;
const LQUIZ_SYS_DE = `You are an experienced teacher of German as a foreign language. The text is the transcript of a German radio programme for learners (for example Deutsche Welle "Langsam gesprochene Nachrichten"). Write 5 multiple-choice comprehension questions for a learner (CEFR A2-B1) who has just LISTENED to it (without reading). ${DE_RULE}
Mix: 1 gist question (main topic), 2 detail questions (facts, numbers, places that are said clearly), 1 inference question, 1 meaning-in-context question about a useful word or phrase from the programme.
Each question: simple German, 4 short options, exactly one correct, wrong options plausible. "ans" is the 0-based index of the correct option. "why_zh" is a short Chinese explanation quoting the key German words from the transcript.
Reply with ONLY JSON: {"quiz":[{"q":"...","opts":["...","...","...","..."],"ans":0,"why_zh":"..."}]}`;
async function aiJson(env, msgs, ok, maxTok) {
  let last = "";
  for (const m of AI_MODELS) {
    try {
      const r = await env.AI.run(m, { messages: msgs, max_tokens: maxTok || 1024, temperature: 0.3 });
      const raw = r && (typeof r.response === "string" ? r.response : JSON.stringify(r.response || r)), o = pickJson(raw);
      if (o && ok(o)) return Object.assign({}, o, { ok: true, model: m }); // ok / model 是接口自己的，不让 AI 的输出盖掉
      last = "bad output";
    } catch (e) { last = String(e && e.message || e); }
  }
  return { ok: false, error: last || "ai failed" };
}
const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
function pickJson(s) { s = String(s || ""); const i = s.indexOf("{"), j = s.lastIndexOf("}"); if (i < 0 || j <= i) return null; try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { return null; } }
// ---------- 雅思听力 / 阅读模考出题（exam.js，POST /api/ai {task:"exam", mode:"reading"|"listening", text, title}）----------
// reading：text = 分好段的文章，每段开头是 "A " "B " …；出 5 道 TRUE/FALSE/NOT GIVEN、3 道「哪一段讲了…」、3 道摘要填空（答案是原文里 1–3 个词）、2 道四选一
// listening：text = 节目文稿（"说话人: 句子" 一行一句）；出 6 道笔记填空（答案是原文里 1–3 个词，按出现顺序）、4 道三选一
// 后台检查每道题：答案格式对、填空答案确实在原文里，不合格的题扔掉；剩下的不够就换模型再出。同一篇文章出过的题存 KV「x/<哈希>」60 天（再做、家里人做都不再花额度）
const EXAM_READ_SYS = `You are an experienced IELTS Academic Reading question writer.
The passage is split into paragraphs labelled A, B, C ... Write questions that test real reading skills (paraphrase, not copying sentences).
Reply with ONLY one JSON object, no markdown:
{"tfng":[{"s":"statement","a":"TRUE|FALSE|NOT GIVEN","p":"paragraph letter","why_zh":"简体中文解释，指出原文依据"}],
 "match":[{"s":"a short description of information (paraphrased)","a":"paragraph letter","why_zh":"..."}],
 "gaps":[{"s":"a summary sentence with ____ where the answer goes","a":"ONE to THREE words copied exactly from the passage","why_zh":"..."}],
 "mcq":[{"q":"question","opts":["A text","B text","C text","D text"],"ans":0,"why_zh":"..."}]}
Exactly 5 tfng (at least one of each answer), 3 match (different paragraphs), 3 gaps, 2 mcq. Statements must be paraphrased. Do not use information outside the passage.`;
const EXAM_LISTEN_SYS = `You are an experienced IELTS Listening question writer. The text is the transcript of a radio programme (one line per turn, "Speaker: words").
Reply with ONLY one JSON object, no markdown:
{"notes":[{"s":"a note line with ____ where the answer goes","a":"ONE to THREE words or a number, copied exactly from the transcript","why_zh":"简体中文解释，引用原话"}],
 "mcq":[{"q":"question","opts":["A text","B text","C text"],"ans":0,"why_zh":"..."}]}
Exactly 6 notes and 4 mcq, all in the order the information is heard. Notes must paraphrase the context but the answer words must appear exactly in the transcript.`;
// 🇩🇪 歌德模考（lang:"de"）：同样的 JSON（判断题的答案也用 TRUE / FALSE / NOT GIVEN 存，网页显示成 Richtig / Falsch / Steht nicht im Text），题目全用德语
const EXAM_READ_SYS_DE = `You are an experienced question writer for the Goethe-Zertifikat B1/B2 reading module (Lesen). The passage is a German news article split into paragraphs labelled A, B, C ... Write all questions and options in clear German (B1-B2 level); test real reading skills (paraphrase, not copying sentences). ${DE_RULE}
Reply with ONLY one JSON object, no markdown:
{"tfng":[{"s":"German statement","a":"TRUE|FALSE|NOT GIVEN","p":"paragraph letter","why_zh":"简体中文解释，指出原文依据"}],
 "match":[{"s":"a short German description of information (paraphrased)","a":"paragraph letter","why_zh":"..."}],
 "gaps":[{"s":"a German summary sentence with ____ where the answer goes","a":"ONE to THREE words copied exactly from the passage (same spelling, case and umlauts)","why_zh":"..."}],
 "mcq":[{"q":"German question","opts":["A text","B text","C text","D text"],"ans":0,"why_zh":"..."}]}
"a" in tfng is TRUE (richtig), FALSE (falsch) or NOT GIVEN (steht nicht im Text). Exactly 5 tfng: 2 TRUE, 2 FALSE and 1 NOT GIVEN, in mixed order, 3 match (different paragraphs), 3 gaps, 2 mcq. Statements must be paraphrased. Do not use information outside the passage.`;
const EXAM_LISTEN_SYS_DE = `You are an experienced question writer for the Goethe-Zertifikat B1/B2 listening module (Hören). The text is the transcript of a German radio news programme for learners (Deutsche Welle "Langsam gesprochene Nachrichten"; lines are "Headline: text"). Write everything in clear German (B1-B2 level). ${DE_RULE}
Reply with ONLY one JSON object, no markdown:
{"notes":[{"s":"a German note line with ____ where the answer goes","a":"ONE to THREE words or a number, copied exactly from the transcript (same spelling, case and umlauts)","why_zh":"简体中文解释，引用原话"}],
 "mcq":[{"q":"German question","opts":["A text","B text","C text"],"ans":0,"why_zh":"..."}]}
Exactly 6 notes and 4 mcq, all in the order the information is heard. Notes must paraphrase the context but the answer words must appear exactly in the transcript.`;
// 判断题第二道检查：另让 AI 只看原文判断每一句（不告诉它原答案），和出题时的答案不一样的那句不要（AI 偶尔会把答案标反）
const EXAM_TF_CHECK_DE = `You check true/false/not-given reading questions against a German passage. For each numbered statement decide ONLY from the passage: TRUE (the passage says the same), FALSE (the passage says the opposite or something incompatible), NOT GIVEN (the passage does not say). Read carefully: negations, recommendations vs. orders, "some" vs. "all", numbers.
Reply with ONLY JSON: {"a":["TRUE|FALSE|NOT GIVEN", ...]} with one answer per statement, in order.`;
const EXAM_TF_CHECK = EXAM_TF_CHECK_DE.replace("against a German passage", "against an English passage");
async function examTfCheck(env, text, tf, de) {
  const r = await aiJson(env, [{ role: "system", content: de ? EXAM_TF_CHECK_DE : EXAM_TF_CHECK }, { role: "user", content: "Passage:\n" + text + "\n\nStatements:\n" + tf.map((x, i) => i + 1 + ". " + x.s).join("\n") }], o => isObj(o) && Array.isArray(o.a) && o.a.length === tf.length, 300);
  if (!r.ok) return tf; // 检查没做成：照原样（不因为检查失败就出不了题）
  const MAP = { RICHTIG: "TRUE", WAHR: "TRUE", FALSCH: "FALSE", "STEHT NICHT IM TEXT": "NOT GIVEN", "NICHT GEGEBEN": "NOT GIVEN", "NICHT IM TEXT": "NOT GIVEN", NG: "NOT GIVEN", T: "TRUE", F: "FALSE" };
  const norm = a => { const k = String(a || "").toUpperCase().replace(/_/g, " ").replace(/[.!]/g, "").trim(); return MAP[k] || k; }; // 检查的 AI 有时用德语 / 缩写回答
  return tf.filter((x, i) => norm(r.a[i]) === x.a);
}
const exNormEn = s => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim(), exNorm = exNormEn;
const exNormDe = s => String(s || "").normalize("NFC").toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}0-9' ]+/gu, " ").replace(/\s+/g, " ").trim(); // 德语：保留 ä ö ü ß
function examClean(o, mode, text, de) {
  if (!isObj(o)) return null;
  const exNorm = de ? exNormDe : exNormEn;
  const T = " " + exNorm(text) + " ", c = (x, n) => clip(x, n).trim(), out = { mode };
  const self = x => (" " + exNorm(String(x.s).replace(/_{2,}/g, " ")) + " ").includes(" " + exNorm(x.a) + " "); // 答案就写在题目里（「Dr. Lee 的姓是 ____ → Lee」）的不要
  const gap = x => isObj(x) && (String(x.s || "").match(/_{2,}/g) || []).length === 1 && x.a && exNorm(x.a).split(" ").length <= 3 && T.includes(" " + exNorm(x.a) + " ") && !self(x) ? { s: c(x.s, 300).replace(/_{2,}/, "____"), a: c(x.a, 60), why_zh: c(x.why_zh, 300) } : null;
  const mcq = n => x => isObj(x) && x.q && Array.isArray(x.opts) && x.opts.length === n && x.opts.every(y => typeof y === "string" && y.trim()) && Number.isInteger(+x.ans) && +x.ans >= 0 && +x.ans < n ? { q: c(x.q, 300), opts: x.opts.map(y => c(y, 200).replace(/^[A-D][.)]\s+/, "")), ans: +x.ans, why_zh: c(x.why_zh, 300) } : null;
  if (mode === "reading") {
    const L = [...new Set((String(text).match(/^[A-H](?= )/gm) || []))];
    const tf = x => { const a = String(x && x.a || "").toUpperCase().replace(/_/g, " ").trim(); return isObj(x) && x.s && ["TRUE", "FALSE", "NOT GIVEN"].includes(a) ? { s: c(x.s, 300), a, p: L.includes(String(x.p || "").toUpperCase()) ? String(x.p).toUpperCase() : "", why_zh: c(x.why_zh, 300) } : null; };
    const mt = x => isObj(x) && x.s && L.includes(String(x.a || "").toUpperCase().trim()) ? { s: c(x.s, 300), a: String(x.a).toUpperCase().trim(), why_zh: c(x.why_zh, 300) } : null;
    out.tfng = (o.tfng || []).map(tf).filter(Boolean).slice(0, 5); out.match = (o.match || []).map(mt).filter(Boolean).slice(0, 3); out.gaps = (o.gaps || []).map(gap).filter(Boolean).slice(0, 3); out.mcq = (o.mcq || []).map(mcq(4)).filter(Boolean).slice(0, 2); out.letters = L;
    if (de && !(out.tfng.some(x => x.a === "TRUE") && out.tfng.some(x => x.a === "FALSE"))) return null; // 德语：判断题全是 Falsch（或全是 Richtig）的不要，换个模型再出
    return out.tfng.length >= 3 && out.tfng.length + out.match.length + out.gaps.length + out.mcq.length >= 9 ? out : null;
  }
  out.notes = (o.notes || []).map(gap).filter(Boolean).slice(0, 6); out.mcq = (o.mcq || []).map(x => mcq(3)(x) || mcq(4)(x)).filter(Boolean).slice(0, 4);
  return out.notes.length >= 3 && out.notes.length + out.mcq.length >= 7 ? out : null;
}
// ---------- 雅思听力 Section 1 / 3 风格的对话（exam.js「🎙 雅思对话」）：POST /api/ai {task:"ieltsscript", sec:1|3, done:[做过的 id], fresh}
// AI 写一段两个人的对话（A 男声 orion、B 女声 luna，网页逐句用 /api/tts 读）：Section 1 = 生活场景（订房、报名…，里面有拼写的名字、电话、日期、价格、地址），
// Section 3 = 学术讨论（两个学生 / 学生和导师）。存进 KV「ix/<sec>/<id>」当题库（不过期），家里人共用：先给一套没做过的，都做过了（或 fresh）才让 AI 写新的
// 出题照常走 task:"exam"（mode listening，kind s1 / s3 让题目偏表格填空 / 观点选择）
// 🤔 为什么没听出来：学生听写这一句漏 / 错的地方，讲连读、弱读、吞音等（中文）
const WHYMISS_SYS = `You are an English listening coach for Chinese learners. A learner did dictation of one sentence from a BBC radio programme and missed some words.
For each missed chunk explain in simple Chinese WHY it is hard to hear in natural British speech: linking (连读), weak forms (弱读), elision (吞音/省音), assimilation (同化), flapped or unreleased t/d (不完全爆破), contractions (缩读), homophones or near-homophones (同音/近音词), fast fixed phrases, or simply an uncommon word / name.
Rules: "chunk" must be copied exactly from the sentence (2-5 words around the missed word, keep the original case); "sounds" shows how it actually sounds, written in simple English-like spelling (e.g. "wanna", "lemme", "kinda", "a-ni-dea", "ə" for weak vowels); "kind_zh" is the short Chinese name of the phenomenon; "why_zh" is 1-2 short Chinese sentences; at most 4 items, most important first. "tip_zh" is one short Chinese tip for practising this kind of sound.
Reply with ONLY JSON: {"items":[{"chunk":"...","sounds":"...","kind_zh":"连读","why_zh":"..."}],"tip_zh":"..."}`;
const WHYMISS_SYS_DE = `You are a German listening coach for Chinese learners. A learner did dictation of one sentence from a German radio programme for learners and missed some words.
For each missed chunk explain in simple Chinese WHY it is hard to hear in spoken German: weak/reduced endings (-en, -er 弱读), elision (吞音, e.g. "haben" sounding like "ham"), linking across words (连读), assimilation (同化), final devoicing (尾音清化), glottal stop (喉塞音), compound nouns (复合词), separable verb prefixes at the end of the sentence (可分动词前缀在句尾), similar-sounding words (近音词), or simply an uncommon word / name.
Rules: "chunk" must be copied exactly from the sentence (2-5 words around the missed word, keep the original case); "sounds" shows roughly how it actually sounds (simple German-like spelling or IPA, e.g. "ham", "ham'wa", "is'es", "ə" for weak vowels); "kind_zh" is the short Chinese name of the phenomenon; "why_zh" is 1-2 short Chinese sentences; at most 4 items, most important first. "tip_zh" is one short Chinese tip for practising this kind of sound.
Reply with ONLY JSON: {"items":[{"chunk":"...","sounds":"...","kind_zh":"弱读","why_zh":"..."}],"tip_zh":"..."}`;
// 🧩 听后小测：一期节目的文稿 → 5 道四选一（大意、细节、推断、态度、词义）
const LQUIZ_SYS = `You are an experienced English listening teacher. The text is the transcript of a BBC Learning English radio programme. Write 5 multiple-choice comprehension questions for a learner (CEFR B1-B2) who has just LISTENED to it (without reading).
Mix: 1 gist question (main topic / purpose), 2 detail questions (facts, numbers, examples that are said clearly), 1 inference or speaker-attitude question, 1 meaning-in-context question about a useful phrase from the programme.
Each question: plain English, 4 short options, exactly one correct, wrong options plausible (things mentioned but not the answer, or common misunderstandings). Do not ask about the presenters' names. "ans" is the 0-based index of the correct option. "why_zh" is a short Chinese explanation quoting the key words from the transcript.
Reply with ONLY JSON: {"quiz":[{"q":"...","opts":["...","...","...","..."],"ans":0,"why_zh":"..."}]}`;
const IELTS_TOPICS = {
  1: ["booking a hotel room for a family trip", "joining a gym", "registering for a library card", "renting a flat near the city centre", "hiring a car for a weekend", "reserving a table for a birthday dinner", "reporting lost property at a train station", "enrolling in an evening cooking course", "booking a guided city tour", "making a dentist appointment", "changing a mobile phone plan", "arranging a removal company to move house", "signing up as a volunteer at a community festival", "ordering a birthday cake from a bakery", "booking swimming lessons for a child"],
  2: ["a tour guide introducing a historic town centre", "a manager welcoming new volunteers at a wildlife park", "a radio announcement about changes to local bus services", "a talk about facilities at a new community sports centre", "a guide explaining the layout and rules of a museum", "an organiser describing activities at a summer music festival", "a speaker introducing a city cycling scheme", "a recorded message about a farm open day"],
  4: ["a lecture on the history of paper making", "a lecture on how bees communicate", "a lecture on the design of early railway stations", "a lecture on sleep and memory in students", "a lecture on the effects of noise pollution on birds", "a lecture on traditional food preservation methods", "a lecture on the development of the bicycle", "a lecture on coral reef restoration"],
  3: ["two students planning a group presentation about urban gardens", "a student and tutor discussing feedback on a dissertation about online learning", "two students choosing a topic for a marketing case study", "students comparing research methods for a survey on sleep habits", "two students discussing a field trip report on coastal erosion", "a tutor helping a student plan an essay about renewable energy", "two students reviewing a lecture on animal behaviour", "students dividing tasks for a project on recycling in their university"],
};
const ieltsSys = sec => sec === 2 || sec === 4 ? `You write realistic scripts for IELTS Listening practice. Write ONE ${sec === 2 ? "Section 2 monologue: one speaker talking about an everyday social topic (a guide, organiser or announcer giving practical information: places, times, prices, rules, activities)" : "Section 4 monologue: a university lecture on an academic topic, with a clear structure (introduction, two or three main points with examples, conclusion)"}.
The speaker is ${sec === 2 ? "a woman" : "a man"}; give a first name. ${sec === 2 ? "450-600" : "550-750"} words, split into 10-24 short paragraphs (each paragraph = one "line", 1-3 sentences), natural spoken style ("OK, so...", "Now, moving on to...").
${sec === 2 ? "Include specific facts IELTS tests: names of places, days and times, prices, numbers, and at least one detail that is first said and then corrected." : "Include key terms, dates, numbers and causes/effects that could be tested by note completion, and signpost each main point clearly."}
Write numbers the way they are spoken but keep digits for prices, dates and times.
Reply with ONLY one JSON object, no markdown:
{"title":"short English title","scene_zh":"一句中文说明场景","lines":[{"who":"A","name":"${sec === 2 ? "Linda" : "Peter"}","t":"one paragraph of the talk"}]}` : `You write realistic scripts for IELTS Listening practice. Write ONE ${sec === 1 ? "Section 1 conversation: an everyday social situation between two people (one asks for information, the other provides it)" : "Section 3 conversation: an academic discussion between two speakers (students, or a student and a tutor), with opinions, agreement, disagreement and decisions"}.
Speaker A is a man, speaker B is a woman. Give each a first name. 380-480 words, 16-28 turns, natural spoken English with hesitations and self-corrections.
${sec === 1 ? "Include details that IELTS tests: a surname said normally and then spelled with hyphens (e.g. \"It's Thompson, T-H-O-M-P-S-O-N\"), a phone number, a date, a price, a street address or postcode, and at least one distractor (a detail that is first said and then changed)." : "Include at least three clear opinions or decisions, reasons for them, and at least two distractors (an idea first suggested then rejected)."}
Write numbers the way they are spoken but keep digits for phone numbers, prices, dates and times (e.g. "£45", "07700 900 123", "15th March", "9.30").
Reply with ONLY one JSON object, no markdown:
{"title":"short English title","scene_zh":"一句中文说明场景","lines":[{"who":"A","name":"Tom","t":"what he says"},{"who":"B","name":"Sarah","t":"..."}]}`;
function ieltsClean(o, sec) {
  if (!isObj(o) || !Array.isArray(o.lines)) return null;
  const mono = sec === 2 || sec === 4; if (mono) o.lines.forEach(l => { if (isObj(l)) l.who = "A"; }); // 独白：只有一个人
  const lines = o.lines.filter(l => isObj(l) && (l.who === "A" || l.who === "B") && typeof l.t === "string" && /[a-z]/i.test(l.t)).map(l => ({ who: l.who, name: clip(l.name || (l.who === "A" ? "Man" : "Woman"), 20).trim(), t: clip(l.t, 600).replace(/\s+/g, " ").trim() }));
  const words = lines.reduce((n, l) => n + l.t.split(" ").length, 0);
  return lines.length >= (mono ? 6 : 12) && words >= (mono ? 350 : 250) && words <= 1000 ? { title: clip(o.title || "IELTS Listening", 120), scene_zh: clip(o.scene_zh, 120), lines } : null;
}
const IX_LIST = {};
async function ieltsScript(env, b) {
  const sec = [2, 3, 4].includes(+b.sec) ? +b.sec : 1, kv = env.CAPTIONS, pre = "ix/" + sec + "/";
  if (kv && !b.fresh) {
    const done = new Set((Array.isArray(b.done) ? b.done : []).map(String)), c = IX_LIST[pre], all = c && Date.now() - c.at < 6 * 3600e3 ? c.ids : (IX_LIST[pre] = { at: Date.now(), ids: (await kv.list({ prefix: pre })).keys.map(k => k.name.slice(pre.length)) }).ids, L = all.filter(id => !done.has(id)); // 题库清单在内存里留 6 小时（每天只有 1000 次 list 额度）
    if (L.length) { const x = await kv.get(pre + L[0], "json"); if (x) return json(Object.assign({ ok: true, cached: true, left: L.length - 1 }, x)); }
  }
  const T = IELTS_TOPICS[sec], topic = T[Math.floor(Math.random() * T.length)];
  let got = null;
  const r = await aiJson(env, [{ role: "system", content: ieltsSys(sec) }, { role: "user", content: "Topic: " + topic }], o => !!(got = ieltsClean(o, sec)), 2400);
  if (!r.ok || !got) return json({ ok: false, error: r.error || "bad output" }, 502);
  const x = Object.assign({ id: Date.now().toString(36), sec, topic, at: Date.now() }, got);
  if (kv) { await cput(kv, pre + x.id, JSON.stringify(x)); if (IX_LIST[pre]) IX_LIST[pre].ids.push(x.id); }
  return json(Object.assign({ ok: true, left: 0 }, x));
}
async function examGen(env, b) {
  const mode = b.mode === "listening" ? "listening" : "reading", text = clip(b.text, 9000).trim(), de = isDe(b);
  if (text.split(/\s+/).length < 150) return json({ ok: false, error: "too short" }, 400);
  const kv = env.CAPTIONS, ck = "x/" + (await sha((de ? "de|" : "") + mode + "|" + (b.kind || "") + "|" + text)).slice(0, 32);
  if (kv && !b.again) { const hit = await kv.get(ck, "json"); if (hit) return json(Object.assign({ ok: true, cached: true }, hit)); }
  let got = null, last = null;
  const hint = de ? "" : mode === "listening" && b.kind === "s1" ? "\nThis is an IELTS Section 1 conversation: make the notes a form to complete (names spelled in the script, numbers, dates, prices, addresses). Answers must be copied exactly from the transcript; for a spelled name use the name as normally written."
    : mode === "listening" && b.kind === "s2" ? "\nThis is an IELTS Section 2 monologue: make the notes a table or form of practical facts (places, days, times, prices, activities). Answers must be copied exactly from the transcript; never write a gap whose answer appears in the same note sentence."
    : mode === "listening" && b.kind === "s4" ? "\nThis is an IELTS Section 4 academic lecture: make the notes a lecture outline to complete (key terms, causes, effects, dates); the multiple-choice questions test the main points and the speaker's conclusions. Never write a gap whose answer appears in the same note sentence."
    : mode === "listening" && b.kind === "s3" ? "\nThis is an IELTS Section 3 academic discussion: focus the multiple-choice questions on opinions, reasons and decisions, and the notes on key facts." : "";
  const r = await aiJson(env, [{ role: "system", content: (mode === "reading" ? (de ? EXAM_READ_SYS_DE : EXAM_READ_SYS) : (de ? EXAM_LISTEN_SYS_DE : EXAM_LISTEN_SYS)) + hint }, { role: "user", content: (b.title ? "Title: " + clip(b.title, 200) + "\n\n" : "") + text }], o => { last = o; return !!(got = examClean(o, mode, text, de)); }, 2600);
  if (!r.ok || !got) { // 说清楚哪里不合格，方便查
    const nz = de ? exNormDe : exNorm, n = k => Array.isArray(last && last[k]) ? last[k].length : 0, T = " " + nz(text) + " ", miss = ((last && (last.notes || last.gaps)) || []).filter(x => x && x.a && !T.includes(" " + nz(x.a) + " ")).map(x => x.a).slice(0, 4);
    return json({ ok: false, error: r.error || "bad output", detail: last ? Object.keys(last).map(k => k + ":" + n(k)).join(" ") + (miss.length ? " | 答案不在原文：" + miss.join(", ") : "") : "" }, 502);
  }
  if (mode === "reading") { // 判断题再核对一遍（英语雅思、德语歌德都做）
    got.tfng = await examTfCheck(env, text, got.tfng, de); // 核对不一致的判断题去掉（一道都不剩也照样出卷：段落、填空、选择题还在，不浪费这次出题）
  }
  got.model = r.model; if (kv) await cput(kv, ck, JSON.stringify(got), { expirationTtl: (mode === "reading" && (got.tfng || []).length < 2 ? 1 : 60) * 86400 }); // 判断题核对后剩不到 2 道：只存 1 天，明天同一篇会重新出完整的
  return json(Object.assign({ ok: true }, got));
}
async function ai(req, env) {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (!env.AI) return json({ ok: false, error: "noai" });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  try {
    const b = await req.json(), text = String(b.text || "").split(/\s+/).slice(0, 1500).join(" ").slice(0, 10000), prompt = String(b.prompt || "").slice(0, 3000);
    if (env.__use) env.__use.f = "ai:" + String(b.task || "write").replace(/[^a-z0-9]/gi, "").slice(0, 16); // 额度记账：记在哪个功能下
    if (b.task === "newsimp") {
      const t = String(b.text || "").split(/\s+/).slice(0, 1000).join(" "), title = clip(b.title, 300); if (t.split(" ").length < 80) return json({ ok: false, error: "bad body" }, 400);
      let hh = 2166136261; const hs = String(b.url || title || t.slice(0, 200)); for (let i = 0; i < hs.length; i++) { hh ^= hs.charCodeAt(i); hh = Math.imul(hh, 16777619); }
      const key = "news/simp/" + (isDe(b) ? "de/" : "") + (hh >>> 0).toString(36), c = env.CAPTIONS && !b.fresh ? await env.CAPTIONS.get(key, "json") : null; if (c) return json(Object.assign(c, { cached: 1 }));
      const r = await aiJson(env, [{ role: "system", content: isDe(b) ? NEWSIMP_SYS_DE : NEWSIMP_SYS }, { role: "user", content: "Title: " + title + "\n\n" + t }], o => typeof o.simple === "string" && o.simple.split(/\s+/).length > 80 && Array.isArray(o.quiz), 3800); // 输出要放得下改写稿 + 题目，太小会被截断
      if (r.ok) { r.quiz = (r.quiz || []).filter(q => q && q.q && Array.isArray(q.opts) && q.opts.length >= 2 && +q.ans >= 0 && +q.ans < q.opts.length).slice(0, 5); r.words = (Array.isArray(r.words) ? r.words : []).filter(w => w && w.en).slice(0, 10); if (env.CAPTIONS) await cput(env.CAPTIONS, key, JSON.stringify(r), { expirationTtl: 7 * 86400 }); }
      return json(r, r.ok ? 200 : 502);
    }
    // 口语：chat（陪练回一句）、chatsum（聊完总结）、speak（话题回答点评）
    if (b.task === "chat" || b.task === "chatsum") {
      const H = (Array.isArray(b.history) ? b.history : []).slice(-16).map(x => ({ role: x && x.role === "assistant" ? "assistant" : "user", content: clip(x && x.content, 500) })).filter(x => x.content.trim());
      if (b.task === "chat") {
        const r = await aiJson(env, [{ role: "system", content: (isDe(b) ? CHAT_SYS_DE : CHAT_SYS)(clip(b.scene, 400)) }].concat(H.length ? H : [{ role: "user", content: isDe(b) ? "(The conversation starts now. Greet me in German and open the conversation for this situation.)" : "(The conversation starts now. Greet me and open the conversation for this situation.)" }]), o => typeof o.reply === "string" && o.reply.trim(), 300);
        return json(r.ok ? { ok: true, model: r.model, reply: String(r.reply).trim(), fix: r.fix && r.fix.bad && r.fix.good ? { bad: clip(r.fix.bad, 300), good: clip(r.fix.good, 300), why_zh: clip(r.fix.why_zh, 300) } : null } : r, r.ok ? 200 : 502);
      }
      if (H.filter(x => x.role === "user").length < 2) return json({ ok: false, error: "too short" }, 400);
      const conv = H.map(x => (x.role === "user" ? "user: " : "partner: ") + x.content).join("\n");
      const r = await aiJson(env, [{ role: "system", content: isDe(b) ? CHATSUM_SYS_DE : CHATSUM_SYS }, { role: "user", content: "Situation: " + clip(b.scene, 400) + "\n\nConversation:\n" + conv }], o => typeof o.summary_zh === "string", 1200);
      return json(r, r.ok ? 200 : 502);
    }
    if (b.task === "howto") {
      const q = clip(b.text, 400).trim(); if (!q) return json({ ok: false, error: "bad body" }, 400);
      const r = await aiJson(env, [{ role: "system", content: isDe(b) ? HOWTO_SYS_DE : HOWTO_SYS }, { role: "user", content: q }], o => Array.isArray(o.items) && o.items.length, 700);
      return json(r, r.ok ? 200 : 502);
    }
    if (b.task === "useword") {
      const w = clip(b.word, 80).trim(), t = clip(b.text, 500).trim(); if (!w || !t) return json({ ok: false, error: "bad body" }, 400);
      const r = await aiJson(env, [{ role: "system", content: isDe(b) ? USEWORD_SYS_DE : USEWORD_SYS }, { role: "user", content: "Target: " + w + (b.zh ? " (" + clip(b.zh, 80) + ")" : "") + "\nLearner's sentence: " + t }], o => typeof o.correct === "boolean", 500);
      return json(r, r.ok ? 200 : 502);
    }
    if (b.task === "judge") {
      const q = clip(b.prompt, 300).trim(), t = clip(b.text, 600).trim(); if (!q || !t) return json({ ok: false, error: "bad body" }, 400);
      const r = await aiJson(env, [{ role: "system", content: isDe(b) ? JUDGE_SYS_DE : JUDGE_SYS }, { role: "user", content: "Question: " + q + "\nLearner's answer: " + t }], o => typeof o.correct === "boolean", 400);
      return json(r, r.ok ? 200 : 502);
    }
    if (b.task === "whymiss") {
      const sent = clip(b.sent, 600).trim(), typed = clip(b.typed, 600).trim(), miss = (Array.isArray(b.missed) ? b.missed : []).map(x => clip(x, 60).trim()).filter(Boolean).slice(0, 12);
      if (!sent || !miss.length) return json({ ok: false, error: "bad body" }, 400);
      const kv = env.CAPTIONS, ck = "wm/" + (isDe(b) ? "de/" : "") + (await sha(sent + "|" + miss.join("|"))).slice(0, 32);
      if (kv) { const hit = await kv.get(ck, "json"); if (hit) return json(Object.assign({ ok: true, cached: true }, hit)); }
      const low = sent.toLowerCase(); let got = null;
      const r = await aiJson(env, [{ role: "system", content: isDe(b) ? WHYMISS_SYS_DE : WHYMISS_SYS }, { role: "user", content: "Sentence: " + sent + "\nLearner wrote: " + (typed || "(nothing)") + "\nMissed words: " + miss.join(", ") }], o => {
        if (!isObj(o) || !Array.isArray(o.items)) return false;
        const it = o.items.filter(x => isObj(x) && typeof x.chunk === "string" && x.chunk.trim() && low.includes(x.chunk.trim().toLowerCase()) && typeof x.why_zh === "string").slice(0, 4).map(x => ({ chunk: clip(x.chunk, 80).trim(), sounds: clip(x.sounds, 80), kind_zh: clip(x.kind_zh, 20), why_zh: clip(x.why_zh, 300) }));
        return it.length ? !!(got = { items: it, tip_zh: clip(o.tip_zh, 200) }) : false;
      }, 900);
      if (!r.ok || !got) return json({ ok: false, error: r.error || "bad output" }, 502);
      got.model = r.model; if (kv) await cput(kv, ck, JSON.stringify(got), { expirationTtl: 180 * 86400 });
      return json(Object.assign({ ok: true }, got));
    }
    if (b.task === "tr") { // 浏览器翻不了（谷歌连不上）时最后一道：后台翻一批句子（谷歌 → Workers AI）
      const T = (Array.isArray(b.texts) ? b.texts : []).slice(0, 200).map(x => clip(x, 1000));
      if (!T.length || T.join("").length > 40000) return json({ ok: false, error: "bad body" }, 400);
      const kv = env.CAPTIONS, ck = T.length <= 3 ? "trc/" + (isDe(b) ? "de/" : "") + (await sha(T.join("\n"))).slice(0, 32) : ""; // 查词这种一两个词的存起来（KV 每天写入有限，长的不存）
      if (kv && ck) { const hit = await kv.get(ck, "json"); if (hit) return json({ ok: true, zh: hit, cached: true }); }
      const zh = await smeZh(T, env, isDe(b) ? "de" : undefined); if (kv && ck && zh.every((x, i) => x || !T[i])) await cput(kv, ck, JSON.stringify(zh), { expirationTtl: 180 * 86400 });
      return json({ ok: zh.some(Boolean), zh });
    }
    if (b.task === "lquiz") {
      const t = clip(b.text, 12000).trim(); if (t.split(/\s+/).length < 150) return json({ ok: false, error: "too short" }, 400);
      const kv = env.CAPTIONS, ck = "lq/" + (isDe(b) ? "de/" : "") + (await sha(t)).slice(0, 32);
      if (kv && !b.again) { const hit = await kv.get(ck, "json"); if (hit) return json(Object.assign({ ok: true, cached: true }, hit)); }
      let got = null;
      const r = await aiJson(env, [{ role: "system", content: isDe(b) ? LQUIZ_SYS_DE : LQUIZ_SYS }, { role: "user", content: (b.title ? "Title: " + clip(b.title, 200) + "\n\n" : "") + t }], o => {
        if (!isObj(o) || !Array.isArray(o.quiz)) return false;
        const q = o.quiz.filter(x => isObj(x) && typeof x.q === "string" && Array.isArray(x.opts) && x.opts.length === 4 && x.opts.every(y => typeof y === "string" && y.trim()) && Number.isInteger(+x.ans) && +x.ans >= 0 && +x.ans < 4).slice(0, 5)
          .map(x => ({ q: clip(x.q, 300), opts: x.opts.map(y => clip(y, 200)), ans: +x.ans, why_zh: clip(x.why_zh, 300) }));
        return q.length >= 4 ? !!(got = { quiz: q }) : false;
      }, 1800);
      if (!r.ok || !got) return json({ ok: false, error: r.error || "bad output" }, 502);
      got.model = r.model; if (kv) await cput(kv, ck, JSON.stringify(got), { expirationTtl: 180 * 86400 });
      return json(Object.assign({ ok: true }, got));
    }
    if (b.task === "exam") return examGen(env, b);
    if (b.task === "ieltsscript") return ieltsScript(env, b);
    if (b.task === "coach") {
      const r = await aiJson(env, [{ role: "system", content: isDe(b) ? COACH_SYS_DE : COACH_SYS }, { role: "user", content: clip(b.text, 3000) }], o => Array.isArray(o.days) && o.days.length, 2000);
      return json(r, r.ok ? 200 : 502);
    }
    if (b.task === "speak") {
      if (text.split(/\s+/).length < 8) return json({ ok: false, error: "too short" }, 400);
      const de = isDe(b), r = await aiJson(env, [{ role: "system", content: de ? SPEAKRATE_SYS_DE : SPEAKRATE_SYS }, { role: "user", content: "Question: " + (prompt || "(not given)") + "\n\nTranscript of the candidate's spoken answer:\n" + text }], o => o.band && typeof o.better === "string", 1600);
      if (r.ok && r.band && de) { const p = v => Math.max(0, Math.min(25, Math.round(+v || 0))), B = r.band; ["FC", "LR", "GRA"].forEach(k => (B[k] = p(B[k]))); B.overall = Math.round((B.FC + B.LR + B.GRA) / 75 * 100); r.scale = "de"; r.cefr = /^[ABC][12]$/.test(r.cefr) ? r.cefr : ""; } // 德语：每项 0–25，总分 0–100
      else if (r.ok && r.band) { const h = v => Math.round((+v || 0) * 2) / 2, B = r.band; ["FC", "LR", "GRA"].forEach(k => (B[k] = h(B[k]))); B.overall = h((B.FC + B.LR + B.GRA) / 3); } // 雅思只有整分和半分
      return json(r, r.ok ? 200 : 502);
    }
    if (b.task !== "write" || text.split(/\s+/).length < (isDe(b) ? 15 : 20)) return json({ ok: false, error: "bad body" }, 400); // 德语 B1 有 40 词的任务
    const K1 = "IELTS Academic Writing Task 1 (report on visual data given as text, at least 150 words; needs an overview)", K2 = "IELTS Writing Task 2 (essay, at least 250 words)", KM = "an email / letter (IELTS General Training Task 1, at least 150 words)";
    const kind = { t1: K1, task1: K1, t2: K2, task2: K2, mail: KM, email: KM, free: "free writing (judge it like general academic English)" }[b.type] || "IELTS Writing Task 2 (essay, at least 250 words)";
    const de = isDe(b), DK = { b1mail: "Goethe B1 Schreiben Teil 1: informal email to a friend (about 80 words, cover all points)", b1forum: "Goethe B1 Schreiben Teil 2: opinion post in an online forum (about 80 words)", b1formal: "Goethe B1 Schreiben Teil 3: short formal email (about 40 words)", b2forum: "Goethe B2 Schreiben Teil 1: forum post giving and justifying an opinion (about 150 words)", b2letter: "Goethe B2 Schreiben Teil 2: formal letter / email (about 100 words)", free: "free writing in German (judge it as general German at the learner's level)" };
    const msgs = [{ role: "system", content: de ? WRITE_SYS_DE : WRITE_SYS }, { role: "user", content: "Task type: " + (de ? DK[b.type] || DK.free : kind) + "\nQuestion: " + (prompt || "(not given)") + "\n\nCandidate's answer:\n" + text }];
    let last = "";
    for (const m of AI_MODELS) {
      try {
        const r = await env.AI.run(m, { messages: msgs, max_tokens: 2048, temperature: 0.2 });
        const raw = r && (typeof r.response === "string" ? r.response : JSON.stringify(r.response || r));
        const o = pickJson(raw);
        if (o && o.band && de) { const p = v => Math.max(0, Math.min(25, Math.round(+v || 0))), B = o.band; ["TR", "CC", "LR", "GRA"].forEach(k => (B[k] = p(B[k]))); B.overall = B.TR + B.CC + B.LR + B.GRA; return json({ ok: true, model: m, scale: "de", cefr: /^[ABC][12]$/.test(o.cefr) ? o.cefr : "", band: B, summary_zh: o.summary_zh || "", strengths_zh: o.strengths_zh || [], improve_zh: o.improve_zh || [], rewrite: o.rewrite || "" }); } // 德语：每项 0–25，总分 = 四项之和（0–100）
        if (o && o.band) return json({ ok: true, model: m, band: o.band, summary_zh: o.summary_zh || "", strengths_zh: o.strengths_zh || [], improve_zh: o.improve_zh || [], rewrite: o.rewrite || "" });
        last = "bad output";
      } catch (e) { last = String(e && e.message || e); }
    }
    return json({ ok: false, error: last || "ai failed" }, 502);
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}
async function stt(req, env) {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (!env.AI) return json({ ok: false, error: "noai" });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  try {
    const buf = await req.arrayBuffer(); if (!buf.byteLength) return json({ ok: false, error: "empty" }, 400); if (buf.byteLength > 4e6) return json({ ok: false, error: "too large" }, 413);
    const bytes = new Uint8Array(buf); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    const lang = new URL(req.url).searchParams.get("lang") === "de" ? "de" : "en"; // 🧩 练习课德语跟读：?lang=de
    try { const r = await env.AI.run("@cf/openai/whisper-large-v3-turbo", { audio: btoa(bin), language: lang }); if (r && r.text != null) return json({ ok: true, text: String(r.text).trim() }); } catch (e) {}
    const r = await env.AI.run("@cf/openai/whisper", { audio: [...bytes] });
    return json({ ok: true, text: String((r && r.text) || "").trim() });
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}

// GET /api/tts?t=英文句子&v=声音 → audio/mpeg：口语页的 AI 真人语音（Workers AI @cf/deepgram/aura-1，每 1,000 个字母约 1,364 neurons）
//   v 只能是 TTS_VOICES 里的；t 最长 1500 个字母。生成过的放进 Cloudflare 缓存（同一句不重复花额度）。
//   固定句子由 GitHub Actions（.github/workflows/tts.yml）每天用剩下的额度预先生成成 web/tts/*.mp3，网页优先播那些静态文件；这里只给 AI 回复、随机数字这类每次不同的句子用。
const TTS_VOICES = ["asteria", "luna", "stella", "athena", "hera", "orion", "arcas", "perseus", "angus", "orpheus", "helios", "zeus"];
const TTS_WIN = { at: 0, n: 0, day: "", dn: 0 };
async function tts(req, env, u, ctx) {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "GET") return json({ ok: false, error: "method" }, 405);
  if (!env.AI) return json({ ok: false, error: "noai" }, 503);
  const t = String(u.searchParams.get("t") || "").replace(/\s+/g, " ").trim(), v = u.searchParams.get("v") || "asteria";
  if (!t || t.length > 1500 || !/[a-z]/i.test(t)) return json({ ok: false, error: "text" }, 400);
  if (!TTS_VOICES.includes(v)) return json({ ok: false, error: "voice" }, 400);
  const key = new Request("https://tts.cache/" + v + "?t=" + encodeURIComponent(t)), cache = typeof caches !== "undefined" ? caches.default : null;
  try { const hit = cache && await cache.match(key); if (hit) return hit; } catch (e) {}
  // 防别人拿来白用 AI 额度（每天只有 1 万 neurons，约 7,000 个字母）：
  //   别的网站的网页来请求的不给（看 Origin，和浏览器自己带的 Sec-Fetch-Site：<audio> 跨站引用也会被认出来）；
  //   同一台机房 10 分钟内现做的最多 4,000 个字母、一天最多 12,000 个（每天预生成一次最多 3,600；网页上现做的都是一句一句的短句）
  const og = req.headers.get("origin") || "", sfs = req.headers.get("sec-fetch-site") || "";
  if (og && !/^(https:\/\/ruilearning-my\.pages\.dev|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?|chrome-extension:\/\/[a-z]+)$/.test(og)) return json({ ok: false, error: "origin" }, 403);
  if (sfs === "cross-site") return json({ ok: false, error: "origin" }, 403);
  const tday = useDay(); if (TTS_WIN.day !== tday) { TTS_WIN.day = tday; TTS_WIN.dn = 0; }
  if (Date.now() - TTS_WIN.at > 600e3) { TTS_WIN.at = Date.now(); TTS_WIN.n = 0; }
  if (TTS_WIN.n + t.length > 4000 || TTS_WIN.dn + t.length > 12000) return json({ ok: false, error: "busy" }, 429);
  TTS_WIN.n += t.length; TTS_WIN.dn += t.length;
  try {
    let r = await env.AI.run("@cf/deepgram/aura-1", { text: t, speaker: v, encoding: "mp3" });
    let body = r;
    if (r && typeof r === "object" && !(r instanceof ReadableStream) && !(r instanceof ArrayBuffer) && !ArrayBuffer.isView(r) && r.audio) { const b = atob(r.audio), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); body = a; }
    const buf = await new Response(body).arrayBuffer();
    if (buf.byteLength < 200) return json({ ok: false, error: "empty audio" }, 502);
    const res = new Response(buf, { headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*" } });
    if (cache) { const put = cache.put(key, res.clone()).catch(() => {}); if (ctx && ctx.waitUntil) ctx.waitUntil(put); else await put; }
    return res;
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 502); }
}

// GET/POST /api/px?u=<网址>：中国大陆打不开的几个外部服务（维基百科、维基词典、BBC 的图和音频、YouTube 缩略图、英文词典、LanguageTool）经后台转一手
// 只转名单里的网站；音频带 Range（能拖进度条）；图片在 Cloudflare 边缘缓存一天
const PX_HOSTS = { "en.wikipedia.org": /^\/w\/api\.php$/, "zh.wikipedia.org": /^\/w\/api\.php$/, "commons.wikimedia.org": /^\/w\/api\.php$/, "upload.wikimedia.org": /^\//, "thumb.wikimedia.org": /^\//, "ichef.bbci.co.uk": /^\//, "downloads.bbc.co.uk": /\.mp3$/, "voa-audio.voanews.eu": /\.mp3$/, "voa-video.voanews.eu": /\.mp3$/, "npr.simplecastaudio.com": /\.mp3$/, "npr.brightspotcdn.com": /^\/dims\d\//, "breakingnewsenglish.com": /^\/\d{4}\/[a-z0-9-]+\.(mp3|jpg)$/, "gdb.voanews.com": /^\//, "radiodownloaddw-a.akamaihd.net": /\.mp3$/, "i.ytimg.com": /^\/vi\//, "api.dictionaryapi.dev": /^\/(api\/v2\/entries|media)\//, "api.languagetool.org": /^\/v2\/check$/, "en.wiktionary.org": /^\/(api\/rest_v1\/page\/definition\/|w\/api\.php$)/ }; // 维基词典：插件查词（释义、是不是固定短语）
async function px(req, u) {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST", "access-control-allow-headers": "content-type,range" } });
  let t; try { t = new URL(u.searchParams.get("u") || ""); } catch (e) { return json({ ok: false, error: "bad url" }, 400); }
  const rule = PX_HOSTS[t.hostname]; if (t.protocol !== "https:" || !rule || !rule.test(t.pathname)) return json({ ok: false, error: "not allowed" }, 403);
  const post = req.method === "POST"; if (post && t.hostname !== "api.languagetool.org") return json({ ok: false, error: "method" }, 405);
  const h = { "User-Agent": "ruilearning-family-english/1.0 (https://ruilearning-my.pages.dev; low-volume cached proxy)", "Accept": req.headers.get("accept") || "*/*" }, range = req.headers.get("range");
  if (range) h.Range = range; if (post) h["Content-Type"] = req.headers.get("content-type") || "application/x-www-form-urlencoded";
  const img = /^(upload\.wikimedia\.org|thumb\.wikimedia\.org|ichef\.bbci\.co\.uk|i\.ytimg\.com|gdb\.voanews\.com|npr\.brightspotcdn\.com|breakingnewsenglish\.com)$/.test(t.hostname);
  let r; try { r = await fetch(t.toString(), { method: post ? "POST" : "GET", headers: h, body: post ? await req.text() : undefined, cf: !post && !range && !/\.mp3$/.test(t.pathname) ? { cacheEverything: true, cacheTtl: 86400 } : undefined }); } catch (e) { return json({ ok: false, error: "fetch failed" }, 502); }
  const out = new Headers({ "access-control-allow-origin": "*", "cache-control": r.ok && !post ? "public, max-age=86400" : "no-store" });
  for (const k of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]) { const v = r.headers.get(k); if (v) out.set(k, v); }
  return new Response(r.body, { status: r.status, headers: out });
}

// ---------- 🔋 AI 额度记账：GET /api/usage → 最近 7 天每天每个模型 / 每个功能用了多少 neurons（「📅 每日」最上面的额度面板用） ----------
// Workers AI 免费额度每天 1 万 neurons，00:00 UTC（北京 / 吉隆坡早上 8 点）重置。Cloudflare 没有给 Pages 直接查额度的绑定，这里自己记：
// 每次 env.AI.run 后按官方价格表（developers.cloudflare.com/workers-ai/platform/pricing）把用量折成 neurons——大模型按 AI 返回的 token 数
// （没有就按字数估），Whisper 按音频分钟，Aura 按字母数——是估算，精确数字以 Cloudflare 后台为准。
// 存法：同一个 isolate 里先攒着，第一次调用后约 15 秒写一次 KV「use/日期/随机号」（数字放在 metadata 里，读的时候 list 一次就全拿到，不用一个个 get），
// 这样一个 isolate 每分钟最多写 4 次（KV 免费每天 1000 次写）；保留 9 天。
const NRATE = { // neurons：大模型 [每百万输入 token, 每百万输出 token]；whisper 每分钟音频；aura 每千个字母
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": [26668, 204805], "@cf/meta/llama-4-scout-17b-16e-instruct": [24545, 77273], "@cf/meta/m2m100-1.2b": [31050, 31050],
  "@cf/openai/whisper-large-v3-turbo": 46.63, "@cf/openai/whisper": 41.14, "@cf/deepgram/aura-1": 1363.64,
};
const tokEst = s => Math.ceil(String(s || "").replace(/[　-鿿]/g, "xxxx").length / 4); // 英文约 4 个字母一个 token，汉字约一个字一个 token
function neuronsOf(m, inp, r) {
  const R = NRATE[m]; inp = inp || {};
  if (m === "@cf/deepgram/aura-1") return String(inp.text || "").length / 1000 * R;
  if (/whisper/.test(m)) {
    let sec = r && r.transcription_info && +r.transcription_info.duration;
    if (!sec && r && Array.isArray(r.segments) && r.segments.length) sec = +r.segments[r.segments.length - 1].end;
    if (!sec && r && Array.isArray(r.words) && r.words.length) sec = +r.words[r.words.length - 1].end;
    if (!sec) { const a = inp.audio; sec = (typeof a === "string" ? a.length * 0.75 : a ? a.length : 0) / 16000; } // 按 128kbps 估
    return (sec || 0) / 60 * (R || 46.63);
  }
  if (Array.isArray(R)) {
    const us = r && r.usage, i = us && +us.prompt_tokens || tokEst(inp.text || "") + (Array.isArray(inp.messages) ? inp.messages.reduce((a, x) => a + tokEst(x && x.content) + 4, 0) : 0);
    const o = us && +us.completion_tokens || tokEst(r && (r.translated_text || (typeof r.response === "string" ? r.response : JSON.stringify(r.response || ""))));
    return (i * R[0] + o * R[1]) / 1e6;
  }
  return 0;
}
const useDay = () => new Date().toISOString().slice(0, 10); // UTC 日期 = 额度的一天
let USE = null, useT = 0;
function useAdd(m, f, nu, err) {
  const d = useDay(); if (!USE || USE.d !== d) USE = { d, m: {}, f: {}, e: 0 };
  const k = m.replace(/^@cf\/[^/]+\//, ""), a = USE.m[k] || (USE.m[k] = [0, 0]), b = USE.f[f] || (USE.f[f] = [0, 0]);
  if (err) { USE.e++; return; }
  a[0]++; a[1] += nu; b[0]++; b[1] += nu;
}
async function useFlush(env) {
  const x = USE; USE = null; useT = 0; if (!x || !env.CAPTIONS || (!Object.keys(x.m).length && !x.e)) return;
  const r2 = v => Math.round(v * 10) / 10, md = { m: {}, f: {}, e: x.e };
  for (const k in x.m) md.m[k] = [x.m[k][0], r2(x.m[k][1])];
  for (const k in x.f) md.f[k] = [x.f[k][0], r2(x.f[k][1])];
  let s = JSON.stringify(md); if (s.length > 1000) { md.f = {}; s = JSON.stringify(md); } // metadata 最多 1024 字节：放不下就只记模型
  try { await env.CAPTIONS.put("use/" + x.d + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), s, { metadata: md, expirationTtl: 9 * 86400 }); } catch (e) {}
}
function meter(env, ctx, u) { // 包一层 env.AI：每次 run 记一笔；f = 哪个功能（/api/ai 的 task 进了函数再填）
  if (!env.AI || env.AI.__m) return env;
  const real = env.AI, tag = { f: u.pathname.replace(/^\/api\//, "") + (u.searchParams.has("al") ? ":al" : u.searchParams.get("zh") ? ":zh" : "") };
  const AI = { __m: 1, run: async (m, inp, o) => {
    let r; try { r = await real.run(m, inp, o); } catch (e) { useAdd(m, tag.f, 0, 1); kick(); throw e; }
    try { useAdd(m, tag.f, neuronsOf(m, inp, r)); } catch (e) {} kick(); return r;
  } };
  function kick() { if (useT || !ctx || !ctx.waitUntil) return; useT = 1; ctx.waitUntil(new Promise(res => setTimeout(res, 15000)).then(() => useFlush(env))); }
  return Object.assign({}, env, { AI, __use: tag });
}
// 精确数字：Pages 设置里配了 CF_API_TOKEN（权限只要「Account Analytics: Read」）和 CF_ACCOUNT_ID 时，按天、按模型读 Cloudflare 自己记的用量
// （GraphQL Analytics 的 aiInferenceAdaptiveGroups：sum.totalNeurons、count，按 date + modelId 分组；date 是 UTC 日期，和额度的一天一致）。
// 功能分布（哪个功能花了多少）Cloudflare 不知道，还是用上面自己记的。读不到（没配、密钥错、接口出错）就整个退回自己记的估算，并把原因带给网页。
async function cfUsage(env, from, to) {
  const q = "query($a:String!,$s:Date!,$e:Date!){viewer{accounts(filter:{accountTag:$a}){aiInferenceAdaptiveGroups(limit:1000,filter:{date_geq:$s,date_leq:$e},orderBy:[date_ASC]){count sum{totalNeurons} dimensions{date modelId}}}}}";
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: { Authorization: "Bearer " + env.CF_API_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ query: q, variables: { a: String(env.CF_ACCOUNT_ID).trim(), s: from, e: to } }) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error("Cloudflare 接口 " + r.status);
  if (j.errors && j.errors.length) throw new Error(String(j.errors[0].message || "GraphQL error").slice(0, 200));
  const acc = j.data && j.data.viewer && j.data.viewer.accounts && j.data.viewer.accounts[0]; if (!acc) throw new Error("账户 ID 不对，或密钥没有这个账户的权限");
  const days = {};
  for (const g of acc.aiInferenceAdaptiveGroups || []) {
    const d = g.dimensions && g.dimensions.date, m = String(g.dimensions && g.dimensions.modelId || "?").replace(/^@cf\/[^/]+\//, ""); if (!d) continue;
    const D = days[d] || (days[d] = { m: {} }), a = D.m[m] || (D.m[m] = [0, 0]); a[0] += +g.count || 0; a[1] += +(g.sum && g.sum.totalNeurons) || 0;
  }
  return days;
}
// 存储（Workers KV）的用量：同一个令牌（Account Analytics: Read）就能读。免费额度按 UTC 天：读 10 万、写 / 删 / 列出各 1000，存 1 GB
//   → { days: { "YYYY-MM-DD": { read, write, delete, list } }, keys, bytes }
async function cfKV(env, from, to) {
  const q = "query($a:String!,$s:Date!,$e:Date!){viewer{accounts(filter:{accountTag:$a}){kvOperationsAdaptiveGroups(limit:1000,filter:{date_geq:$s,date_leq:$e}){sum{requests} dimensions{date actionType}} kvStorageAdaptiveGroups(limit:100,filter:{date_geq:$s,date_leq:$e},orderBy:[date_DESC]){max{keyCount byteCount} dimensions{date namespaceId}}}}}";
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: { Authorization: "Bearer " + env.CF_API_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ query: q, variables: { a: String(env.CF_ACCOUNT_ID).trim(), s: from, e: to } }) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error("Cloudflare 接口 " + r.status);
  if (j.errors && j.errors.length) throw new Error(String(j.errors[0].message || "GraphQL error").slice(0, 200));
  const acc = j.data && j.data.viewer && j.data.viewer.accounts && j.data.viewer.accounts[0]; if (!acc) throw new Error("账户 ID 不对，或密钥没有这个账户的权限");
  const days = {};
  for (const g of acc.kvOperationsAdaptiveGroups || []) {
    const d = g.dimensions && g.dimensions.date, a = String(g.dimensions && g.dimensions.actionType || "").toLowerCase(); if (!d || !a) continue;
    const D = days[d] || (days[d] = { read: 0, write: 0, delete: 0, list: 0 }); D[a] = (D[a] || 0) + (+(g.sum && g.sum.requests) || 0);
  }
  // 存了多少：最新那天，各个命名空间加起来
  const st = acc.kvStorageAdaptiveGroups || [], last = st.length ? st[0].dimensions.date : "", seen = new Set(); let keys = 0, bytes = 0;
  for (const g of st) { if (g.dimensions.date !== last || seen.has(g.dimensions.namespaceId)) continue; seen.add(g.dimensions.namespaceId); keys += +(g.max && g.max.keyCount) || 0; bytes += +(g.max && g.max.byteCount) || 0; }
  return { days, keys, bytes, at: last };
}
// 🏆 家庭排行（「📅 每日」最上面）：GET /api/board?lang= → { ok, users: [{ id, name, days: { 日期: 卡片数 }, frz: [断签保护用掉的日期] }] }
//   每个人的卡片数取自他自己的插件数据「stat|日期」（「🔊 练习」每练一张记一笔，换设备也在），断签保护取自 /api/mine 的 daily「frz:日期」；
//   只给最近 60 天；只读，结果缓存 5 分钟（不写 KV）
async function board(req, env, u) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const kv = env.CAPTIONS; if (!kv) return json({ ok: false, error: "KV binding CAPTIONS is missing" }, 500);
  const lg = u.searchParams.get("lang") || ""; if (lg && !LANG_OK.test(lg)) return json({ ok: false, error: "bad lang" }, 400);
  const lp = lg && lg !== "en" ? "l/" + lg + "/" : "", cache = typeof caches !== "undefined" ? caches.default : null, ck = new Request("https://board.cache/v1?l=" + lp);
  if (cache) { const c = await cache.match(ck); if (c) return c; }
  try {
    const from = new Date(Date.now() + 8 * 3600e3 - 60 * 864e5).toISOString().slice(0, 10), out = [];
    for (const x of await usersList(kv, true)) {
      const pre = (x.id ? "u/" + x.id + "/" : "") + lp, [e, m] = await Promise.all([kv.get(pre + EXT_KEY, "json"), kv.get(pre + "mine:daily", "json")]), days = {}, frz = [];
      const it = (e && e.items) || {}; for (const k in it) if (k.indexOf("stat|") === 0 && k.slice(5) >= from && it[k] && !it[k].del && it[k].v) days[k.slice(5)] = +it[k].v.n || 0;
      const mi = (m && m.items) || {}; for (const k in mi) if (k.indexOf("frz:") === 0 && mi[k] && !mi[k].del && k.slice(4) >= from) frz.push(k.slice(4));
      out.push({ id: x.id, name: x.name, days, frz });
    }
    const res = new Response(JSON.stringify({ ok: true, users: out, at: Date.now() }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "max-age=300", "access-control-allow-origin": "*" } });
    if (cache) await cache.put(ck, res.clone());
    return res;
  } catch (er) { return json({ ok: false, error: String(er && er.message || er) }, 500); }
}
// 🔔 手机推送提醒（Web Push，不开网站也会弹）：
//   GET  ?key=1             → { key: VAPID 公钥 }（第一次用时生成一对，存在 KV「push:vapid」；写完再读一次，以存进去的为准）
//   POST {sub, u, lang, time:"HH:MM"}  订阅 / 改时间。一台设备（endpoint）可以挂好几组「人 + 语言」，每组一条（id = endpoint|人|语言 的哈希）
//   POST {sub, u, lang, off:1}          取消这一组（不影响同一台设备上别的家人 / 语言）
//   POST {renew:{old, sub}}              手机换了订阅（sw.js 的 pushsubscriptionchange）：把旧 endpoint 下的几组搬到新的
//   GET  ?peek=<endpoint 编号>          → { title, body, url }：手机收到推送后 sw.js 来取要显示的话（这台设备最近推的那一组）
//   POST {send:1}            → GitHub 定时任务（push.yml）每 30 分钟叫一次：到了各自的提醒时间（北京时间，之后 3 小时内，跨零点也算）、
//                              这一组今天还没推过、今天还没练够 20 张的，推一条（不带内容）
// 防滥用：endpoint 只认浏览器的推送服务（谷歌 / Mozilla / 苹果 / 微软）；最多 60 组；所有组记在一个索引键「push:subs」里（send 只读这一个键，不用 list）；
//   一组 90 天没续订就过期；推送服务说订阅没了（404 / 410）就删，连续 3 次 401 / 403 也删；send 本身只读，到点要推的才写
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uText = t => b64u(new TextEncoder().encode(t));
const hash16 = async t => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].slice(0, 8).map(x => x.toString(16).padStart(2, "0")).join("");
const PUSH_HOST = /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|[a-z0-9.-]*\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]*\.notify\.windows\.com)\//;
const PUSH_MAX = 60, PUSH_TTL = 90 * 86400e3;
async function vapid(kv) {
  let v = await kv.get("push:vapid", "json"); if (v && v.pub && v.jwk) return v;
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  v = { pub: b64u(await crypto.subtle.exportKey("raw", k.publicKey)), jwk: await crypto.subtle.exportKey("jwk", k.privateKey) }; await kv.put("push:vapid", JSON.stringify(v));
  const again = await kv.get("push:vapid", "json"); return again && again.pub ? again : v; // 两处同时第一次生成：以 KV 里最后存下的为准
}
async function vapidAuth(v, endpoint) {
  const aud = new URL(endpoint).origin, now = Math.floor(Date.now() / 1000);
  const head = b64uText(JSON.stringify({ typ: "JWT", alg: "ES256" })), body = b64uText(JSON.stringify({ aud, exp: now + 12 * 3600, sub: "https://ruilearning-my.pages.dev" }));
  const key = v.key || (v.key = await crypto.subtle.importKey("jwk", v.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"])); // 一次推送任务里只导入一次
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(head + "." + body));
  return "vapid t=" + head + "." + body + "." + b64u(sig) + ", k=" + v.pub;
}
// 这个人今天练了几张、连续几天（同 /api/board：插件数据的 stat|日期 + 断签保护）
async function pushInfo(kv, x, day0) { // day0：按哪天算（23:30 的提醒过了零点补推时算前一天）
  const pre = (x.u ? "u/" + x.u + "/" : "") + (x.lang && x.lang !== "en" ? "l/" + x.lang + "/" : ""), [e, m] = await Promise.all([kv.get(pre + EXT_KEY, "json"), kv.get(pre + "mine:daily", "json")]);
  const it = (e && e.items) || {}, mi = (m && m.items) || {}, day = day0 || bjDay(), act = d => { const r = it["stat|" + d]; return r && !r.del && r.v && +r.v.n > 0; }, frz = d => mi["frz:" + d] && !mi["frz:" + d].del;
  const prev = d => new Date(Date.parse(d + "T12:00:00Z") - 864e5).toISOString().slice(0, 10);
  let k = act(day) ? day : prev(day), st = 0, g = 0; while (g++ < 4000 && (act(k) || frz(k))) { if (act(k)) st++; k = prev(k); }
  const r = it["stat|" + day]; return { today: r && r.v ? +r.v.n || 0 : 0, streak: st };
}
function pushText(i, x, many) {
  const who = many && x && x.name ? x.name + "：" : "", lg = x && x.lang === "de" ? "德语" : "英语";
  if (!i.today) return { title: "📚 " + who + "今天还没练" + lg, body: i.streak ? "已经连续 " + i.streak + " 天了，练几张卡别断 🔥" : "打开练 10 张卡，几分钟就好", url: "/?go=pump" };
  return { title: "👍 " + who + "今天练了 " + i.today + " 张", body: "再来一组？" + (i.streak ? "连续 " + i.streak + " 天 🔥" : ""), url: "/?go=pump" };
}
const okTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || "");
// 现在是不是这组的提醒时间（之后 3 小时内），以及这次算哪一天的提醒（23:30 的提醒过了零点补推时，算前一天）
function pushDue(time, nowMs) {
  const bj = new Date(nowMs + 8 * 3600e3), nowMin = bj.getUTCHours() * 60 + bj.getUTCMinutes(), [h, m] = time.split(":").map(Number);
  const late = ((nowMin - (h * 60 + m)) % 1440 + 1440) % 1440;
  return { due: late <= 180, day: new Date(nowMs + 8 * 3600e3 - late * 60e3).toISOString().slice(0, 10) };
}
async function pushIdx(kv) { const L = (await kv.get("push:subs", "json")) || {}, now = Date.now(); for (const id in L) if (!(L[id].exp > now)) delete L[id]; return L; }
async function push(req, env, u) {
  if (req.method === "OPTIONS") return json({ ok: true });
  const kv = env.CAPTIONS; if (!kv) return json({ ok: false, error: "KV binding CAPTIONS is missing" }, 500);
  try {
    if (req.method === "GET") {
      if (u.searchParams.get("key")) return json({ ok: true, key: (await vapid(kv)).pub });
      const h = u.searchParams.get("peek") || ""; if (!/^[0-9a-f]{16}$/.test(h)) return json({ ok: false, error: "bad id" }, 400);
      const L = await pushIdx(kv), mine = Object.values(L).filter(x => x.e === h);
      if (!mine.length) return json(Object.assign({ ok: true }, pushText({ today: 0, streak: 0 })));
      const x = mine.sort((a, b) => (b.sent || 0) - (a.sent || 0))[0], recent = x.sent && Date.now() - x.sent < 4 * 3600e3 && x.last; // 刚推的那条：按提醒那天算
      return json(Object.assign({ ok: true }, pushText(await pushInfo(kv, x, recent || undefined), x, mine.length > 1)));
    }
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
    let b = null; try { b = JSON.parse((await req.text()) || "{}"); } catch (e) {} if (!isObj(b)) return json({ ok: false, error: "bad body" }, 400);
    if (b.send) { // 定时任务：只读索引；到点、今天没推过的才去读这个人的练习记录、推送、写一次
      const L = await pushIdx(kv), now = Date.now(), due = Object.entries(L).filter(([, x]) => { const d = pushDue(x.time, now); return d.due && x.last !== d.day; }), out = { sent: 0, skip: 0, gone: 0, fail: 0, due: due.length };
      if (!due.length) return json(Object.assign({ ok: true }, out));
      const v = await vapid(kv), info = {}, upd = {}, gone = new Set();
      for (const [id, x] of due.slice(0, 40)) { // 一次最多 40 组（免费版每个请求最多 50 个子请求）
        const d = pushDue(x.time, now), ik = x.u + "|" + x.lang + "|" + d.day, i = info[ik] || (info[ik] = await pushInfo(kv, x, d.day)); // 同一个人同一种语言只读一次练习记录；按提醒那天算（过零点补推算前一天）
        if (i.today >= 20) { upd[id] = { last: d.day }; out.skip++; continue; } // 那天已经练够了：不打扰
        const r = await fetch(x.ep, { method: "POST", headers: { TTL: "43200", Urgency: "normal", Authorization: await vapidAuth(v, x.ep), "Content-Length": "0" } }).catch(() => null);
        if (r && (r.status === 404 || r.status === 410 || r.status === 400)) { gone.add(id); out.gone++; continue; } // 订阅没了 / 坏了
        if (r && r.ok) { upd[id] = { last: d.day, sent: now, fail: 0, exp: now + PUSH_TTL }; out.sent++; }
        else { const f = (x.fail || 0) + 1; out.fail++; if ((r && (r.status === 401 || r.status === 403) && f >= 3) || f >= 10) { gone.add(id); out.gone++; } else upd[id] = { fail: f }; } // 401/403 三次、别的错连续 10 次：删
      }
      if (gone.size || Object.keys(upd).length) { // 写之前重新读一遍：推送这段时间里有人关掉 / 换了订阅，别被旧的盖回去
        const L2 = await pushIdx(kv); gone.forEach(id => delete L2[id]); for (const id in upd) if (L2[id]) Object.assign(L2[id], upd[id]);
        await kv.put("push:subs", JSON.stringify(L2));
      }
      return json(Object.assign({ ok: true }, out));
    }
    if (isObj(b.renew) && isObj(b.renew.sub) && typeof b.renew.old === "string" && PUSH_HOST.test(b.renew.sub.endpoint || "")) { // 手机换了订阅：搬过去
      const L = await pushIdx(kv), oe = await hash16(b.renew.old), ne = await hash16(b.renew.sub.endpoint); let n = 0;
      for (const id of Object.keys(L)) if (L[id].e === oe) { const x = L[id]; delete L[id]; const nid = await hash16(b.renew.sub.endpoint + "|" + x.u + "|" + x.lang); L[nid] = Object.assign(x, { e: ne, ep: b.renew.sub.endpoint, fail: 0, exp: Date.now() + PUSH_TTL }); n++; }
      if (n) await kv.put("push:subs", JSON.stringify(L)); return json({ ok: true, moved: n });
    }
    const sub = b.sub; if (!isObj(sub) || typeof sub.endpoint !== "string" || !PUSH_HOST.test(sub.endpoint) || sub.endpoint.length > 1000) return json({ ok: false, error: "bad sub" }, 400);
    const uid = /^[a-z0-9]{0,12}$/.test(b.u || "") ? b.u || "" : "", lg = LANG_OK.test(b.lang || "") ? b.lang : "en";
    const users = await usersList(kv); if (!users.some(x => x.id === uid)) return json({ ok: false, error: "unknown user" }, 404);
    const L = await pushIdx(kv), id = await hash16(sub.endpoint + "|" + uid + "|" + lg);
    if (b.off) { if (L[id]) { delete L[id]; await kv.put("push:subs", JSON.stringify(L)); } return json({ ok: true }); }
    const time = okTime(b.time) ? b.time : "20:00", old = L[id], now = Date.now();
    if (!old && Object.keys(L).length >= PUSH_MAX) return json({ ok: false, error: "too many" }, 429);
    const x = { e: await hash16(sub.endpoint), ep: sub.endpoint, u: uid, name: (users.find(y => y.id === uid) || {}).name || "", lang: lg, time, last: old && old.time === time ? old.last || "" : "", sent: old ? old.sent || 0 : 0, fail: 0, exp: now + PUSH_TTL };
    // 内容没变、离过期还早：不写（每次打开页面都会来续一次）
    if (!old || old.time !== time || old.ep !== x.ep || old.name !== x.name || old.exp - now < PUSH_TTL - 7 * 86400e3) { L[id] = x; await kv.put("push:subs", JSON.stringify(L)); }
    return json({ ok: true, id });
  } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
}
async function usage(req, env) {
  const cache = typeof caches !== "undefined" ? caches.default : null, ck = new Request("https://use.cache/v3");
  if (cache) { const c = await cache.match(ck); if (c) return c; }
  const days = {}, from = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  if (env.CAPTIONS) try { // 网站自己按功能记的账（每个功能花了多少）；读不到不影响 Cloudflare 的数字
    let cursor; do {
      const L = await env.CAPTIONS.list({ prefix: "use/", cursor }); cursor = L.list_complete ? null : L.cursor;
      for (const k of L.keys) {
        const d = k.name.slice(4, 14); if (d < from) continue; let md = k.metadata;
        if (!md) try { md = await env.CAPTIONS.get(k.name, "json"); } catch (e) {}
        if (!md) continue; const D = days[d] || (days[d] = { m: {}, f: {}, e: 0 });
        for (const g of ["m", "f"]) for (const n in md[g] || {}) { const a = D[g][n] || (D[g][n] = [0, 0]); a[0] += +md[g][n][0] || 0; a[1] += +md[g][n][1] || 0; }
        D.e += +md.e || 0;
      }
    } while (cursor);
  } catch (e) {}
  let src = "est", why = env.CF_API_TOKEN && env.CF_ACCOUNT_ID ? "" : "notset";
  if (!why) try { // 模型用量换成 Cloudflare 的精确数字；自己记的估算留在 est 里对照
    const C = await cfUsage(env, from, useDay());
    for (const d of new Set(Object.keys(days).concat(Object.keys(C)))) { const D = days[d] || (days[d] = { m: {}, f: {}, e: 0 }); D.est = D.m; D.m = (C[d] && C[d].m) || {}; }
    src = "cf";
  } catch (e) { why = String(e && e.message || e).slice(0, 200); }
  let kv = null;
  if (env.CF_API_TOKEN && env.CF_ACCOUNT_ID) try { kv = await cfKV(env, from, useDay()); } catch (e) { kv = { why: String(e && e.message || e).slice(0, 200) }; } // 读不到存储用量不影响 AI 那部分
  for (const d in days) for (const g of ["m", "f", "est"]) for (const n in days[d][g] || {}) days[d][g][n][1] = Math.round(days[d][g][n][1]);
  const now = new Date(), reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const res = new Response(JSON.stringify({ ok: true, src, why, today: useDay(), limit: 10000, reset, days, kv, kvLimit: { read: 100000, write: 1000, delete: 1000, list: 1000, bytes: 1e9 }, at: Date.now() }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "max-age=120" } });
  if (cache) await cache.put(ck, res.clone()); // Cloudflare 的数字有几分钟延迟，缓存 2 分钟（每次都要 list 一次 KV，list 一天只有 1000 次）
  return res;
}

export default {
  _pushDue: pushDue, // 测试用
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (u.pathname === "/api/usage") return usage(req, env);
    if (u.pathname === "/api/board") return board(req, env, u);
    if (u.pathname === "/api/push") return push(req, env, u);
    env = meter(env, ctx, u);
    if (API_PATHS.includes(u.pathname)) return cap(req, env, u);
    if (u.pathname === VOCAB_PATH) return vocab(req, env);
    if (u.pathname === "/api/users") return users(req, env);
    if (u.pathname === "/api/auth") return auth(req, env);
    if (u.pathname === EXT_PATH) return ext(req, env);
    if (u.pathname === MEDIA_PATH) return media(req, env);
    if (u.pathname === SENT_PATH) return sent(req, env, u);
    if (u.pathname === "/api/dict") return dict(req, env, u);
    if (u.pathname === "/api/mine") return mine(req, env, u);
    if (u.pathname === "/api/readurl") return readurl(req, env, u);
    if (u.pathname === "/api/news") return news(req, env, u);
    if (u.pathname === "/api/sme") return sme(req, env, u, ctx);
    if (u.pathname === "/api/dw") return dw(req, env, u);
    if (u.pathname === "/api/ai") return ai(req, env);
    if (u.pathname === "/api/stt") return stt(req, env);
    if (u.pathname === "/api/tts") return tts(req, env, u, ctx);
    if (u.pathname === "/api/px") return px(req, u);
    return env.ASSETS.fetch(req);
  }
};
