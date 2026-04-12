// ╔══════════════════════════════════════════════════════════════════════════╗
// ║         VIP-ANAND-7525 | SENTINEL iNOTES ECOSYSTEM                      ║
// ║         server.js — Render.com Optimized Production Build               ║
// ║         Stack : Express.js · Telegraf · Supabase · Moment.js            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

"use strict";

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

const express              = require("express");
const cors                 = require("cors");
const path                 = require("path");
const moment               = require("moment");
const { Telegraf, Markup } = require("telegraf");
const { createClient }     = require("@supabase/supabase-js");

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — ENVIRONMENT VARIABLES
//  ✅ Render injects process.env.PORT automatically — never hardcode it.
//  ✅ All secrets come from Render Dashboard → Environment → Add Variable.
//  ✅ Fallbacks are provided so local dev still works without a .env file.
// ─────────────────────────────────────────────────────────────────────────────

const PORT         = process.env.PORT         || 10000;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://jecckogefamxionqdbby.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_qTXtquSTGI6VqJbuscf1lw_BA1AhG-_";
const BOT_TOKEN    = process.env.BOT_TOKEN    || "8618816305:AAEcABZIZJtkIB5gRUq43bNtXYh82U0yZZc";
const ADMIN_ID     = Number(process.env.ADMIN_ID) || 8084057668;

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — VALIDATE REQUIRED ENVIRONMENT VARIABLES ON STARTUP
//  Crash early with a clear message if a critical variable is missing.
//  This prevents silent runtime failures on Render.
// ─────────────────────────────────────────────────────────────────────────────

(function validateEnv() {
  const required = { SUPABASE_URL, SUPABASE_KEY, BOT_TOKEN };
  const missing  = Object.entries(required)
    .filter(([, v]) => !v || v.trim() === "")
    .map(([k])    => k);

  if (missing.length > 0) {
    console.error(`\n❌  FATAL: Missing required environment variables: ${missing.join(", ")}`);
    console.error("    Set them in Render Dashboard → Your Service → Environment.\n");
    process.exit(1);
  }

  console.log("✅  Environment variables validated.");
})();

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4 — INITIALISE CLIENTS
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot      = new Telegraf(BOT_TOKEN);
const app      = express();

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5 — EXPRESS MIDDLEWARE  (order is critical — do not rearrange)
// ─────────────────────────────────────────────────────────────────────────────

