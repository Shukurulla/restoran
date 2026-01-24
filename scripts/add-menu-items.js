const mongoose = require("mongoose");
const Food = require("../models/foods");
require("dotenv").config();

const RESTAURANT_ID = "69661404f734437814a658df";

// Sultan Somsa menu taomlar
const menuItems = [
  // =================== SHO'RVALAR ===================
  { foodName: "Sup Kuza", price: 35000, category: "Sho'rvalar", body: "Kuza supasi - an'anaviy taom", dosage: "400g" },
  { foodName: "Sup Tefteli", price: 28000, category: "Sho'rvalar", body: "Teftelili sup", dosage: "350g" },
  { foodName: "Govyajiy Sup", price: 28000, category: "Sho'rvalar", body: "Mol go'shtli sup", dosage: "350g" },
  { foodName: "Sup Lagman", price: 28000, category: "Sho'rvalar", body: "Lag'monli sup", dosage: "350g" },
  { foodName: "Sup Pelmen", price: 28000, category: "Sho'rvalar", body: "Pelmenli sup", dosage: "350g" },
  { foodName: "Sup Mastava", price: 28000, category: "Sho'rvalar", body: "Mastava - guruchli sup", dosage: "350g" },

  // =================== MILLIY TAOMLAR ===================
  { foodName: "Palov Klassik", price: 35000, category: "Milliy taomlar", body: "An'anaviy O'zbek palovi", dosage: "400g" },
  { foodName: "Palov Buxoro", price: 40000, category: "Milliy taomlar", body: "Buxoro uslubidagi palov", dosage: "400g" },
  { foodName: "Palov Samarqand", price: 40000, category: "Milliy taomlar", body: "Samarqand uslubidagi palov", dosage: "400g" },
  { foodName: "Shavla", price: 30000, category: "Milliy taomlar", body: "Shavla - guruchli taom", dosage: "350g" },
  { foodName: "Manti", price: 28000, category: "Milliy taomlar", body: "Go'shtli manti (5 dona)", dosage: "250g" },
  { foodName: "Chuchvara", price: 25000, category: "Milliy taomlar", body: "Go'shtli chuchvara", dosage: "250g" },
  { foodName: "Somsa Tandirda", price: 12000, category: "Milliy taomlar", body: "Tandirda pishgan somsa", dosage: "150g" },
  { foodName: "Somsa Go'shtli", price: 15000, category: "Milliy taomlar", body: "Go'shtli somsa", dosage: "180g" },
  { foodName: "Somsa Tovuqli", price: 14000, category: "Milliy taomlar", body: "Tovuq go'shtli somsa", dosage: "170g" },
  { foodName: "Qutob", price: 18000, category: "Milliy taomlar", body: "Go'shtli qutob", dosage: "200g" },
  { foodName: "Non", price: 5000, category: "Milliy taomlar", body: "Tandirda pishgan non", dosage: "300g" },

  // =================== LAG'MON VA NOODLE TAOMLAR ===================
  { foodName: "Lag'mon Klassik", price: 32000, category: "Lag'mon va noodle taomlar", body: "An'anaviy lag'mon", dosage: "400g" },
  { foodName: "Lag'mon Qovurilgan", price: 35000, category: "Lag'mon va noodle taomlar", body: "Qovurilgan lag'mon", dosage: "400g" },
  { foodName: "Lag'mon Uyg'ur", price: 35000, category: "Lag'mon va noodle taomlar", body: "Uyg'ur uslubidagi lag'mon", dosage: "400g" },
  { foodName: "Lag'mon Dungan", price: 35000, category: "Lag'mon va noodle taomlar", body: "Dungan lag'moni", dosage: "400g" },
  { foodName: "Lag'mon Chorsu", price: 38000, category: "Lag'mon va noodle taomlar", body: "Chorsu lag'moni", dosage: "450g" },
  { foodName: "Lag'mon Bosma", price: 36000, category: "Lag'mon va noodle taomlar", body: "Bosma lag'mon", dosage: "400g" },
  { foodName: "Qaynatma Lag'mon", price: 30000, category: "Lag'mon va noodle taomlar", body: "Qaynatma lag'mon", dosage: "400g" },

  // =================== KABOB VA GO'SHTLI TAOMLAR ===================
  { foodName: "Kabob Mol", price: 45000, category: "Kabob va g'oshtli taomlar", body: "Mol go'shtidan kabob", dosage: "200g" },
  { foodName: "Kabob Qo'y", price: 50000, category: "Kabob va g'oshtli taomlar", body: "Qo'y go'shtidan kabob", dosage: "200g" },
  { foodName: "Kabob Tovuq", price: 35000, category: "Kabob va g'oshtli taomlar", body: "Tovuq kabob", dosage: "200g" },
  { foodName: "Lyulya Kabob", price: 38000, category: "Kabob va g'oshtli taomlar", body: "Qiyma kabob", dosage: "200g" },
  { foodName: "Kabob Jigar", price: 35000, category: "Kabob va g'oshtli taomlar", body: "Jigar kabob", dosage: "180g" },
  { foodName: "Kabob Yurak", price: 32000, category: "Kabob va g'oshtli taomlar", body: "Yurak kabob", dosage: "180g" },
  { foodName: "Tandir Go'sht", price: 55000, category: "Kabob va g'oshtli taomlar", body: "Tandirda pishgan go'sht", dosage: "300g" },
  { foodName: "Qozon Kabob", price: 48000, category: "Kabob va g'oshtli taomlar", body: "Qozonda tayyorlangan kabob", dosage: "250g" },
  { foodName: "Bifshteks", price: 42000, category: "Kabob va g'oshtli taomlar", body: "Mol go'shtidan bifshteks", dosage: "200g" },

  // =================== UYG'UR TAOMLAR ===================
  { foodName: "Uyg'ur Palov", price: 38000, category: "Uyg'ur taomlar", body: "Uyg'ur uslubidagi palov", dosage: "400g" },
  { foodName: "Guyru Lag'mon", price: 36000, category: "Uyg'ur taomlar", body: "Guyru lag'mon", dosage: "400g" },
  { foodName: "Chuzma Lag'mon", price: 34000, category: "Uyg'ur taomlar", body: "Chuzma lag'mon", dosage: "400g" },
  { foodName: "Uyg'ur Manti", price: 30000, category: "Uyg'ur taomlar", body: "Uyg'ur mantisi", dosage: "250g" },
  { foodName: "Uyg'ur Chuchvara", price: 28000, category: "Uyg'ur taomlar", body: "Uyg'ur chuchvarasi", dosage: "250g" },
  { foodName: "Ashlan Fu", price: 25000, category: "Uyg'ur taomlar", body: "Sovuq taom - ashlan fu", dosage: "300g" },

  // =================== QOVURILGAN VA MAXSUS TAOMLAR ===================
  { foodName: "Qovurma Go'sht", price: 45000, category: "Qovurilgan va maxsus taomlar", body: "Qovurilgan go'sht", dosage: "250g" },
  { foodName: "Qovurma Jigar", price: 35000, category: "Qovurilgan va maxsus taomlar", body: "Qovurilgan jigar", dosage: "200g" },
  { foodName: "Qovurma Tovuq", price: 38000, category: "Qovurilgan va maxsus taomlar", body: "Qovurilgan tovuq", dosage: "250g" },
  { foodName: "Dimlama", price: 40000, category: "Qovurilgan va maxsus taomlar", body: "Sabzavotli dimlama", dosage: "350g" },
  { foodName: "Norin", price: 35000, category: "Qovurilgan va maxsus taomlar", body: "An'anaviy norin", dosage: "300g" },
  { foodName: "Hasip", price: 28000, category: "Qovurilgan va maxsus taomlar", body: "Go'shtli hasip", dosage: "200g" },
  { foodName: "Kazonga Go'sht", price: 50000, category: "Qovurilgan va maxsus taomlar", body: "Qozonda pishgan go'sht", dosage: "300g" },

  // =================== SALATLAR ===================
  { foodName: "Achichuk", price: 15000, category: "Salatlar", body: "Pomidor va piyozli salat", dosage: "200g" },
  { foodName: "Shakarob", price: 18000, category: "Salatlar", body: "Shakarob salat", dosage: "200g" },
  { foodName: "Salat Olivye", price: 22000, category: "Salatlar", body: "Olivye salati", dosage: "200g" },
  { foodName: "Salat Sezar", price: 28000, category: "Salatlar", body: "Sezar salati", dosage: "250g" },
  { foodName: "Salat Grek", price: 25000, category: "Salatlar", body: "Grek salati", dosage: "220g" },
  { foodName: "Salat Tashkent", price: 20000, category: "Salatlar", body: "Toshkent salati", dosage: "200g" },
  { foodName: "Sabzavot Salat", price: 18000, category: "Salatlar", body: "Aralash sabzavot salat", dosage: "200g" },

  // =================== FAST FOOD VA ZAKUSKALAR ===================
  { foodName: "Gamburger Klassik", price: 25000, category: "Fast food va zakuskalar", body: "Klassik gamburger", dosage: "250g" },
  { foodName: "Chizburger", price: 28000, category: "Fast food va zakuskalar", body: "Pishloqli burger", dosage: "280g" },
  { foodName: "Hot Dog", price: 18000, category: "Fast food va zakuskalar", body: "Sosiskali hot dog", dosage: "200g" },
  { foodName: "Lavash Go'shtli", price: 25000, category: "Fast food va zakuskalar", body: "Go'shtli lavash", dosage: "300g" },
  { foodName: "Lavash Tovuqli", price: 22000, category: "Fast food va zakuskalar", body: "Tovuqli lavash", dosage: "280g" },
  { foodName: "Kartoshka Fri", price: 15000, category: "Fast food va zakuskalar", body: "Qovurilgan kartoshka", dosage: "200g" },
  { foodName: "Nuggets", price: 20000, category: "Fast food va zakuskalar", body: "Tovuq naggets (8 dona)", dosage: "180g" },
  { foodName: "Xachapuri", price: 22000, category: "Fast food va zakuskalar", body: "Pishloqli xachapuri", dosage: "250g" },

  // =================== DESERTLAR ===================
  { foodName: "Medovik", price: 18000, category: "Desertlar", body: "Asalli tort", dosage: "150g" },
  { foodName: "Napoleon", price: 16000, category: "Desertlar", body: "Napoleon torti", dosage: "150g" },
  { foodName: "Tiramisu", price: 22000, category: "Desertlar", body: "Italyan deserti", dosage: "150g" },
  { foodName: "Chak-Chak", price: 15000, category: "Desertlar", body: "An'anaviy chak-chak", dosage: "150g" },
  { foodName: "Halva", price: 12000, category: "Desertlar", body: "O'zbek halvasi", dosage: "100g" },
  { foodName: "Paxlava", price: 18000, category: "Desertlar", body: "Yong'oqli paxlava", dosage: "120g" },
  { foodName: "Morojenoe", price: 15000, category: "Desertlar", body: "Muzqaymoq (3 dona)", dosage: "150g" },

  // =================== ISSIQ ICHIMLIKLAR ===================
  { foodName: "Choy Qora", price: 8000, category: "Issiq ichimliklar", body: "Qora choy (choynek)", dosage: "500ml" },
  { foodName: "Choy Ko'k", price: 10000, category: "Issiq ichimliklar", body: "Ko'k choy (choynek)", dosage: "500ml" },
  { foodName: "Choy Limonli", price: 12000, category: "Issiq ichimliklar", body: "Limonli choy", dosage: "500ml" },
  { foodName: "Qahva Amerikano", price: 15000, category: "Issiq ichimliklar", body: "Amerikano qahva", dosage: "200ml" },
  { foodName: "Qahva Espresso", price: 12000, category: "Issiq ichimliklar", body: "Espresso qahva", dosage: "50ml" },
  { foodName: "Qahva Kapuchino", price: 18000, category: "Issiq ichimliklar", body: "Kapuchino", dosage: "250ml" },
  { foodName: "Qahva Latte", price: 18000, category: "Issiq ichimliklar", body: "Latte qahva", dosage: "300ml" },

  // =================== SALQIN ICHIMLIKLAR ===================
  { foodName: "Coca-Cola", price: 10000, category: "Salqin ichimliklar", body: "Coca-Cola 0.5L", dosage: "500ml" },
  { foodName: "Fanta", price: 10000, category: "Salqin ichimliklar", body: "Fanta 0.5L", dosage: "500ml" },
  { foodName: "Sprite", price: 10000, category: "Salqin ichimliklar", body: "Sprite 0.5L", dosage: "500ml" },
  { foodName: "Mineral Suv", price: 6000, category: "Salqin ichimliklar", body: "Mineral suv 0.5L", dosage: "500ml" },
  { foodName: "Sharbat", price: 12000, category: "Salqin ichimliklar", body: "Tabiiy sharbat", dosage: "300ml" },
  { foodName: "Limonad", price: 15000, category: "Salqin ichimliklar", body: "Uy limonadi", dosage: "400ml" },
  { foodName: "Moxito", price: 18000, category: "Salqin ichimliklar", body: "Yalpizli moxito", dosage: "400ml" },
  { foodName: "Sok Olma", price: 12000, category: "Salqin ichimliklar", body: "Olma sharbati", dosage: "300ml" },
  { foodName: "Sok Apelsin", price: 14000, category: "Salqin ichimliklar", body: "Apelsin sharbati", dosage: "300ml" },

  // =================== SUTLI ICHIMLIKLAR ===================
  { foodName: "Ayran", price: 8000, category: "Sutli ichimliklar", body: "Tabiiy ayran", dosage: "300ml" },
  { foodName: "Qatiq", price: 10000, category: "Sutli ichimliklar", body: "Tabiiy qatiq", dosage: "300ml" },
  { foodName: "Kefir", price: 8000, category: "Sutli ichimliklar", body: "Kefir", dosage: "300ml" },
  { foodName: "Sut", price: 6000, category: "Sutli ichimliklar", body: "Tabiiy sut", dosage: "300ml" },
  { foodName: "Kokteil Bananli", price: 18000, category: "Sutli ichimliklar", body: "Bananli sut kokteyli", dosage: "350ml" },
  { foodName: "Kokteil Shokoladli", price: 18000, category: "Sutli ichimliklar", body: "Shokoladli sut kokteyli", dosage: "350ml" },
  { foodName: "Kokteil Qulupnayli", price: 20000, category: "Sutli ichimliklar", body: "Qulupnayli sut kokteyli", dosage: "350ml" },

  // =================== RASMDAN QO'SHILGAN TAOMLAR ===================
  // BAR
  { foodName: "COLA 1.5 L", price: 16000, category: "Bar", body: "Coca-Cola 1.5 litr", dosage: "1500ml" },
  { foodName: "FANTA 1.5 L", price: 16000, category: "Bar", body: "Fanta 1.5 litr", dosage: "1500ml" },
  { foodName: "PEPSI 1.75 L", price: 17000, category: "Bar", body: "Pepsi 1.75 litr", dosage: "1750ml" },

  // MENYU
  { foodName: "НАН", price: 4000, category: "Menyu", body: "Tandirda pishgan non", dosage: "300g" },
  { foodName: "ГОШ СОМСА", price: 12000, category: "Menyu", body: "Go'shtli somsa", dosage: "150g" },
  { foodName: "ПАЛАУ", price: 40000, category: "Menyu", body: "An'anaviy palov", dosage: "400g" },
  { foodName: "ПАЛАУ КАЗЫЛЫ", price: 45000, category: "Menyu", body: "Qazili palov", dosage: "450g" },
  { foodName: "АЧЧИК-ЧУЧУК", price: 18000, category: "Menyu", body: "Achchiq-chuchuk salat", dosage: "200g" },
  { foodName: "ЧАЙ ЗЕЛЕНЫЙ", price: 4000, category: "Menyu", body: "Yashil choy", dosage: "250ml" },
  { foodName: "ЧАЙ ЧЕРНЫЙ", price: 4000, category: "Menyu", body: "Qora choy", dosage: "250ml" },
  { foodName: "СВЕЖЫЙ САЛАТ", price: 18000, category: "Menyu", body: "Yangi sabzavotli salat", dosage: "200g" },
];

