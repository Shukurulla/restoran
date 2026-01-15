const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Restaurant = require("../models/restaurant");
const RestaurantAdmin = require("../models/restaurant-admin");
const Staff = require("../models/staff");
const Table = require("../models/table");
const Category = require("../models/category");
const Food = require("../models/foods");
const Order = require("../models/order");
const KitchenOrder = require("../models/kitchen-order");
const QRSession = require("../models/qr-session");
const Call = require("../models/call");

// Demo restoran slug - bu orqali topamiz
const DEMO_SLUG = "demo-restoran";
const DEMO_ADMIN_PHONE = "demo";
const DEMO_PASSWORD = "demo";

// Kategoriyalar va taomlar
const CATEGORIES_DATA = [
  {
    title: "Salatlar",
    foods: [
      { foodName: "Sezar salati", body: "Tovuq go'shti, parmezjan, suhariklari va sezar sousi", price: 32000, dosage: "250g", image: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400" },
      { foodName: "Grek salati", body: "Pomidor, bodring, zaytun, feta pishlog'i", price: 28000, dosage: "220g", image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400" },
      { foodName: "Vinegret", body: "Lavlagi, sabzi, kartoshka, bodring", price: 18000, dosage: "200g", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400" },
      { foodName: "Olivye", body: "An'anaviy oʻzbek olivyesi kolbasa bilan", price: 22000, dosage: "220g", image: "https://images.unsplash.com/photo-1607532941433-304659e8198a?w=400" },
      { foodName: "Achichuk", body: "Yangi pomidor va piyoz salati", price: 15000, dosage: "200g", image: "https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=400" }
    ]
  },
  {
    title: "Sho'rvalar",
    foods: [
      { foodName: "Mastava", body: "Guruch va sabzavotli go'shtli sho'rva", price: 28000, dosage: "400ml", image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400" },
      { foodName: "Lag'mon sho'rva", body: "Qo'lda tayyorlangan lag'mon bilan sho'rva", price: 32000, dosage: "450ml", image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400" },
      { foodName: "Shorpo", body: "An'anaviy qo'y go'shtli sho'rva", price: 35000, dosage: "400ml", image: "https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?w=400" },
      { foodName: "Tovuq sho'rva", body: "Yengil tovuq sho'rvasi ko'katlar bilan", price: 25000, dosage: "400ml", image: "https://images.unsplash.com/photo-1604152135912-04a022e23696?w=400" },
      { foodName: "Moshxo'rda", body: "Mosh va guruchli an'anaviy sho'rva", price: 22000, dosage: "400ml", image: "https://images.unsplash.com/photo-1613844237701-8f3664fc2eff?w=400" }
    ]
  },
  {
    title: "Palovlar",
    foods: [
      { foodName: "Toʻyona palov", body: "Qoʻy goʻshti va sabzi bilan toʻyona palov", price: 45000, dosage: "400g", image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=400" },
      { foodName: "Samarqand palovi", body: "An'anaviy Samarqand usulida palov", price: 42000, dosage: "400g", image: "https://images.unsplash.com/photo-1558499932-9609acb5ccf2?w=400" },
      { foodName: "Andijon palovi", body: "Andijon usulida tayyorlangan palov", price: 40000, dosage: "400g", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400" },
      { foodName: "Tovuqli palov", body: "Tovuq go'shti bilan yengil palov", price: 38000, dosage: "400g", image: "https://images.unsplash.com/photo-1645696301019-35adcc18fc10?w=400" },
      { foodName: "Buxoro palovi", body: "Buxoro an'anasida qora murch bilan", price: 48000, dosage: "400g", image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400" }
    ]
  },
  {
    title: "Kaboblar",
    foods: [
      { foodName: "Qoʻy kabob", body: "Tandir koʻmirida pishirilgan qoʻy kabob", price: 55000, dosage: "200g", image: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400" },
      { foodName: "Tovuq kabob", body: "Marine qilingan tovuq kabob", price: 35000, dosage: "200g", image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400" },
      { foodName: "Mol kabob", body: "Mol go'shtidan kabob", price: 50000, dosage: "200g", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400" },
      { foodName: "Lulya kabob", body: "Maydalangan go'shtdan lulya", price: 40000, dosage: "180g", image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=400" },
      { foodName: "Jigar kabob", body: "Qo'y jigaridan kabob", price: 32000, dosage: "150g", image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400" }
    ]
  },
  {
    title: "Lag'monlar",
    foods: [
      { foodName: "Qoʻvurma lagʻmon", body: "Qoʻlda choʻzilgan lagʻmon qovurilgan sabzavotlar bilan", price: 35000, dosage: "400g", image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400" },
      { foodName: "Bosma lag'mon", body: "Bosma usulda tayyorlangan lag'mon", price: 32000, dosage: "400g", image: "https://images.unsplash.com/photo-1552611052-33e04de081de?w=400" },
      { foodName: "Chuchvara lag'mon", body: "Lag'mon va chuchvara birgalikda", price: 38000, dosage: "450g", image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400" },
      { foodName: "Go'shtli lag'mon", body: "Ko'p go'shtli lag'mon", price: 40000, dosage: "420g", image: "https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=400" },
      { foodName: "Sabzavotli lag'mon", body: "Vegetarian lag'mon", price: 28000, dosage: "380g", image: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400" }
    ]
  },
  {
    title: "Manti va Chuchvara",
    foods: [
      { foodName: "Qoʻy manti", body: "Qoʻy goʻshtli anʼanaviy manti", price: 35000, dosage: "5 dona", image: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=400" },
      { foodName: "Kartoshkali manti", body: "Kartoshka bilan vegetarian manti", price: 28000, dosage: "5 dona", image: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400" },
      { foodName: "Chuchvara", body: "Kichik pelmeni qaymog' bilan", price: 30000, dosage: "15 dona", image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400" },
      { foodName: "Bug'lama manti", body: "Bug'da pishirilgan yumshoq manti", price: 32000, dosage: "5 dona", image: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400" },
      { foodName: "Qovurma chuchvara", body: "Qovurilgan chuchvara", price: 35000, dosage: "15 dona", image: "https://images.unsplash.com/photo-1541014741259-de529411b96a?w=400" }
    ]
  },
  {
    title: "Nonlar",
    foods: [
      { foodName: "Obi non", body: "An'anaviy tandirda pishirilgan non", price: 5000, dosage: "1 dona", image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400" },
      { foodName: "Patir non", body: "Yog'li patir non", price: 8000, dosage: "1 dona", image: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400" },
      { foodName: "Qatlama", body: "Ko'p qatlamli yupqa non", price: 12000, dosage: "1 dona", image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400" },
      { foodName: "Somsa", body: "Go'shtli pishiriq", price: 15000, dosage: "2 dona", image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400" },
      { foodName: "Chimildiq non", body: "Bayram noni", price: 10000, dosage: "1 dona", image: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400" }
    ]
  },
  {
    title: "Ichimliklar",
    foods: [
      { foodName: "Koʻk choy", body: "Anʼanaviy koʻk choy choynakda", price: 10000, dosage: "1 choynak", image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400" },
      { foodName: "Qora choy", body: "Qora choy limon bilan", price: 10000, dosage: "1 choynak", image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400" },
      { foodName: "Kompot", body: "Uy kompoti", price: 8000, dosage: "500ml", image: "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400" },
      { foodName: "Ayron", body: "Sovuq ayron", price: 8000, dosage: "300ml", image: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400" },
      { foodName: "Mineral suv", body: "Gazlangan mineral suv", price: 6000, dosage: "500ml", image: "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400" }
    ]
  },
  {
    title: "Shirinliklar",
    foods: [
      { foodName: "Halvo", body: "An'anaviy o'zbek halvosi", price: 15000, dosage: "150g", image: "https://images.unsplash.com/photo-1519676867240-f03562e64548?w=400" },
      { foodName: "Chak-chak", body: "Asalli shirinlik", price: 18000, dosage: "200g", image: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=400" },
      { foodName: "Paxlava", body: "Yong'oqli paxlava", price: 20000, dosage: "3 dona", image: "https://images.unsplash.com/photo-1598110750624-207050c4f28c?w=400" },
      { foodName: "Sumalak", body: "An'anaviy Navro'z shirinligi", price: 12000, dosage: "200g", image: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400" },
      { foodName: "Muzqaymoq", body: "3 ta shardagi muzqaymoq", price: 15000, dosage: "3 shar", image: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400" }
    ]
  },
  {
    title: "Fast Food",
    foods: [
      { foodName: "Gamburger", body: "Mol go'shti kotleti bilan burger", price: 28000, dosage: "250g", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400" },
      { foodName: "Hot-dog", body: "Klassik hot-dog sosiska bilan", price: 18000, dosage: "200g", image: "https://images.unsplash.com/photo-1612392062631-94e1c6a3e6f7?w=400" },
      { foodName: "Fri kartoshka", body: "Qovurilgan kartoshka", price: 15000, dosage: "200g", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400" },
      { foodName: "Lavash", body: "Go'shtli lavash o'rami", price: 25000, dosage: "300g", image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400" },
      { foodName: "Pizza", body: "Aralash pizza", price: 45000, dosage: "30 sm", image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400" }
    ]
  }
];

// Demo ma'lumotlarni tozalash
async function cleanDemoData() {
  try {
    // Demo restorani topish
    const demoRestaurant = await Restaurant.findOne({ slug: DEMO_SLUG });

    if (demoRestaurant) {
      const restaurantId = demoRestaurant._id;

      // Bog'liq ma'lumotlarni o'chirish
      await Order.deleteMany({ restaurantId });
      await KitchenOrder.deleteMany({ restaurantId });
      await QRSession.deleteMany({ restaurantId });
      await Call.deleteMany({ restaurantId });
      await Food.deleteMany({ restaurantId });
      await Category.deleteMany({ restaurantId });
      await Table.deleteMany({ restaurantId });
      await Staff.deleteMany({ restaurantId });
      await RestaurantAdmin.deleteMany({ restaurantId });
      await Restaurant.deleteOne({ _id: restaurantId });

      console.log("Eski demo ma'lumotlar o'chirildi");
    }
  } catch (error) {
    console.error("Demo ma'lumotlarni tozalashda xato:", error);
  }
}

// Demo restoran yaratish
async function createDemoRestaurant() {
  try {
    // Avval eski ma'lumotlarni tozalash
    await cleanDemoData();

    // 1. Demo restoran yaratish
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 10); // 10 yil muddat

    const restaurant = await Restaurant.create({
      name: "Demo Restoran",
      slug: DEMO_SLUG,
      address: "Toshkent, Chilonzor tumani, Demo ko'chasi 1",
      phone: "998901234567",
      logo: "",
      subscription: {
        plan: "premium",
        startDate: new Date(),
        endDate: endDate,
        price: 0,
        status: "active"
      },
      settings: {
        sessionDuration: 120, // 2 soat
        currency: "UZS",
        serviceFeePercent: 10
      },
      isActive: true
    });

    console.log("Demo restoran yaratildi:", restaurant.name);

    // 2. Demo admin yaratish
    const admin = await RestaurantAdmin.create({
      restaurantId: restaurant._id,
      firstName: "Demo",
      lastName: "Admin",
      phone: DEMO_ADMIN_PHONE,
      password: DEMO_PASSWORD,
      role: "restaurant_admin",
      isActive: true
    });

    console.log("Demo admin yaratildi - login:", DEMO_ADMIN_PHONE, "parol:", DEMO_PASSWORD);

    // 3. 10 ta stol yaratish
    const tables = [];
    for (let i = 1; i <= 10; i++) {
      const table = await Table.create({
        restaurantId: restaurant._id,
        title: `Stol ${i}`,
        tableNumber: i,
        surcharge: 0
      });
      tables.push(table);
    }
    console.log("10 ta stol yaratildi");

    // 4. 10 ta ofitsiant yaratish
    const waiters = [];
    for (let i = 1; i <= 10; i++) {
      const waiter = await Staff.create({
        restaurantId: restaurant._id,
        firstName: `Ofitsiant`,
        lastName: `${i}`,
        phone: `demo_waiter_${i}`,
        password: DEMO_PASSWORD,
        role: "waiter",
        status: "working",
        isOnline: false
      });
      waiters.push(waiter);
    }
    console.log("10 ta ofitsiant yaratildi");

    // 5. 1 ta oshpaz yaratish
    const cook = await Staff.create({
      restaurantId: restaurant._id,
      firstName: "Demo",
      lastName: "Oshpaz",
      phone: "demo_cook",
      password: DEMO_PASSWORD,
      role: "cook",
      status: "working",
      isOnline: false
    });
    console.log("1 ta oshpaz yaratildi - login: demo_cook, parol:", DEMO_PASSWORD);

    // 6. 1 ta kassir yaratish
    const cashier = await Staff.create({
      restaurantId: restaurant._id,
      firstName: "Demo",
      lastName: "Kassir",
      phone: "demo_cashier",
      password: DEMO_PASSWORD,
      role: "cashier",
      status: "working",
      isOnline: false
    });
    console.log("1 ta kassir yaratildi - login: demo_cashier, parol:", DEMO_PASSWORD);

    // 7. Kategoriyalar va taomlar yaratish
    for (const categoryData of CATEGORIES_DATA) {
      // Kategoriya yaratish
      const category = await Category.create({
        restaurantId: restaurant._id,
        title: categoryData.title
      });

      // Taomlar yaratish
      for (const foodData of categoryData.foods) {
        await Food.create({
          restaurantId: restaurant._id,
          foodName: foodData.foodName,
          body: foodData.body,
          price: foodData.price,
          category: categoryData.title,
          dosage: foodData.dosage,
          image: foodData.image,
          isAvailable: true
        });
      }
    }
    console.log("10 ta kategoriya va 50 ta taom yaratildi");

    // Natijalarni qaytarish
    return {
      restaurant,
      admin,
      tables,
      waiters,
      cook,
      cashier,
      firstTableId: tables[0]._id
    };

  } catch (error) {
    console.error("Demo restoran yaratishda xato:", error);
    throw error;
  }
}

// Reset funksiyasi - 1 soatda chaqiriladi
async function resetDemoData() {
  console.log("Demo ma'lumotlar resetlanmoqda...", new Date().toISOString());
  await createDemoRestaurant();
  console.log("Demo ma'lumotlar resetlandi!", new Date().toISOString());
}

// Export
module.exports = {
  createDemoRestaurant,
  resetDemoData,
  cleanDemoData,
  DEMO_SLUG,
  DEMO_ADMIN_PHONE,
  DEMO_PASSWORD
};
