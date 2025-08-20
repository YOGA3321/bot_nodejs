// strategy.js

const { RSI } = require('technicalindicators');

// --- Konfigurasi Strategi ---
const RSI_PERIOD = 14;      // Periode standar untuk RSI
const RSI_OVERBOUGHT = 70;  // Ambang batas atas (sinyal JUAL)
const RSI_OVERSOLD = 30;    // Ambang batas bawah (sinyal BELI)
const SYMBOL = 'ETHUSDT';   // Pasangan mata uang
const CANDLE_INTERVAL = '5m'; // Timeframe candle (5 menit)
// ----------------------------

// Variabel untuk menyimpan state terakhir agar tidak trading terus-menerus
let lastSignal = null; // Bisa 'BUY', 'SELL', atau null

async function analyzeMarket(binance) {
    try {
        // 1. Ambil data candle historis dari Binance
        const candles = await binance.candlesticks(SYMBOL, CANDLE_INTERVAL, null, { limit: 100 });
        
        // Ambil hanya harga penutupan dari setiap candle
        const closingPrices = candles.map(candle => parseFloat(candle[4]));

        // 2. Hitung RSI
        const rsiResult = RSI.calculate({
            period: RSI_PERIOD,
            values: closingPrices
        });
        
        // Ambil nilai RSI yang paling baru (terakhir)
        const currentRsi = rsiResult[rsiResult.length - 1];
        
        // 3. Logika Pengambilan Keputusan
        let signal = null;
        if (currentRsi <= RSI_OVERSOLD && lastSignal !== 'BUY') {
            signal = 'BUY';
            lastSignal = 'BUY'; // Simpan state sinyal terakhir
        } else if (currentRsi >= RSI_OVERBOUGHT && lastSignal !== 'SELL') {
            signal = 'SELL';
            lastSignal = 'SELL'; // Simpan state sinyal terakhir
        }

        return {
            rsi: currentRsi.toFixed(2), // Kirim nilai RSI
            signal: signal              // Kirim sinyal 'BUY', 'SELL', atau null
        };

    } catch (error) {
	    // Tampilkan seluruh objek error agar kita tahu detail masalahnya
	    console.error("❌ Gagal menganalisa pasar:", error); 
	    return { rsi: null, signal: null };
    }
}

// Export fungsi agar bisa dipakai di server.js
module.exports = { analyzeMarket };
