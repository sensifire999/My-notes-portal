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

// 1. Config
const SUPABASE_URL  = process.env.SUPABASE_URL || "https://jecckogefamxionqdbby.supabase.co";
const SUPABASE_KEY  = process.env.SUPABASE_KEY || "sb_publishable_qTXtquSTGI6VqJbuscf1lw_BA1AhG-_";
const BOT_TOKEN     = process.env.BOT_TOKEN     || "8618816305:AAEcABZIZJtkIB5gRUq43bNtXYh82U0yZZc";
const ADMIN_ID      = 8084057668;

// 2. Initialize Clients
const app = express();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new Telegraf(BOT_TOKEN);

// 3. Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/** Guard: only ADMIN_ID may use admin commands */
const isAdmin = (ctx) => Number(ctx.from?.id) === ADMIN_ID; 

/** Generate a key like VIP-XXXX-ANAND */
function generateKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let seg = "";
  for (let i = 0; i < 4; i++) seg += chars[Math.floor(Math.random() * chars.length)];
  return `VIP-${seg}-ANAND`;
}

/** Pretty-print a Supabase error */
const supaErr = (e) => (e ? `❌ DB Error: ${e.message}` : null);

// ── Main Menu Markup ─────────────────────────────────────────
const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback("📊 Stats", "stats"), Markup.button.callback("🔑 Gen Key", "gen_key_prompt")],
  [Markup.button.callback("📄 Add PDF", "add_pdf_prompt"), Markup.button.callback("👥 View Users", "view_users")],
  [Markup.button.callback("🔍 Search User", "search_prompt"), Markup.button.callback("🗑 Flush Expired", "flush_expired")],
  [Markup.button.callback("🚫 Ban User", "ban_prompt"), Markup.button.callback("📢 Broadcast", "broadcast_prompt")],
]);

// ── /start ───────────────────────────────────────────────────
bot.start((ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("🚫 Unauthorised.");
  ctx.replyWithHTML(
    `<b>🛡 Sentinel iNotes Admin Panel</b>\n<i>VIP-ANAND-7525</i>\n\nSelect an action:`,
    mainMenu
  );
});

// ── Callback Actions ─────────────────────────────────────────

// Stats
bot.action("stats", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.answerCbQuery();
  const [{ count: userCount }, { count: noteCount }, { count: keyCount }] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("notes").select("*", { count: "exact", head: true }),
    supabase.from("access_keys").select("*", { count: "exact", head: true }),
  ]);
  const { count: usedKeys } = await supabase
    .from("access_keys")
    .select("*", { count: "exact", head: true })
    .eq("is_used", true);
  ctx.replyWithHTML(
    `<b>📊 System Stats</b>\n\n` +
    `👤 Users: <b>${userCount ?? 0}</b>\n` +
    `📄 PDFs: <b>${noteCount ?? 0}</b>\n` +
    `🔑 Total Keys: <b>${keyCount ?? 0}</b>\n` +
    `✅ Used Keys: <b>${usedKeys ?? 0}</b>\n` +
    `🟡 Unused Keys: <b>${(keyCount ?? 0) - (usedKeys ?? 0)}</b>`
  );
});

// Gen Key (prompt)
bot.action("gen_key_prompt", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.answerCbQuery();
  ctx.reply("🔑 Send: /gen_key <minutes>\nExample: /gen_key 60");
});

// Add PDF (prompt)
bot.action("add_pdf_prompt", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.answerCbQuery();
  ctx.reply("📄 Send: /update <Subject> | <Link>\nExample: /update Physics Ch1 | https://drive.google.com/...");
});

// View Users
bot.action("view_users", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.answerCbQuery();
  const { data, error } = await supabase.from("users").select("username, created_at").order("created_at", { ascending: false }).limit(20);
  if (error) return ctx.reply(supaErr(error));
  if (!data?.length) return ctx.reply("No users found.");
  const list = data.map((u, i) => `${i + 1}. <b>${u.username}</b> — ${moment(u.created_at).format("DD MMM YYYY")}`).join("\n");
  ctx.replyWithHTML(`<b>👥 Registered Users (last 20)</b>\n\n${list}`);
});

// Search (prompt)
bot.action("search_prompt", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.answerCbQuery();
  ctx.reply("🔍 Send: /find <username>");
});

// Flush Expired Keys
bot.action("flush_expired", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.answerCbQuery();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("access_keys")
    .delete()
    .lt("expiry_time", now)
    .eq("is_used", false)
    .select();
  if (error) return ctx.reply(supaErr(error));
  ctx.reply(`🗑 Flushed <b>${data?.length ?? 0}</b> expired unused key(s).`, { parse_mode: "HTML" });
});

// Ban (prompt)
bot.action("ban_prompt", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.answerCbQuery();
  ctx.reply("🚫 Send: /ban <username>");
});

// Broadcast (prompt)
bot.action("broadcast_prompt", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.answerCbQuery();
  ctx.reply("📢 Send: /send <Your message here>");
});

// ── Commands ─────────────────────────────────────────────────

/** /gen_key <minutes> */
bot.command("gen_key", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const parts = ctx.message.text.split(" ");
  const mins = parseInt(parts[1]);
  if (isNaN(mins) || mins <= 0) return ctx.reply("Usage: /gen_key <minutes>");
  const keyCode = generateKey();
  const expiryTime = moment().add(mins, "minutes").toISOString();
  const { error } = await supabase.from("access_keys").insert({ key_code: keyCode, expiry_time: expiryTime, is_used: false });
  if (error) return ctx.reply(supaErr(error));
  ctx.replyWithHTML(
    `<b>✅ Key Generated!</b>\n\n` +
    `🔑 Key: <code>${keyCode}</code>\n` +
    `⏱ Valid for: <b>${mins} minutes</b>\n` +
    `🕐 Expires at: <b>${moment(expiryTime).format("DD MMM YYYY, hh:mm A")}</b>`
  );
});

