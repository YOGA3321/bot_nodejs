// bot.js

// 1. Setup Awal
const Binance = require('node-binance-api');
require('dotenv').config(); // Memuat file .env

console.log("▶️ Bot Node.js dimulai...");

// Inisialisasi Klien Binance
const binance = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_API_SECRET,
  // Untuk Testnet, tambahkan baris berikut:
  // test: true
});

// 2. Logika Inti
function processGridLogic(price) {
    // Logika grid Anda akan ada di sini.
    // Contoh:
    // if (price <= 2900) {
    //   console.log("Harga di bawah 2900, pertimbangkan BUY!");
    //   // Panggil fungsi untuk eksekusi order...
    // }
}

// 3. Koneksi WebSocket
console.log("Mencoba menghubungkan ke WebSocket Binance...");

binance.websockets.miniTicker( (markets) => {
  // Cek apakah data untuk ETHUSDT ada
  if (markets.ETHUSDT) {
    let current_price = markets.ETHUSDT.close;
    console.log("Harga ETHUSDT saat ini:", current_price);
    
    // Panggil fungsi logika trading Anda dengan harga baru
    processGridLogic(current_price);
  }
});

console.log("✅ Berhasil terhubung dan mendengarkan harga...");
