// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   VIP-ANAND-7525 | SENTINEL iNOTES ECOSYSTEM                            ║
// ║   server.js — Final Production Build (Render Optimized)                 ║
// ║   Stack: Express · Telegraf · Supabase · Moment.js                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝
"use strict";

// ─────────────────────────────────────────────────────────────────────────────
//  §1  IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
const express              = require("express");
const cors                 = require("cors");
const path                 = require("path");
const moment               = require("moment");
const { Telegraf, Markup } = require("telegraf");
const { createClient }     = require("@supabase/supabase-js");

// ─────────────────────────────────────────────────────────────────────────────
//  §2  ENVIRONMENT VARIABLES (set in Render Dashboard → Environment)
// ─────────────────────────────────────────────────────────────────────────────
const PORT         = process.env.PORT         || 10000;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://jecckogefamxionqdbby.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_qTXtquSTGI6VqJbuscf1lw_BA1AhG-_";
const BOT_TOKEN    = process.env.BOT_TOKEN    || "8618816305:AAEcABZIZJtkIB5gRUq43bNtXYh82U0yZZc";
const ADMIN_ID     = Number(process.env.ADMIN_ID) || 8084057668;

// ─────────────────────────────────────────────────────────────────────────────
//  §3  STARTUP ENV VALIDATION — crash early with a clear message
// ─────────────────────────────────────────────────────────────────────────────
(function validateEnv() {
  const needed  = { SUPABASE_URL, SUPABASE_KEY, BOT_TOKEN };
  const missing = Object.entries(needed)
    .filter(([, v]) => !v || String(v).trim() === "")
    .map(([k]) => k);
  if (missing.length) {
    console.error(`\n❌  FATAL — Missing env vars: ${missing.join(", ")}`);
    console.error("    Set them in Render Dashboard → Environment.\n");
    process.exit(1);
  }
  console.log("✅  Env vars OK.");
})();

// ─────────────────────────────────────────────────────────────────────────────
//  §4  INIT CLIENTS
// ─────────────────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot      = new Telegraf(BOT_TOKEN);
const app      = express();

// ─────────────────────────────────────────────────────────────────────────────
//  §5  MIDDLEWARE (order is critical — do NOT rearrange)
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"] }));
app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ─────────────────────────────────────────────────────────────────────────────
//  §6  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const isAdmin  = (ctx) => Number(ctx.from?.id) === ADMIN_ID;
const fmtDate  = (iso) => iso ? moment(iso).format("DD MMM YYYY, hh:mm A") : "N/A";
const dbErr    = (e)   => `❌ DB Error: ${e?.message ?? JSON.stringify(e)}`;