/** /update Subject | Link */
bot.command("update", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const raw = ctx.message.text.replace("/update", "").trim();
  const [subject, link] = raw.split("|").map((s) => s.trim());
  if (!subject || !link) return ctx.reply("Usage: /update <Subject> | <Link>");
  const { error } = await supabase.from("notes").upsert({ subject, link }, { onConflict: "subject" });
  if (error) return ctx.reply(supaErr(error));
  ctx.replyWithHTML(`<b>✅ PDF Note Saved!</b>\n\n📚 Subject: <b>${subject}</b>\n🔗 Link: ${link}`);
});

/** /ban <username> */
bot.command("ban", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const username = ctx.message.text.replace("/ban", "").trim();
  if (!username) return ctx.reply("Usage: /ban <username>");
  const { error } = await supabase.from("users").delete().eq("username", username);
  if (error) return ctx.reply(supaErr(error));
  ctx.replyWithHTML(`<b>🚫 User Banned</b>\n\nUsername <code>${username}</code> removed from the system.`);
});

/** /find <username> */
bot.command("find", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const username = ctx.message.text.replace("/find", "").trim();
  if (!username) return ctx.reply("Usage: /find <username>");
  const { data, error } = await supabase.from("users").select("*").eq("username", username).maybeSingle();
  if (error || !data) return ctx.reply(`❌ User "${username}" not found.`);
  ctx.replyWithHTML(
    `<b>🔍 User Found</b>\n\n` +
    `👤 Username: <code>${data.username}</code>\n` +
    `📅 Joined: <b>${moment(data.created_at).format("DD MMM YYYY, hh:mm A")}</b>`
  );
});

/** /send <message> */
bot.command("send", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const message = ctx.message.text.replace("/send", "").trim();
  if (!message) return ctx.reply("Usage: /send <message>");
  const { data: users, error } = await supabase.from("users").select("username");
  if (error) return ctx.reply(supaErr(error));
  ctx.replyWithHTML(
    `<b>📢 Broadcast Sent</b>\n\nMessage logged for <b>${users?.length ?? 0}</b> user(s).\n\n<i>Note: Telegram user IDs not stored — message logged to system.</i>\n\n"${message}"`
  );
});

// ── REST API Endpoints ────────────────────────────────────────

// Expiry time fetch karne ke liye route
app.get('/api/key-info', async (req, res) => {
    const { key } = req.query;
    if (!key) return res.json({ success: false, message: "No key provided" });

    try {
        const { data, error } = await supabase
            .from('access_keys')
            .select('expiry_time')
            .eq('key_code', key)
            .single();
        
        if (error || !data) {
            console.log("Key not found in DB");
            return res.json({ success: false });
        }
        res.json({ success: true, expiry: data.expiry_time });
    } catch (e) {
        console.error("Server error in key-info:", e);
        res.status(500).json({ success: false });
    }
});

/** GET /api/all-notes */
app.get("/api/all-notes", async (req, res) => {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, notes: data });
});

/** POST /api/login */
app.post("/api/login", async (req, res) => {
  // Support both 'username'/'user' and 'password'/'pass' variables from frontend
  const userStr = req.body.username || req.body.user;
  const passStr = req.body.password || req.body.pass;

  if (!userStr || !passStr)
    return res.status(400).json({ success: false, message: "Username and password required." });

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", userStr)
    .eq("password", passStr)
    .maybeSingle(); 

  if (error || !data)
    return res.status(401).json({ success: false, message: "Invalid credentials." });

  res.json({ success: true, message: "Login successful.", username: data.username });
});

/** POST /api/verify-key */
app.post("/api/verify-key", async (req, res) => {
  // Support variable names from different frontend logic
  const keyCode = req.body.key_code || req.body.key;
  const userStr = req.body.username || req.body.user;

  if (!keyCode || !userStr)
    return res.status(400).json({ success: false, message: "Key and username required." });

  const { data: keyData, error } = await supabase
    .from("access_keys")
    .select("*")
    .eq("key_code", keyCode)
    .maybeSingle(); 

  if (error || !keyData)
    return res.status(404).json({ success: false, message: "Key not found." });

  if (keyData.is_used)
    return res.status(409).json({ success: false, message: "Key already used." });

  const now = moment();
  const expiry = moment(keyData.expiry_time);
  if (now.isAfter(expiry))
    return res.status(410).json({ success: false, message: "Key has expired." });

  // Mark as used
  const { error: updateError } = await supabase
    .from("access_keys")
    .update({ is_used: true, used_by: userStr, used_at: now.toISOString() })
    .eq("key_code", keyCode);

  if (updateError)
    return res.status(500).json({ success: false, message: "Failed to activate key." });

  // Register user if not exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("username")
    .eq("username", userStr)
    .maybeSingle(); 

  if (!existingUser) {
    await supabase.from("users").insert({ username: userStr, password: keyCode });
  }

  res.json({ success: true, message: "Key verified. Account activated.", username: userStr });
});

/** Serve HTML pages */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));

// ── Launch ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Sentinel iNotes Server running on port ${PORT}`);
  console.log(`🤖 Launching Telegram Admin Bot...\n`);
});

bot.launch().then(() => console.log("✅ Bot is live.")).catch(err => console.error(err));

process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
