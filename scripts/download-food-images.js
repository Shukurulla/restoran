const mongoose = require("mongoose");
const Food = require("../models/foods");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
require("dotenv").config();

const RESTAURANT_ID = "69661404f734437814a658df";
const UPLOADS_DIR = path.join(__dirname, "../uploads/foods");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Taom rasmlarining URL lari - Unsplash va boshqa free image manbalardan
const foodImages = {
  // =================== SHO'RVALAR ===================
  "Sup Kuza": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80",
  "Sup Tefteli": "https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?w=400&q=80",
  "Govyajiy Sup": "https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=400&q=80",
  "Sup Lagman": "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400&q=80",
  "Sup Pelmen": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80",
  "Sup Mastava": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80",

  // =================== MILLIY TAOMLAR ===================
  "Palov Klassik": "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=400&q=80",
  "Palov Buxoro": "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=400&q=80",
  "Palov Samarqand": "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=400&q=80",
  "Shavla": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400&q=80",
  "Manti": "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=400&q=80",
  "Chuchvara": "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&q=80",
  "Somsa Tandirda": "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80",
  "Somsa Go'shtli": "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80",
  "Somsa Tovuqli": "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80",
  "Qutob": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80",
  "Non": "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400&q=80",

  // =================== LAG'MON VA NOODLE TAOMLAR ===================
  "Lag'mon Klassik": "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400&q=80",
  "Lag'mon Qovurilgan": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80",
  "Lag'mon Uyg'ur": "https://images.unsplash.com/photo-1552611052-33e04de081de?w=400&q=80",
  "Lag'mon Dungan": "https://images.unsplash.com/photo-1555126634-323283e090fa?w=400&q=80",
  "Lag'mon Chorsu": "https://images.unsplash.com/photo-1552611052-33e04de081de?w=400&q=80",
  "Lag'mon Bosma": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80",
  "Qaynatma Lag'mon": "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400&q=80",

  // =================== KABOB VA GO'SHTLI TAOMLAR ===================
  "Kabob Mol": "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&q=80",
  "Kabob Qo'y": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&q=80",
  "Kabob Tovuq": "https://images.unsplash.com/photo-1532636875304-0c89f5206f85?w=400&q=80",
  "Lyulya Kabob": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=400&q=80",
  "Kabob Jigar": "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
  "Kabob Yurak": "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
  "Tandir Go'sht": "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=400&q=80",
  "Qozon Kabob": "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&q=80",
  "Bifshteks": "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&q=80",

  // =================== UYG'UR TAOMLAR ===================
  "Uyg'ur Palov": "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=400&q=80",
  "Guyru Lag'mon": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80",
  "Chuzma Lag'mon": "https://images.unsplash.com/photo-1552611052-33e04de081de?w=400&q=80",
  "Uyg'ur Manti": "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=400&q=80",
  "Uyg'ur Chuchvara": "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&q=80",
  "Ashlan Fu": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80",

  // =================== QOVURILGAN VA MAXSUS TAOMLAR ===================
  "Qovurma Go'sht": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80",
  "Qovurma Jigar": "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
  "Qovurma Tovuq": "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&q=80",
  "Dimlama": "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=400&q=80",
  "Norin": "https://images.unsplash.com/photo-1555126634-323283e090fa?w=400&q=80",
  "Hasip": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=400&q=80",
  "Kazonga Go'sht": "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=400&q=80",

  // =================== SALATLAR ===================
  "Achichuk": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80",
  "Shakarob": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
  "Salat Olivye": "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400&q=80",
  "Salat Sezar": "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&q=80",
  "Salat Grek": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&q=80",
  "Salat Tashkent": "https://images.unsplash.com/photo-1607532941433-304659e8198a?w=400&q=80",
  "Sabzavot Salat": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",

  // =================== FAST FOOD VA ZAKUSKALAR ===================
  "Gamburger Klassik": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
  "Chizburger": "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=400&q=80",
  "Hot Dog": "https://images.unsplash.com/photo-1612392062126-32eb3afe67dc?w=400&q=80",
  "Lavash Go'shtli": "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80",
  "Lavash Tovuqli": "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80",
  "Kartoshka Fri": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80",
  "Nuggets": "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&q=80",
  "Xachapuri": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80",

  // =================== DESERTLAR ===================
  "Medovik": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80",
  "Napoleon": "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400&q=80",
  "Tiramisu": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&q=80",
  "Chak-Chak": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=80",
  "Halva": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80",
  "Paxlava": "https://images.unsplash.com/photo-1519676867240-f03562e64548?w=400&q=80",
  "Morojenoe": "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&q=80",

  // =================== ISSIQ ICHIMLIKLAR ===================
  "Choy Qora": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80",
  "Choy Ko'k": "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&q=80",
  "Choy Limonli": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80",
  "Qahva Amerikano": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80",
  "Qahva Espresso": "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400&q=80",
  "Qahva Kapuchino": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80",
  "Qahva Latte": "https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=400&q=80",

  // =================== SALQIN ICHIMLIKLAR ===================
  "Coca-Cola": "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80",
  "Fanta": "https://images.unsplash.com/photo-1624517452488-04869289c4ca?w=400&q=80",
  "Sprite": "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400&q=80",
  "Mineral Suv": "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80",
  "Sharbat": "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400&q=80",
  "Limonad": "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&q=80",
  "Moxito": "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&q=80",
  "Sok Olma": "https://images.unsplash.com/photo-1576673442511-7e39b6545c87?w=400&q=80",
  "Sok Apelsin": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80",

  // =================== SUTLI ICHIMLIKLAR ===================
  "Ayran": "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&q=80",
  "Qatiq": "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&q=80",
  "Kefir": "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&q=80",
  "Sut": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80",
  "Kokteil Bananli": "https://images.unsplash.com/photo-1553787499-6f9133860278?w=400&q=80",
  "Kokteil Shokoladli": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80",
  "Kokteil Qulupnayli": "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&q=80",
};

