// ============================================================
//  VIP-ANAND-7525 | Sentinel iNotes Ecosystem
//  server.js — Express + Telegraf + Supabase Backend
// ============================================================

require("dotenv").config();
const express = require("express");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");
const { createClient } = require("@supabase/supabase-js");
const moment = require("moment");

// ── 1. CONFIG & INITIALIZATION ──────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL  = process.env.SUPABASE_URL || "https://jecckogefamxionqdbby.supabase.co";
const SUPABASE_KEY  = process.env.SUPABASE_KEY || "sb_publishable_qTXtquSTGI6VqJbuscf1lw_BA1AhG-_";
const BOT_TOKEN     = process.env.BOT_TOKEN     || "8618816305:AAEcABZIZJtkIB5gRUq43bNtXYh82U0yZZc";
const ADMIN_ID      = 8084057668;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new Telegraf(BOT_TOKEN);

// ── 2. MIDDLEWARES ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ── 3. HELPERS ──────────────────────────────────────────────
const isAdmin = (ctx) => Number(ctx.from?.id) === ADMIN_ID;

function generateKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let seg = "";
  for (let i = 0; i < 4; i++) seg += chars[Math.floor(Math.random() * chars.length)];
  return `VIP-${seg}-ANAND`;
}

const supaErr = (e) => (e ? `❌ DB Error: ${e.message}` : null);

// ── 4. TELEGRAM ADMIN BOT LOGIC ──────────────────────────────
const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback("📊 Stats", "stats"), Markup.button.callback("🔑 Gen Key", "gen_key_prompt")],
  [Markup.button.callback("📄 Add PDF", "add_pdf_prompt"), Markup.button.callback("👥 View Users", "view_users")],
  [Markup.button.callback("🔍 Search User", "search_prompt"), Markup.button.callback("🗑 Flush Expired", "flush_expired")],
  [Markup.button.callback("🚫 Ban User", "ban_prompt"), Markup.button.callback("📢 Broadcast", "broadcast_prompt")],
]);

bot.start((ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("🚫 Unauthorised.");
  ctx.replyWithHTML(`<b>🛡 Sentinel iNotes Admin Panel</b>\n<i>VIP-ANAND-7525</i>\n\nSelect an action:`, mainMenu);
});

bot.action("stats", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.answerCbQuery();
  const [{ count: userCount }, { count: noteCount }, { count: keyCount }] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("notes").select("*", { count: "exact", head: true }),
    supabase.from("access_keys").select("*", { count: "exact", head: true }),
  ]);
  const { count: usedKeys } = await supabase.from("access_keys").select("*", { count: "exact", head: true }).eq("is_used", true);
  ctx.replyWithHTML(`<b>📊 Stats</b>\n👤 Users: ${userCount}\n📄 PDFs: ${noteCount}\n🔑 Total Keys: ${keyCount}\n✅ Used: ${usedKeys}`);
});

bot.command("gen_key", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const mins = parseInt(ctx.message.text.split(" ")[1]);
  if (isNaN(mins) || mins <= 0) return ctx.reply("Usage: /gen_key <minutes>");
  const keyCode = generateKey();
  const expiryTime = moment().add(mins, "minutes").toISOString();
  await supabase.from("access_keys").insert({ key_code: keyCode, expiry_time: expiryTime, is_used: false });
  ctx.replyWithHTML(`<b>✅ Key Generated!</b>\n🔑 <code>${keyCode}</code>\n⏱ Valid for: ${mins} mins`);
});

bot.command("update", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const raw = ctx.message.text.replace("/update", "").trim();
  const [subject, link] = raw.split("|").map((s) => s.trim());
  if (!subject || !link) return ctx.reply("Usage: /update Subject | Link");
  await supabase.from("notes").upsert({ subject, link }, { onConflict: "subject" });
  ctx.replyWithHTML(`<b>✅ PDF Saved!</b>\n📚 ${subject}`);
});

// ── 5. REST API ENDPOINTS ────────────────────────────────────
app.get('/api/key-info', async (req, res) => {
    const { key } = req.query;
    if (!key) return res.json({ success: false });
    const { data, error } = await supabase.from('access_keys').select('expiry_time').eq('key_code', key).single();
    if (error || !data) return res.json({ success: false });
    res.json({ success: true, expiry: data.expiry_time });
});

app.post('/api/verify-key', async (req, res) => {
    const { username, key_code } = req.body;
    const { data: keyData, error } = await supabase.from('access_keys').select('*').eq('key_code', key_code).maybeSingle();
    
    if (error || !keyData || keyData.is_used || new Date(keyData.expiry_time) < new Date()) {
        return res.json({ success: false, message: "Invalid/Expired Key" });
    }

    await supabase.from('access_keys').update({ is_used: true, used_by: username, used_at: new Date() }).eq('key_code', key_code);
    
    const { data: exUser } = await supabase.from("users").select("username").eq("username", username).maybeSingle();
    if (!exUser) await supabase.from("users").insert({ username, password: key_code });
    
    res.json({ success: true });
});

app.get("/api/all-notes", async (req, res) => {
  const { data, error } = await supabase.from("notes").select("*").order("created_at", { ascending: false });
  res.json({ success: !error, notes: data });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const { data, error } = await supabase.from("users").select("*").eq("username", username).eq("password", password).maybeSingle();
  if (error || !data) return res.status(401).json({ success: false });
  res.json({ success: true, username: data.username });
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));

// ── 6. FINAL LAUNCH ──────────────────────────────────────────
// Is listen block ko kabhi duplicate mat karna
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sentinel Server live on port ${PORT}`);
});

bot.launch().then(() => console.log("✅ Bot is live."));

process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
