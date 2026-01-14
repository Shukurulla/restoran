const mongoose = require("mongoose");
const Food = require("../models/foods");
const fs = require("fs");
const path = require("path");
const https = require("https");
require("dotenv").config();

const RESTAURANT_ID = "69661404f734437814a658df";
const UPLOADS_DIR = path.join(__dirname, "../uploads/foods");

// Qolgan taomlar uchun yangi URL lar
const missingImages = {
  "Hot Dog": "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=400&q=80",
  "Kabob Tovuq": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400&q=80",
  "Goshtli Sup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80",
};

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(UPLOADS_DIR, filename);
    const file = fs.createWriteStream(filePath);

    https.get(url, (response) => {
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
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      reject(err);
    });
  });
}

function createFileName(foodName) {
  return foodName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") + ".jpg";
}

async function fixMissingImages() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB ga ulandi");

    for (const [foodName, imageUrl] of Object.entries(missingImages)) {
      const food = await Food.findOne({ foodName, restaurantId: RESTAURANT_ID });

      if (!food) {
        console.log(`⚠️  ${foodName} bazada topilmadi`);
        continue;
      }

      const fileName = createFileName(foodName);

      try {
        console.log(`⏳ ${foodName} yuklanmoqda...`);
        await downloadImage(imageUrl, fileName);

        await Food.findByIdAndUpdate(food._id, {
          image: `/uploads/foods/${fileName}`
        });

        console.log(`✅ ${foodName} - muvaffaqiyatli`);
      } catch (err) {
        console.log(`❌ ${foodName} - xatolik: ${err.message}`);
      }
    }

    await mongoose.disconnect();
    console.log("MongoDB dan uzildi");
  } catch (error) {
    console.error("Xatolik:", error);
    process.exit(1);
  }
}

fixMissingImages();