// Rasmni yuklab olish funksiyasi
function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(UPLOADS_DIR, filename);
    const file = fs.createWriteStream(filePath);

    const protocol = url.startsWith("https") ? https : http;

    protocol.get(url, (response) => {
      // Redirect holatini tekshirish
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        file.close();
        fs.unlinkSync(filePath);
        downloadImage(redirectUrl, filename).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filePath);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on("finish", () => {
        file.close();
        resolve(filePath);
      });

      file.on("error", (err) => {
        fs.unlinkSync(filePath);
        reject(err);
      });
    }).on("error", (err) => {
      file.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(err);
    });
  });
}

// Fayl nomini yaratish - maxsus belgilarni olib tashlash
function createFileName(foodName) {
  return foodName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") + ".jpg";
}

async function downloadAllImages() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB ga ulandi");

    // Barcha taomlarni olish
    const foods = await Food.find({ restaurantId: RESTAURANT_ID });
    console.log(`Jami ${foods.length} ta taom topildi`);

    let successCount = 0;
    let errorCount = 0;

    for (const food of foods) {
      const imageUrl = foodImages[food.foodName];

      if (!imageUrl) {
        console.log(`⚠️  ${food.foodName} uchun rasm URL topilmadi`);
        errorCount++;
        continue;
      }

      const fileName = createFileName(food.foodName);

      try {
        console.log(`⏳ ${food.foodName} yuklanmoqda...`);
        await downloadImage(imageUrl, fileName);

        // Bazada yangilash
        await Food.findByIdAndUpdate(food._id, {
          image: `/uploads/foods/${fileName}`
        });

        console.log(`✅ ${food.foodName} - muvaffaqiyatli`);
        successCount++;

        // Rate limiting uchun kichik kutish
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.log(`❌ ${food.foodName} - xatolik: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n========== NATIJA ==========`);
    console.log(`✅ Muvaffaqiyatli: ${successCount}`);
    console.log(`❌ Xatolik: ${errorCount}`);
    console.log(`📁 Rasmlar joyi: ${UPLOADS_DIR}`);

    await mongoose.disconnect();
    console.log("MongoDB dan uzildi");
  } catch (error) {
    console.error("Umumiy xatolik:", error);
    process.exit(1);
  }
}

downloadAllImages();