// Default rasm - placeholder
const DEFAULT_IMAGE = "/uploads/foods/default-food.jpg";

async function addMenuItems() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB ga ulandi");

    // Avval mavjud taomlar sonini tekshirish
    const existingCount = await Food.countDocuments({ restaurantId: RESTAURANT_ID });
    console.log(`Mavjud taomlar soni: ${existingCount}`);

    // Yangi taomlarni qo'shish
    const foodsToAdd = menuItems.map(item => ({
      ...item,
      restaurantId: RESTAURANT_ID,
      image: DEFAULT_IMAGE,
      isAvailable: true,
    }));

    const result = await Food.insertMany(foodsToAdd);
    console.log(`${result.length} ta taom muvaffaqiyatli qo'shildi!`);

    // Kategoriyalar bo'yicha statistika
    const categories = [...new Set(menuItems.map(item => item.category))];
    for (const cat of categories) {
      const count = menuItems.filter(item => item.category === cat).length;
      console.log(`  - ${cat}: ${count} ta taom`);
    }

    // Umumiy statistika
    const totalCount = await Food.countDocuments({ restaurantId: RESTAURANT_ID });
    console.log(`\nJami taomlar soni: ${totalCount}`);

    await mongoose.disconnect();
    console.log("MongoDB dan uzildi");
  } catch (error) {
    console.error("Xatolik:", error);
    process.exit(1);
  }
}

addMenuItems();
