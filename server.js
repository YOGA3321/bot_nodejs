// server.js (Versi Otomatis dengan Strategi RSI)

// --- BAGIAN 1: SETUP SERVER & KONEKSI ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const Binance = require('node-binance-api');
const { analyzeMarket } = require('./strategy.js'); // <-- Impor modul strategi kita
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public')); // Untuk menyajikan dashboard HTML

const binance = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_API_SECRET,
  urls: {
    base: 'https://bot.lopyta.com/api/v3/',
  }
  // Opsi `test: true` dihapus karena kita sudah mengarahkan ke testnet via URL.
});

// Variabel untuk mencegah eksekusi berlebihan
let isProcessing = false;

// --- BAGIAN 2: FUNGSI-FUNGSI BANTUAN ---
function logAndEmit(message) {
    const timestamp = new Date().toLocaleString('id-ID');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    io.emit('new_log', logMessage);
}

// --- BAGIAN 3: LOGIKA INTI TRADING ---
async function runTradingLogic() {
    if (isProcessing) {
        // Jika proses sebelumnya masih berjalan, lewati iterasi ini
        return;
    }
    isProcessing = true; // Kunci proses agar tidak tumpang tindih

    try {
        logAndEmit("🧠 Menganalisa pasar untuk sinyal trading...");
        const result = await analyzeMarket(binance);

        if (result && result.rsi) {
            logAndEmit(`📈 RSI saat ini: ${result.rsi}`);
            io.emit('rsi_update', result.rsi); // Kirim RSI ke dashboard
        }

        if (result && result.signal) {
            logAndEmit(`🎯 Sinyal ditemukan: ${result.signal}!`);
            
            // Logika eksekusi order (ini masih menggunakan testnet)
            if (result.signal === 'BUY') {
                // Contoh: Beli senilai 15 USDT
                const quantity = 15; 
                logAndEmit(`💸 Mencoba order MARKET BUY senilai ${quantity} USDT...`);
                const orderResult = await binance.marketBuy("ETHUSDT", null, { quoteOrderQty: quantity });
                logAndEmit(`✅ Order BUY berhasil dieksekusi: ${JSON.stringify(orderResult)}`);
            } else if (result.signal === 'SELL') {
                // Contoh: Jual semua ETH yang tersedia
                const balances = await binance.balance();
                const ethBalance = parseFloat(balances.ETH.available);
                if (ethBalance > 0.001) { // Jual jika saldo cukup
                   logAndEmit(`💸 Mencoba order MARKET SELL sebanyak ${ethBalance} ETH...`);
                   const orderResult = await binance.marketSell("ETHUSDT", ethBalance);
                   logAndEmit(`✅ Order SELL berhasil dieksekusi: ${JSON.stringify(orderResult)}`);
                } else {
                    logAndEmit("ℹ️ Sinyal SELL diterima, tetapi tidak ada ETH yang cukup untuk dijual.");
                }
            }
        } else {
           // logAndEmit("...Tidak ada sinyal trading saat ini.");
        }

    } catch (error) {
        const errorMessage = error.body ? JSON.parse(error.body).msg : "Error tidak diketahui.";
        logAndEmit(`❌ Terjadi error pada siklus trading: ${errorMessage}`);
    } finally {
        isProcessing = false; // Buka kembali kunci setelah selesai
    }
}

// --- BAGIAN 4: KONEKSI & SERVER ---
logAndEmit("▶️ Bot & Server dimulai...");

// Jalankan logika trading setiap 15 detik
setInterval(runTradingLogic, 15000); 

// Tetap gunakan websocket untuk harga real-time di dashboard
binance.websockets.miniTicker(markets => {
    if (markets.ETHUSDT) {
        io.emit('price_update', markets.ETHUSDT.close);
    }
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    logAndEmit(`✅ Server dashboard berjalan di http://localhost:${PORT}`);
    runTradingLogic(); // Jalankan analisa pertama kali saat server siap
});

io.on('connection', async (socket) => {
    logAndEmit(`🔌 Klien baru terhubung ke dashboard.`);
    
    // Kirim data saldo saat klien baru terhubung
    try {
        const balances = await binance.balance();
        if (balances.ETH && balances.USDT) {
            socket.emit('balance_update', { 
                eth: balances.ETH.available, 
                usdt: balances.USDT.available 
            });
            logAndEmit("✅ Saldo berhasil dikirim ke klien baru.");
        }
    } catch (error) {
        logAndEmit(`❌ Gagal mengambil saldo untuk klien baru.`);
    }
});
