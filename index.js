require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'kas.json');

// load or init kas.json
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const start = parseInt(process.env.STARTING_KAS) || 0;
    fs.writeFileSync(DATA_FILE, JSON.stringify({ total: start }, null, 2));
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Gagal parsing kas.json, mereset ke 0', e);
    fs.writeFileSync(DATA_FILE, JSON.stringify({ total: 0 }, null, 2));
    return { total: 0 };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let data = loadData();

// helper: parse amount string like "50.000" or "1,234,567" or "1000" -> integer 50000/...
function parseAmount(str) {
  // remove non-digit characters (except possible decimal comma/dot) but we assume whole numbers
  // For strictness, we only accept digits, dots, commas
  const cleaned = str.replace(/[^0-9.,]/g, '');
  // remove dots and commas
  const digits = cleaned.replace(/[.,]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  return parseInt(digits, 10);
}

// helper: format integer -> "50.000$"
function formatCurrency(num) {
  const s = String(num);
  // insert dot as thousand separator
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '$';
}

// Strict regex for exact format:
// ^(deposit|withdraw) by ([^.]+)\.\s*([0-9.,]+)\$\s*to\s*(.+)$
// - group 1: deposit/withdraw
// - group 2: name sender (anything until the dot)
// - group 3: amount (digits + separators)
// - group 4: recipient (rest)
const COMMAND_REGEX = /^(deposit|withdraw) by ([^.]+)\.\s*([0-9.,]+)\$\s*to\s*(.+)$/i;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  try {
    // ignore bot messages
    if (message.author.bot) return;

    const content = message.content.trim();
    const match = content.match(COMMAND_REGEX);
    if (!match) return; // strict: ignore if not matching exactly

    const action = match[1].toLowerCase(); // deposit or withdraw
    const byName = match[2].trim();
    const amountRaw = match[3].trim();
    const toName = match[4].trim();

    const amount = parseAmount(amountRaw);
    if (amount === null || isNaN(amount) || amount <= 0) {
      return message.reply('Format jumlah tidak valid. Contoh: `deposit by Daniel. 50.000$ to Wana Wani`');
    }

    if (action === 'deposit') {
    data.total += amount;
    saveData(data);

    const reply = `
**📥 DEPOSIT REPORT**
\`\`\`
Deposit by   : ${byName}
Deposit      : ${formatCurrency(amount)}
Deposit to   : ${toName}
Total Kas    : ${formatCurrency(data.total)}
\`\`\`
`;
    return message.reply(reply);
}
 else if (action === 'withdraw') {
    if (amount > data.total) {
        return message.reply(`Saldo kas tidak cukup. Total Kas saat ini: ${formatCurrency(data.total)}`);
    }

    data.total -= amount;
    saveData(data);

    const reply = `
**📤 WITHDRAW REPORT**
\`\`\`
Withdraw by   : ${byName}
Withdraw      : ${formatCurrency(amount)}
Withdraw to   : ${toName}
Total Kas     : ${formatCurrency(data.total)}
\`\`\`
`;
    return message.reply(reply);
}

  } catch (err) {
    console.error('Error handling message:', err);
    message.reply('Terjadi error saat memproses perintah.');
  }
});

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN missing in .env');
  process.exit(1);
}
client.login(token);
