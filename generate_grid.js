const fs = require('fs/promises');
const mysql = require('mysql2/promise');

// Fungsi untuk membuat grid
async function generateGrid() {
    console.log("▶️  Memulai pembuatan grid...");

    // Konfigurasi DB (sama seperti di server.js)
    const dbPool = mysql.createPool({
        host: 'localhost',
        user: 'u116133173_botbinance',
        password: '@Yogabd46botbinance',
        database: 'u116133173_bot_binance'
    });

    try {
        // Baca file grid_range.txt
        const rangeData = await fs.readFile('grid_range.txt', 'utf8');
        const [low, high, gridCount] = rangeData.split(',').map(Number);

        if (!low || !high || !gridCount) {
            throw new Error("Format grid_range.txt salah. Seharusnya: low,high,count");
        }
        
        console.log(`Membaca range: Low=${low}, High=${high}, Count=${gridCount}`);

        const step = (high - low) / (gridCount - 1);
        const entry = low + (step * Math.floor(gridCount / 2))); // Titik tengah

        // Dapatkan koneksi dari pool
        const connection = await dbPool.getConnection();
        
        // Hapus grid lama
        console.log("Membersihkan grid lama...");
        await connection.query("TRUNCATE TABLE grid_orders");

        // Buat grid baru
        console.log("Memasukkan grid baru...");
        for (let i = 0; i < gridCount; i++) {
            const price = parseFloat((low + i * step).toFixed(2));
            let type = '';

            if (price < entry) {
                type = 'BUY';
            } else if (price > entry) {
                type = 'SELL';
            } else {
                continue; // Lewati titik tengah
            }

            await connection.query("INSERT INTO grid_orders (type, price, status) VALUES (?, ?, 'OPEN')", [type, price]);
        }
        
        connection.release(); // Lepaskan koneksi kembali ke pool
        console.log("✅ Grid berhasil dibuat!");

    } catch (error) {
        console.error("❌ Gagal membuat grid:", error.message);
    } finally {
        await dbPool.end(); // Tutup semua koneksi di pool
    }
}

generateGrid();