function generateKey() {
  const P = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += P[Math.floor(Math.random() * P.length)];
  return `VIP-${s}-ANAND`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  §7  HEALTH CHECK (Render keeps service alive)
// ─────────────────────────────────────────────────────────────────────────────
app.get("/health", (_, res) =>
  res.json({ status: "ok", service: "Sentinel iNotes", ts: moment().toISOString() })
);

// ─────────────────────────────────────────────────────────────────────────────
//  §8  TELEGRAM BOT — INLINE KEYBOARD
// ─────────────────────────────────────────────────────────────────────────────
const MENU = Markup.inlineKeyboard([
  [Markup.button.callback("📊 Stats",       "CB_STATS"),   Markup.button.callback("🔑 Gen Key",    "CB_GENKEY")],
  [Markup.button.callback("📄 Add PDF",     "CB_ADDPDF"),  Markup.button.callback("👥 View Users", "CB_USERS")],
  [Markup.button.callback("🔍 Find User",   "CB_SEARCH"),  Markup.button.callback("🗑 Flush Keys", "CB_FLUSH")],
  [Markup.button.callback("🚫 Ban User",    "CB_BAN"),     Markup.button.callback("📢 Broadcast",  "CB_BROADCAST")],
  [Markup.button.callback("📋 List PDFs",   "CB_LISTPDF"), Markup.button.callback("🔑 All Keys",   "CB_ALLKEYS")],
  [Markup.button.callback("🧹 Delete PDF",  "CB_DELPDF"),  Markup.button.callback("📈 Today Stats","CB_TODAY")],
]);

// ─────────────────────────────────────────────────────────────────────────────
//  §9  /start
// ─────────────────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("🚫 Not authorised.");
  return ctx.replyWithHTML(
    `<b>🛡 Sentinel iNotes — Admin Panel</b>\n<code>VIP-ANAND-7525</code>\n\nWelcome back, Commander.`,
    MENU
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  §10  CB_STATS
// ─────────────────────────────────────────────────────────────────────────────
bot.action("CB_STATS", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Denied");
  await ctx.answerCbQuery("Fetching…");
  try {
    const [rU, rN, rKA, rKU] = await Promise.all([
      supabase.from("users").select("*",       { count: "exact", head: true }),
      supabase.from("notes").select("*",       { count: "exact", head: true }),
      supabase.from("access_keys").select("*", { count: "exact", head: true }),
      supabase.from("access_keys").select("*", { count: "exact", head: true }).eq("is_used", true),
    ]);
    const tU = rU.count ?? 0, tN = rN.count ?? 0, tK = rKA.count ?? 0, uK = rKU.count ?? 0;
    await ctx.replyWithHTML(
      `<b>📊 Live Statistics</b>\n<i>${moment().format("DD MMM YYYY, hh:mm A")}</i>\n\n` +
      `👤 Users   →  <b>${tU}</b>\n📄 PDFs    →  <b>${tN}</b>\n` +
      `🔑 Keys    →  <b>${tK}</b> total / <b>${uK}</b> used / <b>${tK - uK}</b> free\n` +
      `📈 Usage   →  <b>${tK > 0 ? ((uK/tK)*100).toFixed(1) : 0}%</b>`
    );
  } catch (e) { ctx.reply(`❌ ${e.message}`); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  §11  CB_TODAY — registrations & keys used today
// ─────────────────────────────────────────────────────────────────────────────
bot.action("CB_TODAY", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Denied");
  await ctx.answerCbQuery("Loading…");
  try {
    const start = moment().startOf("day").toISOString();
    const [rU, rK] = await Promise.all([
      supabase.from("users").select("*",       { count: "exact", head: true }).gte("created_at", start),
      supabase.from("access_keys").select("*", { count: "exact", head: true }).gte("used_at", start).eq("is_used", true),
    ]);
    await ctx.replyWithHTML(
      `<b>📈 Today's Activity</b>\n<i>${moment().format("DD MMM YYYY")}</i>\n\n` +
      `👤 New Registrations  →  <b>${rU.count ?? 0}</b>\n` +
      `🔑 Keys Activated     →  <b>${rK.count ?? 0}</b>`
    );
  } catch (e) { ctx.reply(`❌ ${e.message}`); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  §12  CB_GENKEY prompt
// ─────────────────────────────────────────────────────────────────────────────
bot.action("CB_GENKEY", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Denied");
  await ctx.answerCbQuery();
  ctx.replyWithHTML(
    `<b>🔑 Generate Key</b>\n\nCommand:\n<code>/gen_key &lt;minutes&gt;</code>\n\nExample: <code>/gen_key 60</code>`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  §13  CB_ADDPDF prompt
// ─────────────────────────────────────────────────────────────────────────────
bot.action("CB_ADDPDF", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Denied");
  await ctx.answerCbQuery();
  ctx.replyWithHTML(
    `<b>📄 Add / Update PDF</b>\n\nCommand:\n<code>/update &lt;Subject&gt; | &lt;Link&gt;</code>\n\nExample:\n<code>/update Physics Ch3 | https://drive.google.com/...</code>`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  §14  CB_LISTPDF — list all PDFs in vault
// ─────────────────────────────────────────────────────────────────────────────
bot.action("CB_LISTPDF", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Denied");
  await ctx.answerCbQuery("Fetching PDFs…");
  try {
    const { data, error } = await supabase
      .from("notes").select("id, subject, created_at")
      .order("created_at", { ascending: false }).limit(30);
    if (error) return ctx.reply(dbErr(error));
    if (!data?.length) return ctx.reply("📭 No PDFs in vault.");
    const lines = data.map((n, i) => `${i+1}. <b>${n.subject}</b>  <i>${fmtDate(n.created_at)}</i>`);
    ctx.replyWithHTML(`<b>📄 PDF Vault (last 30)</b>\n\n${lines.join("\n")}`);
  } catch (e) { ctx.reply(`❌ ${e.message}`); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  §15  CB_DELPDF prompt
// ─────────────────────────────────────────────────────────────────────────────
bot.action("CB_DELPDF", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Denied");
  await ctx.answerCbQuery();
  ctx.replyWithHTML(
    `<b>🧹 Delete a PDF</b>\n\nCommand:\n<code>/delpdf &lt;Subject&gt;</code>\n\nExample: <code>/delpdf Physics Ch3</code>`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  §16  CB_ALLKEYS — list last 20 keys with status
// ─────────────────────────────────────────────────────────────────────────────
bot.action("CB_ALLKEYS", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Denied");
  await ctx.answerCbQuery("Loading keys…");
  try {
    const { data, error } = await supabase
      .from("access_keys")
      .select("key_code, is_used, used_by, expiry_time")
      .order("created_at", { ascending: false }).limit(20);
    if (error) return ctx.reply(dbErr(error));
    if (!data?.length) return ctx.reply("📭 No keys found.");
    const lines = data.map((k, i) => {
      const status  = k.is_used ? `✅ @${k.used_by}` : moment().isAfter(moment(k.expiry_time)) ? "❌ Expired" : "🟡 Active";
      return `${i+1}. <code>${k.key_code}</code>  ${status}`;
    });
    ctx.replyWithHTML(`<b>🔑 Recent Keys (last 20)</b>\n\n${lines.join("\n")}`);
  } catch (e) { ctx.reply(`❌ ${e.message}`); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  §17  CB_USERS
// ─────────────────────────────────────────────────────────────────────────────
bot.action("CB_USERS", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Denied");
  await ctx.answerCbQuery("Loading…");
  try {
    const { data, error } = await supabase
      .from("users").select("username, created_at")
      .order("created_at", { ascending: false }).limit(25);
    if (error) return ctx.reply(dbErr(error));
    if (!data?.length) return ctx.reply("📭 No users yet.");
    const lines = data.map((u, i) => `${i+1}. <code>${u.username}</code>  —  <i>${fmtDate(u.created_at)}</i>`);
    ctx.replyWithHTML(`<b>👥 Registered Users (last 25)</b>\n\n${lines.join("\n")}`);
  } catch (e) { ctx.reply(`❌ ${e.message}`); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  §18  CB_SEARCH / CB_BAN / CB_BROADCAST prompts
// ─────────────────────────────────────────────────────────────────────────────
bot.action("CB_SEARCH",    async (ctx) => { if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫"); await ctx.answerCbQuery(); ctx.replyWithHTML(`<b>🔍 Find User</b>\n\n<code>/find &lt;username&gt;</code>`); });
bot.action("CB_BAN",       async (ctx) => { if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫"); await ctx.answerCbQuery(); ctx.replyWithHTML(`<b>🚫 Ban User</b>\n\n<code>/ban &lt;username&gt;</code>`); });
bot.action("CB_BROADCAST", async (ctx) => { if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫"); await ctx.answerCbQuery(); ctx.replyWithHTML(`<b>📢 Broadcast</b>\n\n<code>/send &lt;message&gt;</code>`); });

// ─────────────────────────────────────────────────────────────────────────────
//  §19  CB_FLUSH — remove expired unused keys
// ─────────────────────────────────────────────────────────────────────────────
bot.action("CB_FLUSH", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Denied");
  await ctx.answerCbQuery("Flushing…");
  try {
    const { data, error } = await supabase.from("access_keys")
      .delete().lt("expiry_time", moment().toISOString()).eq("is_used", false).select();
    if (error) return ctx.reply(dbErr(error));
    ctx.replyWithHTML(`<b>🗑 Flush Done</b>\n\nRemoved <b>${data?.length ?? 0}</b> expired unused key(s).`);
  } catch (e) { ctx.reply(`❌ ${e.message}`); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  §20  BOT COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

bot.command("gen_key", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const mins = parseInt(ctx.message.text.trim().split(/\s+/)[1], 10);
  if (!mins || mins <= 0) return ctx.reply("⚠️ Usage: /gen_key <minutes>");
  const key = generateKey();
  const exp = moment().add(mins, "minutes").toISOString();
  try {
    const { error } = await supabase.from("access_keys").insert({ key_code: key, expiry_time: exp, is_used: false });
    if (error) return ctx.reply(dbErr(error));
    ctx.replyWithHTML(`<b>✅ Key Generated</b>\n\n🔑 <code>${key}</code>\n⏱ Valid: <b>${mins} min</b>\n📅 Expires: <b>${fmtDate(exp)}</b>`);
  } catch (e) { ctx.reply(`❌ ${e.message}`); }
});

bot.command("update", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const raw = ctx.message.text.replace(/^\/update\s*/i, "").trim();
  const idx = raw.indexOf("|");
  if (idx === -1) return ctx.reply("⚠️ Format: /update <Subject> | <Link>");
  const subject = raw.slice(0, idx).trim();
  const link    = raw.slice(idx + 1).trim();
  if (!subject || !link) return ctx.reply("⚠️ Both Subject and Link required.");
  try {
    const { error } = await supabase.from("notes").upsert({ subject, link }, { onConflict: "subject" });
    if (error) return ctx.reply(dbErr(error));
    ctx.replyWithHTML(`<b>✅ PDF Saved</b>\n\n📚 <b>${subject}</b>\n🔗 <a href="${link}">Open</a>`);
  } catch (e) { ctx.reply(`❌ ${e.message}`); }
});

bot.command("delpdf", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const subject = ctx.message.text.replace(/^\/delpdf\s*/i, "").trim();
  if (!subject) return ctx.reply("⚠️ Usage: /delpdf <Subject>");
  try {
    const { error } = await supabase.from("notes").delete().eq("subject", subject);
    if (error) return ctx.reply(dbErr(error));
    ctx.replyWithHTML(`<b>🧹 PDF Deleted</b>\n\nSubject <code>${subject}</code> removed from vault.`);
  } catch (e) { ctx.reply(`❌ ${e.message}`); }
});

bot.command("find", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const username = ctx.message.text.replace(/^\/find\s*/i, "").trim();
  if (!username) return ctx.reply("⚠️ Usage: /find <username>");
  try {
    const { data, error } = await supabase.from("users").select("username, created_at").eq("username", username).single();
    if (error || !data) return ctx.replyWithHTML(`❌ User <code>${username}</code> not found.`);
    ctx.replyWithHTML(`<b>🔍 Found</b>\n\n👤 <code>${data.username}</code>\n📅 Joined: <b>${fmtDate(data.created_at)}</b>`);
  } catch (e) { ctx.reply(`❌ ${e.message}`); }
});

bot.command("ban", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const username = ctx.message.text.replace(/^\/ban\s*/i, "").trim();
  if (!username) return ctx.reply("⚠️ Usage: /ban <username>");
  try {
    const { error } = await supabase.from("users").delete().eq("username", username);
    if (error) return ctx.reply(dbErr(error));
    ctx.replyWithHTML(`<b>🚫 Banned</b>\n\n<code>${username}</code> deleted. <i>${fmtDate(moment())}</i>`);
  } catch (e) { ctx.reply(`❌ ${e.message}`); }
});

bot.command("send", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const msg = ctx.message.text.replace(/^\/send\s*/i, "").trim();
  if (!msg) return ctx.reply("⚠️ Usage: /send <message>");
  try {
    const { count } = await supabase.from("users").select("*", { count: "exact", head: true });
    ctx.replyWithHTML(
      `<b>📢 Broadcast Logged</b>\n👥 <b>${count ?? 0}</b> user(s)\n📅 <b>${fmtDate(moment())}</b>\n\n<blockquote>${msg}</blockquote>`
    );
  } catch (e) { ctx.reply(`❌ ${e.message}`); }
});

// ─────────────────────────────────────────────────────────────────────────────
//  §21  REST — GET /api/all-notes
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/all-notes", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("notes").select("id, subject, link, created_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, notes: data ?? [] });
  } catch (e) {
    console.error("[GET /api/all-notes]", e.message);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  §22  REST — GET /api/key-info?key=VIP-XXXX-ANAND
//  Used by dashboard.html to show expiry on each card
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/key-info", async (req, res) => {
  try {
    const key = String(req.query.key || "").trim().toUpperCase();
    if (!key) return res.status(400).json({ success: false, message: "Key query param required." });

    const { data, error } = await supabase
      .from("access_keys")
      .select("key_code, expiry_time, is_used, used_by, used_at")
      .eq("key_code", key)
      .single();

    if (error || !data) return res.status(404).json({ success: false, message: "Key not found." });

    const expired = moment().isAfter(moment(data.expiry_time));

    res.json({
      success:    true,
      key_code:   data.key_code,
      expiry:     data.expiry_time,
      expiry_fmt: fmtDate(data.expiry_time),
      is_used:    data.is_used,
      used_by:    data.used_by,
      expired,
    });
  } catch (e) {
    console.error("[GET /api/key-info]", e.message);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  §23  REST — POST /api/register
//  login.html sends { username, password }
//  register.html sends { user, pass }
//  We handle BOTH field name styles here
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/register", async (req, res) => {
  try {
    // Accept both { user, pass } AND { username, password } for compatibility
    const rawUser = req.body.user || req.body.username;
    const rawPass = req.body.pass || req.body.password;

    if (!rawUser || String(rawUser).trim() === "")
      return res.status(400).json({ success: false, message: "Username is required." });
    if (!rawPass || String(rawPass).trim() === "")
      return res.status(400).json({ success: false, message: "Password is required." });
    if (String(rawPass).trim().length < 4)
      return res.status(400).json({ success: false, message: "Password must be at least 4 characters." });

    const cleanUser = String(rawUser).trim().toLowerCase();
    const cleanPass = String(rawPass).trim();

    // Check duplicate
    const { data: existing, error: chkErr } = await supabase
      .from("users").select("username").eq("username", cleanUser).maybeSingle();
    if (chkErr) {
      console.error("[POST /api/register] check:", chkErr.message);
      return res.status(500).json({ success: false, message: "Server error during check." });
    }
    if (existing)
      return res.status(409).json({ success: false, message: "Username already taken. Choose another." });

    const { error: insErr } = await supabase.from("users").insert({ username: cleanUser, password: cleanPass });
    if (insErr) {
      console.error("[POST /api/register] insert:", insErr.message);
      return res.status(500).json({ success: false, message: "Registration failed. Try again." });
    }

    res.json({ success: true, message: "Account created successfully!", username: cleanUser });
  } catch (e) {
    console.error("[POST /api/register]", e.message);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  §24  REST — POST /api/login
//  login.html sends: { username, password }
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || String(username).trim() === "")
      return res.status(400).json({ success: false, message: "Username is required." });
    if (!password || String(password).trim() === "")
      return res.status(400).json({ success: false, message: "Password is required." });

    const { data, error } = await supabase
      .from("users").select("username, password")
      .eq("username", String(username).trim().toLowerCase())
      .eq("password", String(password).trim())
      .single();

    if (error || !data)
      return res.status(401).json({ success: false, message: "Invalid username or password." });

    res.json({ success: true, message: "Login successful.", username: data.username });
  } catch (e) {
    console.error("[POST /api/login]", e.message);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  §25  REST — POST /api/verify-key
//  dashboard.html sends: { username, key_code }
//  7-step activation hub
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/verify-key", async (req, res) => {
  const { username, key_code } = req.body;

  // A — validate
  if (!key_code  || String(key_code).trim()  === "")
    return res.status(400).json({ success: false, message: "Access key is required." });
  if (!username  || String(username).trim()  === "")
    return res.status(400).json({ success: false, message: "Username is required." });

  const cleanKey  = String(key_code).trim().toUpperCase();
  const cleanUser = String(username).trim().toLowerCase();

  // B — fetch key
  let keyRec;
  try {
    const { data, error } = await supabase
      .from("access_keys").select("key_code, expiry_time, is_used, used_by")
      .eq("key_code", cleanKey).single();
    if (error || !data)
      return res.status(404).json({ success: false, message: "Key not found. Check and try again." });
    keyRec = data;
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error fetching key." });
  }

  // C — already used?
  if (keyRec.is_used)
    return res.status(409).json({ success: false, message: `Key already used${keyRec.used_by ? " by @"+keyRec.used_by : ""}.` });

  // D — expired?
  const now    = moment();
  const expiry = moment(keyRec.expiry_time);
  if (now.isAfter(expiry))
    return res.status(410).json({ success: false, message: `Key expired on ${fmtDate(keyRec.expiry_time)}.` });

  // E — check if user exists (maybeSingle — never crashes on miss)
  let existingUser = null;
  try {
    const { data, error } = await supabase
      .from("users").select("username").eq("username", cleanUser).maybeSingle();
    if (error) return res.status(500).json({ success: false, message: "Server error checking user." });
    existingUser = data;
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error checking user." });
  }

  // F — insert new user
  if (!existingUser) {
    try {
      const { error } = await supabase.from("users").insert({ username: cleanUser, password: cleanKey });
      if (error) return res.status(500).json({ success: false, message: "Failed to create account." });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server error creating account." });
    }
  }

  // G — mark key used
  try {
    const { error } = await supabase.from("access_keys")
      .update({ is_used: true, used_by: cleanUser, used_at: now.toISOString() })
      .eq("key_code", cleanKey);
    if (error) return res.status(500).json({ success: false, message: "Activated but key mark failed." });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error marking key." });
  }

  res.json({
    success:  true,
    message:  existingUser ? "Key accepted. Logging in." : "Account activated. Welcome!",
    username: cleanUser,
    expiry:   keyRec.expiry_time,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  §26  HTML PAGE ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.get("/",          (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/login",     (_, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/register",  (_, res) => res.sendFile(path.join(__dirname, "public", "register.html")));
app.get("/dashboard", (_, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));

// ─────────────────────────────────────────────────────────────────────────────
//  §27  404 + GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, error: `${req.method} ${req.path} not found.` }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[GlobalError]", err.stack);
  res.status(500).json({ success: false, error: "Unexpected server error." });
});

// ─────────────────────────────────────────────────────────────────────────────
//  §28  BOOT SERVER
// ─────────────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  🛡  SENTINEL iNOTES — ONLINE                    ║");
  console.log(`║  🌐  0.0.0.0:${PORT}                              ║`);
  console.log("║  📦  VIP-ANAND-7525 | Final Build                ║");
  console.log("╚══════════════════════════════════════════════════╝");
});

// ─────────────────────────────────────────────────────────────────────────────
//  §29  BOT LAUNCH + GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────
bot.launch({ dropPendingUpdates: true })
  .then(() => console.log(`✅  Bot live. Admin: ${ADMIN_ID}`))
  .catch((e) => console.error("❌  Bot failed:", e.message));

function shutdown(sig) {
  console.log(`\n⚠️  ${sig} — shutting down…`);
  bot.stop(sig);
  server.close(() => { console.log("✅  Closed."); process.exit(0); });
  setTimeout(() => process.exit(1), 8000);
}
process.once("SIGINT",  () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException",  (e) => console.error("[uncaught]",  e.message));
process.on("unhandledRejection", (r) => console.error("[unhandled]", r));

// ── END OF FILE ───────────────────────────────────────────────────────────────