// 5-a  CORS — allow all origins; handles OPTIONS pre-flight for browser clients
app.use(cors({
  origin:         "*",
  methods:        ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.options("*", cors());

// 5-b  Body parsers — MUST be declared before any route reads req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5-c  Serve static files from /public (login.html, dashboard.html, assets)
app.use(express.static(path.join(__dirname, "public")));

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 6 — RENDER HEALTH-CHECK ENDPOINT
//  Render pings GET / or a custom path to confirm the service is alive.
//  Returning 200 immediately prevents unnecessary restart cycles.
// ─────────────────────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.status(200).json({
    status:    "ok",
    service:   "Sentinel iNotes",
    version:   "3.0.0",
    timestamp: moment().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 7 — UTILITY / HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * isAdmin — Strict equality using Number() cast.
 * Prevents false-negatives when Telegraf exposes ctx.from.id as a string.
 */
function isAdmin(ctx) {
  return Number(ctx.from?.id) === ADMIN_ID;
}

/**
 * generateKey — Random 4-char alphanumeric segment wrapped in VIP-XXXX-ANAND.
 * 36 chars in pool → 36^4 = 1,679,616 unique combinations.
 */
function generateKey() {
  const POOL    = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let   segment = "";
  for (let i = 0; i < 4; i++) {
    segment += POOL[Math.floor(Math.random() * POOL.length)];
  }
  return `VIP-${segment}-ANAND`;
}

/** fmtDate — Human-readable timestamp. */
function fmtDate(iso) {
  if (!iso) return "N/A";
  return moment(iso).format("DD MMM YYYY, hh:mm A");
}

/** dbErrMsg — Normalise a Supabase error object to a display string. */
function dbErrMsg(e) {
  return `❌ DB Error: ${e?.message ?? JSON.stringify(e)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 8 — TELEGRAM BOT — INLINE KEYBOARD MAIN MENU
// ─────────────────────────────────────────────────────────────────────────────

const MAIN_MENU = Markup.inlineKeyboard([
  [
    Markup.button.callback("📊  Stats",      "CB_STATS"),
    Markup.button.callback("🔑  Gen Key",    "CB_GENKEY"),
  ],
  [
    Markup.button.callback("📄  Add PDF",    "CB_ADDPDF"),
    Markup.button.callback("👥  View Users", "CB_USERS"),
  ],
  [
    Markup.button.callback("🔍  Find User",  "CB_SEARCH"),
    Markup.button.callback("🗑  Flush Keys", "CB_FLUSH"),
  ],
  [
    Markup.button.callback("🚫  Ban User",   "CB_BAN"),
    Markup.button.callback("📢  Broadcast",  "CB_BROADCAST"),
  ],
]);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 9 — BOT COMMAND: /start
// ─────────────────────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply("🚫 You are not authorised to use this panel.");
  }
  return ctx.replyWithHTML(
    `<b>🛡 Sentinel iNotes — Admin Panel</b>\n` +
    `<code>VIP-ANAND-7525</code>\n\n` +
    `Welcome back, Commander.\n` +
    `Select an action from the menu below:`,
    MAIN_MENU
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 10 — BOT CALLBACK: CB_STATS
//  Fetches live counts from all three tables + computes key usage ratio.
// ─────────────────────────────────────────────────────────────────────────────

bot.action("CB_STATS", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Access denied.");
  await ctx.answerCbQuery("Fetching live stats…");

  try {
    const [rUsers, rNotes, rKeysAll, rKeysUsed] = await Promise.all([
      supabase.from("users").select("*",       { count: "exact", head: true }),
      supabase.from("notes").select("*",       { count: "exact", head: true }),
      supabase.from("access_keys").select("*", { count: "exact", head: true }),
      supabase.from("access_keys")
        .select("*", { count: "exact", head: true })
        .eq("is_used", true),
    ]);

    const totalUsers   = rUsers.count    ?? 0;
    const totalNotes   = rNotes.count    ?? 0;
    const totalKeys    = rKeysAll.count  ?? 0;
    const usedKeys     = rKeysUsed.count ?? 0;
    const unusedKeys   = totalKeys - usedKeys;
    const usagePct     = totalKeys > 0
      ? ((usedKeys / totalKeys) * 100).toFixed(1)
      : "0.0";

    await ctx.replyWithHTML(
      `<b>📊 Sentinel iNotes — Live Statistics</b>\n` +
      `<i>${moment().format("DD MMM YYYY, hh:mm A")}</i>\n\n` +
      `👤 Registered Users   →  <b>${totalUsers}</b>\n` +
      `📄 PDF Notes in Vault →  <b>${totalNotes}</b>\n` +
      `─────────────────────────────\n` +
      `🔑 Total Keys Issued  →  <b>${totalKeys}</b>\n` +
      `✅ Keys Used          →  <b>${usedKeys}</b>\n` +
      `🟡 Keys Available     →  <b>${unusedKeys}</b>\n` +
      `📈 Usage Ratio        →  <b>${usagePct}%</b>`
    );
  } catch (err) {
    await ctx.reply(`❌ Stats fetch failed: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 11 — BOT CALLBACK: CB_GENKEY
// ─────────────────────────────────────────────────────────────────────────────

bot.action("CB_GENKEY", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Access denied.");
  await ctx.answerCbQuery();
  await ctx.replyWithHTML(
    `<b>🔑 Generate an Access Key</b>\n\n` +
    `Use the command below:\n` +
    `<code>/gen_key &lt;minutes&gt;</code>\n\n` +
    `<b>Example:</b> <code>/gen_key 60</code>\n` +
    `<i>Creates a VIP-XXXX-ANAND key valid for the given minutes.</i>`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 12 — BOT CALLBACK: CB_ADDPDF
// ─────────────────────────────────────────────────────────────────────────────

bot.action("CB_ADDPDF", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Access denied.");
  await ctx.answerCbQuery();
  await ctx.replyWithHTML(
    `<b>📄 Add or Update a PDF Note</b>\n\n` +
    `Use the command below:\n` +
    `<code>/update &lt;Subject&gt; | &lt;Link&gt;</code>\n\n` +
    `<b>Example:</b>\n` +
    `<code>/update Physics Ch3 | https://drive.google.com/...</code>\n\n` +
    `<i>Uses upsert — if the subject exists, the link is updated automatically.</i>`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 13 — BOT CALLBACK: CB_USERS  (last 25 registrations)
// ─────────────────────────────────────────────────────────────────────────────

bot.action("CB_USERS", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Access denied.");
  await ctx.answerCbQuery("Loading user list…");

  try {
    const { data, error } = await supabase
      .from("users")
      .select("username, created_at")
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) return ctx.reply(dbErrMsg(error));
    if (!data || data.length === 0) return ctx.reply("📭 No users registered yet.");

    const lines = data.map(
      (u, i) =>
        `${i + 1}. <code>${u.username}</code>  —  <i>${fmtDate(u.created_at)}</i>`
    );

    await ctx.replyWithHTML(
      `<b>👥 Registered Users (Latest 25)</b>\n\n${lines.join("\n")}`
    );
  } catch (err) {
    await ctx.reply(`❌ Failed to load users: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 14 — BOT CALLBACK: CB_SEARCH
// ─────────────────────────────────────────────────────────────────────────────

bot.action("CB_SEARCH", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Access denied.");
  await ctx.answerCbQuery();
  await ctx.replyWithHTML(
    `<b>🔍 Search for a User</b>\n\nSend:\n<code>/find &lt;username&gt;</code>\n\n` +
    `<b>Example:</b> <code>/find john_doe</code>`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 15 — BOT CALLBACK: CB_FLUSH  (remove expired unused keys)
// ─────────────────────────────────────────────────────────────────────────────

bot.action("CB_FLUSH", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Access denied.");
  await ctx.answerCbQuery("Flushing expired keys…");

  try {
    const now = moment().toISOString();
    const { data, error } = await supabase
      .from("access_keys")
      .delete()
      .lt("expiry_time", now)
      .eq("is_used", false)
      .select();

    if (error) return ctx.reply(dbErrMsg(error));

    const removed = data?.length ?? 0;
    await ctx.replyWithHTML(
      `<b>🗑 Flush Complete</b>\n\n` +
      `Removed <b>${removed}</b> expired, unused key(s).\n` +
      `<i>Timestamp: ${moment().format("DD MMM YYYY, hh:mm A")}</i>`
    );
  } catch (err) {
    await ctx.reply(`❌ Flush failed: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 16 — BOT CALLBACK: CB_BAN
// ─────────────────────────────────────────────────────────────────────────────

bot.action("CB_BAN", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Access denied.");
  await ctx.answerCbQuery();
  await ctx.replyWithHTML(
    `<b>🚫 Ban / Remove a User</b>\n\nSend:\n<code>/ban &lt;username&gt;</code>\n\n` +
    `<b>Example:</b> <code>/ban john_doe</code>\n\n` +
    `<i>Permanently deletes the user from the users table.</i>`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 17 — BOT CALLBACK: CB_BROADCAST
// ─────────────────────────────────────────────────────────────────────────────

bot.action("CB_BROADCAST", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("🚫 Access denied.");
  await ctx.answerCbQuery();
  await ctx.replyWithHTML(
    `<b>📢 Broadcast a Message</b>\n\nSend:\n<code>/send &lt;your message&gt;</code>\n\n` +
    `<b>Example:</b> <code>/send Chemistry Ch5 notes are live!</code>`
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 18 — BOT COMMAND: /gen_key <minutes>
// ─────────────────────────────────────────────────────────────────────────────

bot.command("gen_key", async (ctx) => {
  if (!isAdmin(ctx)) return;

  const parts   = ctx.message.text.trim().split(/\s+/);
  const minutes = parseInt(parts[1], 10);

  if (!parts[1] || isNaN(minutes) || minutes <= 0) {
    return ctx.reply("⚠️ Usage: /gen_key <minutes>\nExample: /gen_key 60");
  }

  const keyCode    = generateKey();
  const expiryTime = moment().add(minutes, "minutes").toISOString();

  try {
    const { error } = await supabase
      .from("access_keys")
      .insert({ key_code: keyCode, expiry_time: expiryTime, is_used: false });

    if (error) return ctx.reply(dbErrMsg(error));

    await ctx.replyWithHTML(
      `<b>✅ Access Key Generated</b>\n\n` +
      `🔑 Key Code    :  <code>${keyCode}</code>\n` +
      `⏱ Valid For    :  <b>${minutes} minute(s)</b>\n` +
      `📅 Expires At  :  <b>${fmtDate(expiryTime)}</b>\n\n` +
      `<i>Share this key with the student to activate their account.</i>`
    );
  } catch (err) {
    await ctx.reply(`❌ Key generation failed: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 19 — BOT COMMAND: /update <Subject> | <Link>
// ─────────────────────────────────────────────────────────────────────────────

bot.command("update", async (ctx) => {
  if (!isAdmin(ctx)) return;

  const raw     = ctx.message.text.replace(/^\/update\s*/i, "").trim();
  const pipeIdx = raw.indexOf("|");

  if (pipeIdx === -1) {
    return ctx.reply("⚠️ Format: /update <Subject> | <Link>");
  }

  const subject = raw.slice(0, pipeIdx).trim();
  const link    = raw.slice(pipeIdx + 1).trim();

  if (!subject || !link) {
    return ctx.reply("⚠️ Both Subject and Link are required.");
  }

  try {
    const { error } = await supabase
      .from("notes")
      .upsert({ subject, link }, { onConflict: "subject" });

    if (error) return ctx.reply(dbErrMsg(error));

    await ctx.replyWithHTML(
      `<b>✅ PDF Note Saved to Vault</b>\n\n` +
      `📚 Subject  :  <b>${subject}</b>\n` +
      `🔗 Link     :  <a href="${link}">Open Link</a>`
    );
  } catch (err) {
    await ctx.reply(`❌ Update failed: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 20 — BOT COMMAND: /find <username>
// ─────────────────────────────────────────────────────────────────────────────

bot.command("find", async (ctx) => {
  if (!isAdmin(ctx)) return;

  const username = ctx.message.text.replace(/^\/find\s*/i, "").trim();
  if (!username) return ctx.reply("⚠️ Usage: /find <username>");

  try {
    const { data, error } = await supabase
      .from("users")
      .select("username, created_at")
      .eq("username", username)
      .single();

    if (error || !data) {
      return ctx.replyWithHTML(`❌ User <code>${username}</code> not found.`);
    }

    await ctx.replyWithHTML(
      `<b>🔍 User Record Found</b>\n\n` +
      `👤 Username  :  <code>${data.username}</code>\n` +
      `📅 Joined    :  <b>${fmtDate(data.created_at)}</b>`
    );
  } catch (err) {
    await ctx.reply(`❌ Search failed: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 21 — BOT COMMAND: /ban <username>
// ─────────────────────────────────────────────────────────────────────────────

bot.command("ban", async (ctx) => {
  if (!isAdmin(ctx)) return;

  const username = ctx.message.text.replace(/^\/ban\s*/i, "").trim();
  if (!username) return ctx.reply("⚠️ Usage: /ban <username>");

  try {
    const { error } = await supabase
      .from("users")
      .delete()
      .eq("username", username);

    if (error) return ctx.reply(dbErrMsg(error));

    await ctx.replyWithHTML(
      `<b>🚫 User Banned & Removed</b>\n\n` +
      `Username <code>${username}</code> deleted.\n` +
      `<i>${moment().format("DD MMM YYYY, hh:mm A")}</i>`
    );
  } catch (err) {
    await ctx.reply(`❌ Ban failed: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 22 — BOT COMMAND: /send <message>
// ─────────────────────────────────────────────────────────────────────────────

bot.command("send", async (ctx) => {
  if (!isAdmin(ctx)) return;

  const message = ctx.message.text.replace(/^\/send\s*/i, "").trim();
  if (!message) return ctx.reply("⚠️ Usage: /send <message>");

  try {
    const { count, error } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (error) return ctx.reply(dbErrMsg(error));

    await ctx.replyWithHTML(
      `<b>📢 Broadcast Logged</b>\n\n` +
      `👥 Audience  :  <b>${count ?? 0} registered user(s)</b>\n` +
      `📅 Time      :  <b>${moment().format("DD MMM YYYY, hh:mm A")}</b>\n\n` +
      `<b>Message:</b>\n<blockquote>${message}</blockquote>`
    );
  } catch (err) {
    await ctx.reply(`❌ Broadcast failed: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 23 — REST API: GET /api/all-notes
// ─────────────────────────────────────────────────────────────────────────────

app.get("/api/all-notes", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("notes")
      .select("id, subject, link, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/all-notes]", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, notes: data ?? [] });
  } catch (err) {
    console.error("[GET /api/all-notes] Exception:", err.message);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 24 — REST API: POST /api/login
//  Expects body: { user, pass }
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/login", async (req, res) => {
  try {
    const { user, pass } = req.body;

    if (!user || String(user).trim() === "") {
      return res.status(400).json({ success: false, message: "Username is required." });
    }
    if (!pass || String(pass).trim() === "") {
      return res.status(400).json({ success: false, message: "Password is required." });
    }

    const { data, error } = await supabase
      .from("users")
      .select("username, password")
      .eq("username", String(user).trim())
      .eq("password", String(pass).trim())
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }

    return res.status(200).json({
      success:  true,
      message:  "Login successful.",
      username: data.username,
    });
  } catch (err) {
    console.error("[POST /api/login] Exception:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 25 — REST API: POST /api/verify-key
//  The full registration hub — 7 guarded steps, each in its own try-catch.
//  Expects body: { key_code, user }
//
//  Step A — Validate input fields
//  Step B — Fetch key record from access_keys
//  Step C — Check if key is already used
//  Step D — Check expiry via moment ISO comparison
//  Step E — Check if username already exists (maybeSingle — no crash on miss)
//  Step F — Insert new user if they don't exist yet
//  Step G — Mark key as used and log used_by + used_at
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/verify-key", async (req, res) => {

  // ── Step A: Input validation ──────────────────────────────────────────────
  const { key_code, user } = req.body;

  if (!key_code || String(key_code).trim() === "") {
    return res.status(400).json({ success: false, message: "Access key is required." });
  }
  if (!user || String(user).trim() === "") {
    return res.status(400).json({ success: false, message: "Username is required." });
  }

  const cleanKey  = String(key_code).trim().toUpperCase();
  const cleanUser = String(user).trim().toLowerCase();

  // ── Step B: Fetch the key record ──────────────────────────────────────────
  let keyRecord;
  try {
    const { data, error } = await supabase
      .from("access_keys")
      .select("key_code, expiry_time, is_used, used_by")
      .eq("key_code", cleanKey)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Key not found. Please double-check and try again.",
      });
    }
    keyRecord = data;
  } catch (err) {
    console.error("[POST /api/verify-key] Step B exception:", err.message);
    return res.status(500).json({ success: false, message: "Server error while looking up key." });
  }

  // ── Step C: Already used? ─────────────────────────────────────────────────
  if (keyRecord.is_used === true) {
    return res.status(409).json({
      success: false,
      message: `This key has already been used${keyRecord.used_by ? " by @" + keyRecord.used_by : ""}.`,
    });
  }

  // ── Step D: Expired? ──────────────────────────────────────────────────────
  const now    = moment();
  const expiry = moment(keyRecord.expiry_time);

  if (now.isAfter(expiry)) {
    return res.status(410).json({
      success: false,
      message: `This key expired on ${fmtDate(keyRecord.expiry_time)}.`,
    });
  }

  // ── Step E: Does the username already exist? (uses maybeSingle) ───────────
  let existingUser = null;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("username")
      .eq("username", cleanUser)
      .maybeSingle();

    if (error) {
      console.error("[POST /api/verify-key] Step E exception:", error.message);
      return res.status(500).json({ success: false, message: "Server error during user check." });
    }
    existingUser = data;
  } catch (err) {
    console.error("[POST /api/verify-key] Step E unhandled:", err.message);
    return res.status(500).json({ success: false, message: "Server error during user lookup." });
  }

  // ── Step F: Insert new user (only if they don't already exist) ────────────
  if (!existingUser) {
    try {
      const { error: insertError } = await supabase
        .from("users")
        .insert({ username: cleanUser, password: cleanKey });

      if (insertError) {
        console.error("[POST /api/verify-key] Step F insert error:", insertError.message);
        return res.status(500).json({
          success: false,
          message: "Failed to create user account. Please try again.",
        });
      }
    } catch (err) {
      console.error("[POST /api/verify-key] Step F exception:", err.message);
      return res.status(500).json({ success: false, message: "Server error while creating account." });
    }
  }

  // ── Step G: Mark key as used and log metadata ─────────────────────────────
  try {
    const { error: updateError } = await supabase
      .from("access_keys")
      .update({
        is_used:  true,
        used_by:  cleanUser,
        used_at:  now.toISOString(),
      })
      .eq("key_code", cleanKey);

    if (updateError) {
      console.error("[POST /api/verify-key] Step G update error:", updateError.message);
      return res.status(500).json({
        success: false,
        message: "Account created but failed to mark key as used. Contact admin.",
      });
    }
  } catch (err) {
    console.error("[POST /api/verify-key] Step G exception:", err.message);
    return res.status(500).json({ success: false, message: "Server error while activating key." });
  }

  // ── All steps passed ──────────────────────────────────────────────────────
  return res.status(200).json({
    success:  true,
    message:  existingUser
      ? "Key accepted. You are already registered — logging you in."
      : "Key verified. Account created. Welcome to Sentinel iNotes!",
    username: cleanUser,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 26 — STATIC HTML PAGE ROUTES
//  Named routes so direct URL access works (e.g., render.com/dashboard).
// ─────────────────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 27 — 404 FALLBACK
// ─────────────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error:   `Route '${req.method} ${req.path}' not found.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 28 — GLOBAL ERROR HANDLER
//  Must have 4 parameters — Express identifies it as an error handler by that.
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Global Error Handler]", err.stack || err.message);
  res.status(500).json({ success: false, error: "Unexpected internal server error." });
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 29 — SERVER BOOT
//  ONE app.listen call — bound to 0.0.0.0 as required by Render.
// ─────────────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║   🛡  SENTINEL iNOTES — SERVER ONLINE                  ║");
  console.log(`║   🌐  Bound to 0.0.0.0:${PORT}                           ║`);
  console.log("║   📦  VIP-ANAND-7525  |  Render Production Build       ║");
  console.log("╚════════════════════════════════════════════════════════╝");
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 30 — TELEGRAM BOT LAUNCH
//  Long-polling mode — works perfectly on Render Web Services.
// ─────────────────────────────────────────────────────────────────────────────

bot
  .launch({ dropPendingUpdates: true })
  .then(() => {
    console.log(`✅  Telegram Admin Bot is live.`);
    console.log(`🤖  Admin ID: ${ADMIN_ID}\n`);
  })
  .catch((err) => {
    console.error("❌  Bot launch failed:", err.message);
  });

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 31 — GRACEFUL SHUTDOWN
//  Closes the HTTP server cleanly before Node exits.
//  Render sends SIGTERM when it shuts down or restarts your service.
// ─────────────────────────────────────────────────────────────────────────────

function gracefulShutdown(signal) {
  console.log(`\n⚠️  ${signal} received — shutting down gracefully…`);
  bot.stop(signal);
  server.close(() => {
    console.log("✅  HTTP server closed. Goodbye.\n");
    process.exit(0);
  });

  // Force exit if server hasn't closed within 8 seconds
  setTimeout(() => {
    console.error("❌  Forced shutdown after timeout.");
    process.exit(1);
  }, 8000);
}

process.once("SIGINT",  () => gracefulShutdown("SIGINT"));
process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle uncaught exceptions — log them but don't crash silently
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err.message, err.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

// ─────────────────────────────────────────────────────────────────────────────
//  END OF FILE — server.js  |  VIP-ANAND-7525 | Sentinel iNotes
//  Render-Optimized Build — PORT via env · 0.0.0.0 bind · graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────
