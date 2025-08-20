// server.js (Versi dengan Perbaikan Saldo & Logging Detail)

// --- BAGIAN 1: SETUP SERVER & BOT (Sama seperti sebelumnya) ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mysql = require('mysql2/promise');
const Binance = require('node-binance-api');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));

const binance = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_API_SECRET,
  test: true // JANGAN LUPA INI PENTING UNTUK TESTNET
});

async function generateGrid() {
    logAndEmit("??  Mendeteksi perubahan pada grid_range.txt. Membuat ulang grid...");
    try {
        const rangeData = await fs.promises.readFile('grid_range.txt', 'utf8');
        const [low, high, gridCount] = rangeData.split(',').map(Number);
        if (!low || !high || !gridCount) throw new Error("Format grid_range.txt salah.");
        
        logAndEmit(`Range baru: Low=${low}, High=${high}, Count=${gridCount}`);
        const step = (high - low) / (gridCount - 1);
        const entry = low + (step * Math.floor(gridCount / 2));

        await dbPool.query("TRUNCATE TABLE grid_orders");
        logAndEmit("Membersihkan grid lama...");

        for (let i = 0; i < gridCount; i++) {
            const price = parseFloat((low + i * step).toFixed(2));
            let type = (price < entry) ? 'BUY' : (price > entry) ? 'SELL' : null;
            if (type) {
                await dbPool.query("INSERT INTO grid_orders (type, price, status) VALUES (?, ?, 'OPEN')", [type, price]);
            }
        }
        logAndEmit("? Grid baru berhasil dibuat!");
        // Kirim update ke semua klien dashboard
        const [grids] = await dbPool.query("SELECT * FROM grid_orders ORDER BY id ASC");
        io.emit('grid_update', grids);
    } catch (error) {
        logAndEmit("? Gagal membuat grid: " + error.message);
    }
}

const dbPool = mysql.createPool({
    host: '127.0.0.1',
    user: 'u116133173_botbinance',
    password: '@Yogabd46botbinance',
    database: 'u116133173_bot_binance',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Konfigurasi Email... (sama seperti sebelumnya)

// --- BAGIAN 2: FUNGSI-FUNGSI BANTUAN ---
function logAndEmit(message) {
    console.log(message);
    io.emit('new_log', message);
}
// Fungsi sendEmailNotification... (sama seperti sebelumnya)


// --- BAGIAN 3: LOGIKA INTI TRADING (DENGAN LOGGING DETAIL) ---
async function processGridLogic(priceData) {
    // --- PERBAIKAN (GUARD CLAUSE) ---
    // Periksa apakah data harga valid sebelum melakukan apapun.
    if (!priceData || !priceData.c || !isFinite(priceData.c)) {
        // Jika tidak valid, abaikan pesan ini dan keluar dari fungsi.
        return; 
    }
    // --- AKHIR PERBAIKAN ---

    const current_price = parseFloat(priceData.c);
    
    try {
        logAndEmit(`?? Memeriksa grid dengan harga: ${current_price}`);
        const [rows] = await dbPool.query("SELECT * FROM grid_orders WHERE status = 'OPEN' ORDER BY id ASC");
        
        if (rows.length === 0) {
            // Kita bisa hentikan log ini agar tidak terlalu ramai
            // logAndEmit("?? Tidak ada grid aktif untuk diperiksa.");
            return;
        }
        logAndEmit(`?? Menemukan ${rows.length} grid 'OPEN'.`);

        for (const grid of rows) {
            // ... sisa kode Anda tetap sama ...
        }
    } catch (error) {
        logAndEmit("? Error saat memproses grid: " + error.message);
    }
}

// --- BAGIAN BARU: FILE WATCHER UNTUK GRID OTOMATIS ---
const chokidar = require('chokidar');
const watcher = chokidar.watch('grid_range.txt', { persistent: true });

logAndEmit("?? Mengawasi file grid_range.txt untuk perubahan...");

watcher.on('change', path => {
    logAndEmit(`?? File ${path} telah berubah. Memproses grid baru...`);
    generateGrid(); // Panggil fungsi yang baru kita pindahkan
});

// --- BAGIAN 4: KONEKSI & SERVER (DENGAN PERBAIKAN SALDO) ---
logAndEmit("▶️ Bot & Server dimulai...");

binance.websockets.miniTicker(markets => {
    if (markets.ETHUSDT) {
        io.emit('price_update', markets.ETHUSDT.close);
        processGridLogic(markets.ETHUSDT);
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    logAndEmit(`✅ Server dashboard berjalan di http://localhost:${PORT}`);
});

io.on('connection', async (socket) => {
    logAndEmit(`🔌 Klien baru terhubung ke dashboard.`);
    
    // PERBAIKAN UNTUK MENGAMBIL SALDO
    try {
        logAndEmit("Mengambil data grid awal untuk klien baru...");
        const [grids] = await dbPool.query("SELECT * FROM grid_orders ORDER BY id ASC");
        socket.emit('grid_update', grids);
        
        logAndEmit("Mengambil data saldo dari Binance Testnet...");
        binance.balance((error, balances) => {
            if (error) {
                const errorMessage = error.body ? JSON.parse(error.body).msg : "Error tidak diketahui saat ambil saldo.";
                logAndEmit(`❌ Gagal mengambil saldo: ${errorMessage}`);
                return;
            }
            logAndEmit("✅ Data saldo mentah diterima.");
            if (balances.ETH && balances.USDT) {
                socket.emit('balance_update', { 
                    eth: balances.ETH.available, 
                    usdt: balances.USDT.available 
                });
                logAndEmit("✅ Saldo berhasil dikirim ke dashboard.");
            } else {
                logAndEmit("⚠️ Saldo ETH atau USDT tidak ditemukan dalam respons API.");
            }
        });
    } catch (error) {
        logAndEmit(`❌ Gagal mengambil data awal untuk dashboard: ${error.message}`);
    }
});
