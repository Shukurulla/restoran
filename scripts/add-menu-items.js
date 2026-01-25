const mongoose = require("mongoose");
const Category = require("../models/category");
const Food = require("../models/foods");

const MONGO_URI = "mongodb://root:SuperStrongPassword123@109.205.176.124:27017/kepket?authSource=admin";
const RESTAURANT_ID = "697173438338a083c0f0552e";

const menuData = [
  
  {
    categoryName: "БАР",
    foods: [
      { foodName: "COLA 1.5 L", price: 16000 },
      { foodName: "FANTA 1.5 L", price: 16000 },
      { foodName: "PEPSI 1.75 L", price: 17000 },
      { foodName: "ЧАЙ ЗЕЛЕНЫЙ", price: 4000 },
      { foodName: "ЧАЙ ЧЕРНЫЙ", price: 4000 },
      { foodName: "КЕФИР СТАКАН", price: 5000 },
    ],
  },
  {
    categoryName: "МЕНЮ",
    foods: [
      { foodName: "НАН", price: 4000 },
      { foodName: "ГОШ СОМСА", price: 12000 },
      { foodName: "ПАЛАУ", price: 40000 },
      { foodName: "ПАЛАУ КАЗЫЛЫ", price: 45000 },
      { foodName: "АЧЧИК-ЧУЧУК", price: 18000 },
      { foodName: "СВЕЖЫЙ САЛАТ", price: 18000 },
    ],
  },
  {
    categoryName: "ПЕРВЫЕ БЛЮДА",
    foods: [
      { foodName: "БАНКА 1 Л", price: 3000 },
      { foodName: "СУП", price: 15000 },
      { foodName: "СУП ГОВЯЖИЙ", price: 30000 },
      { foodName: "СУП КУЗА", price: 35000 },
      { foodName: "СУП ЛАГМАН", price: 30000 },
      { foodName: "СУП ПЕЛЬМЕН", price: 30000 },
      { foodName: "СУП ТЕФТЕЛЬ", price: 30000 },
    ],
  },
  {
    categoryName: "ВТОРЫЕ БЛЮДА",
    foods: [
      { foodName: "Бедана шт", price: 2000 },
      { foodName: "БЕШ БАРМАК 0,5 КГ", price: 120000 },
      { foodName: "БЕШ БАРМАК 1 КГ", price: 195000 },
      { foodName: "БИФШТЕКС", price: 40000 },
      { foodName: "ЖАРЕННЫЙ ЛАГМАН", price: 30000 },
      { foodName: "ЖИЗ 1 КГ", price: 180000 },
      { foodName: "ЖИЗ ПОРЦ", price: 65000 },
      { foodName: "Казан кебаб ГОВЯЖИЙ", price: 70000 },
      { foodName: "КАЗЫ", price: 5000 },
      { foodName: "КФС ФИЛЬЕ 0,5 КГ", price: 45000 },
      { foodName: "КФС ФИЛЬЕ 1 КГ", price: 90000 },
      { foodName: "МАНТЫ ПОРЦ", price: 40000 },
      { foodName: "МЯСО С РИСОМ", price: 50000 },
      { foodName: "Плов 0,5 кг", price: 55000 },
      { foodName: "ПЛОВ 1 КГ", price: 100000 },
      { foodName: "ПЛОВ 1 КГ КАЗЫЛЫ", price: 120000 },
      { foodName: "СУЛТАН АССОРТИ БОЛЬШОЙ", price: 500000 },
      { foodName: "СУЛТАН СОМСА ФИРМЕННЫЙ", price: 300000 },
      { foodName: "ТАБАКА", price: 65000 },
    ],
  },
  {
    categoryName: "ГАРНИРЫ",
    foods: [
      { foodName: "Бедана 3 шт", price: 5000 },
      { foodName: "ГРЕЧКА", price: 10000 },
      { foodName: "ЖАРЕНЫЙ ЯЙЦО 1 шт", price: 5000 },
      { foodName: "КОТЛЕТ", price: 15000 },
      { foodName: "ПЕРЕЦ ХОЛОПЕОН", price: 2000 },
      { foodName: "ПЮРЕ", price: 10000 },
      { foodName: "РИС", price: 10000 },
      { foodName: "СОУС", price: 5000 },
      { foodName: "ФРИ", price: 10000 },
    ],
  },
  {
    categoryName: "ГОРЯЧИЕ НАПИТКИ",
    foods: [
      { foodName: "ЗЕЛЕНЫЙ ЧАЙ С ЛИМОНОМ", price: 10000 },
      { foodName: "ЧЕРНЫЙ ЧАЙ С ЛИМОНОМ", price: 10000 },
      { foodName: "FRUCTOVIY APELCIN", price: 35000 },
      { foodName: "FRUCTOVIY KLUBNIKA", price: 40000 },
      { foodName: "FRUCTOVIY MALINA", price: 35000 },
      { foodName: "FRUCTOVIY MIKS", price: 45000 },
      { foodName: "KOFE SABOY", price: 10000 },
      { foodName: "АЙРАН СТАКАН", price: 3000 },
      { foodName: "АЙРАН ГРАФИН", price: 13000 },
      { foodName: "КОФЕ С МОЛОКОМ NESKAFE", price: 5000 },
      { foodName: "КОФЕ ЧЕРНЫЙ NESKAFE", price: 5000 },
      { foodName: "ЛИМОН", price: 5000 },
      { foodName: "ЛИМОН МИКС ЧАЙ", price: 15000 },
      { foodName: "САХАР", price: 4000 },
      { foodName: "ЧАЙ С МОЛОКОМ", price: 12000 },
    ],
  },
  {
    categoryName: "ДЕСЕРТ",
    foods: [
      { foodName: "ВУЛКАН", price: 30000 },
      { foodName: "МЕДОВИК", price: 30000 },
      { foodName: "СНИКЕРС ТОРТ", price: 38000 },
      { foodName: "ТРАЙФЛ", price: 35000 },
      { foodName: "ЧИЗКЕЙК ОРЕО", price: 35000 },
      { foodName: "ЧИЗКЕЙК САН СЕБЕАСТИЯН", price: 38000 },
      { foodName: "ШОКОЛАД", price: 15000 },
    ],
  },
  {
    categoryName: "САЛАТЫ С МАЙОНЕЗОМ",
    foods: [
      { foodName: "ЦЕЗАРЬ", price: 30000 },
      { foodName: "МУЖСКОЙ КАПРИЗ", price: 30000 },
      { foodName: "ОЛИВЬЕ", price: 22000 },
      { foodName: "САЛАТ ШЫРАКШЫ", price: 20000 },
      { foodName: "СУЗБЕ", price: 10000 },
    ],
  },
  {
    categoryName: "САЛАТЫ С МАСЛОМ",
    foods: [
      { foodName: "ГРЕЧЕСКИЙ", price: 30000 },
      { foodName: "ЖАРЕННЫЕ ГРИБЫ", price: 30000 },
      { foodName: "Китайский", price: 30000 },
      { foodName: "ЛУК", price: 2000 },
      { foodName: "ОВОЩНОЙ САЛАТ", price: 25000 },
      { foodName: "ПЕРЕЦ СВЕЖИЙ", price: 2000 },
      { foodName: "СОЛЕННЫЙ АССОРТИ", price: 20000 },
      { foodName: "СОЛЕНЫЙ ОГУРЦЫ", price: 15000 },
      { foodName: "ФИЛЕ 150 ГР", price: 15000 },
      { foodName: "ФРУКТОВЫЙ САЛАТ ПОРЦ", price: 25000 },
      { foodName: "ФРУКТОВЫЙ АССОРТИ", price: 75000 },
    ],
  },
  {
    categoryName: "ФАСТ ФУД",
    foods: [
      { foodName: "LAVASH MINI", price: 28000 },
      { foodName: "LAVASH OBICHNIY", price: 32000 },
      { foodName: "PEREC SOLYONNIY", price: 2000 },
      { foodName: "PIZZA KOMBO KISHI", price: 55000 },
      { foodName: "PIZZA KOMBO ULKEN", price: 65000 },
      { foodName: "PIZZA MARGARITA KISHI", price: 45000 },
      { foodName: "PIZZA MARGARITA ULKEN", price: 55000 },
      { foodName: "PIZZA PEPERONI KISHI", price: 50000 },
      { foodName: "PIZZA PEPERONI ULKEN", price: 60000 },
      { foodName: "PIZZA QAZILI KISHKENE", price: 60000 },
      { foodName: "PIZZA QAZILI ULKEN", price: 70000 },
      { foodName: "PIZZA SEZAR", price: 65000 },
      { foodName: "PIZZA SUPERSET", price: 119000 },
      { foodName: "SHAURMA MINI", price: 15000 },
      { foodName: "SHAURMA ULKEN", price: 30000 },
    ],
  },
  {
    categoryName: "ШОКОЛАД/ЖЕВАЧКА",
    foods: [
      { foodName: "КЕФИР", price: 12000 },
      { foodName: "ОРБИТ", price: 5000 },
      { foodName: "ПОБЕДА", price: 18000 },
      { foodName: "СУЗБЕ", price: 14000 },
      { foodName: "ШОКОЛАД", price: 15000 },
    ],
  },
  {
    categoryName: "СУУ",
    foods: [
      { foodName: "CHORTOQ 0.33", price: 10000 },
      { foodName: "CHORTOQ 0.5", price: 13000 },
      { foodName: "CHORTOQ 0.75", price: 15000 },
      { foodName: "FLESH", price: 14000 },
      { foodName: "GORILLA", price: 15000 },
      { foodName: "HABIB ENERGY", price: 15000 },
      { foodName: "ROCKSTAR ENERGY", price: 12000 },
      { foodName: "SANTAL 0.5 L", price: 4000 },
      { foodName: "SANTAL 1 L", price: 5000 },
      { foodName: "SANTAL 1.5 L", price: 6000 },
      { foodName: "TAN AYRAN", price: 13000 },
    ],
  },
  {
    categoryName: "ПИВО",
    foods: [
      { foodName: "SARBAST BANKA", price: 15000 },
      { foodName: "SARBAST BUTILKA 0.5 L", price: 15000 },
      { foodName: "SARBAST LITE 1.5 L", price: 22000 },
    ],
  },
  {
    categoryName: "НАПИТКИ",
    foods: [
      { foodName: "RED BUL", price: 25000 },
      { foodName: "SPRITE 0.5 L", price: 8000 },
      { foodName: "SPRITE 1.5 L", price: 16000 },
      { foodName: "ДЕТСКИЙ СОК", price: 5000 },
      { foodName: "PEPSI 0.25 L", price: 5000 },
      { foodName: "СОК", price: 16000 },
      { foodName: "ADRENALIN A", price: 16000 },
      { foodName: "COLA 0.5 L", price: 8000 },
      { foodName: "COLA 1 L", price: 13000 },
      { foodName: "FANTA 0.5 L", price: 8000 },
      { foodName: "FANTA 1 L", price: 13000 },
      { foodName: "LIPTON 0.5 L", price: 8000 },
      { foodName: "LIPTON 1 L", price: 12000 },
      { foodName: "LIPTON 1.5 L", price: 16000 },
      { foodName: "MAXI CHAY 1.25 L", price: 17000 },
      { foodName: "MAXI CHAY 0.45", price: 10000 },
      { foodName: "PEPSI 0.5 L", price: 8000 },
      { foodName: "PEPSI 0.5 L BANKA", price: 10000 },
      { foodName: "PEPSI 1 L", price: 13000 },
    ],
  },
  {
    categoryName: "К ПИВУ",
    foods: [
      { foodName: "GRENKI", price: 8000 },
      { foodName: "LAYS 70 GR", price: 14000 },
      { foodName: "КУРТ", price: 12000 },
      { foodName: "СЕМЕЧКИ ЭРМАК", price: 18000 },
    ],
  },
  {
    categoryName: "ВИНО/ВОДКА",
    foods: [
      { foodName: "ВОДКА ПРОСТОЙ-0.5л", price: 50000 },
      { foodName: "ВОДКА ЭКС КВАДРАТ-0.45л", price: 50000 },
      { foodName: "ВОДКА ЭКС-0.75л", price: 65000 },
      { foodName: "ВОДКА ЭКС-0.7л КВАДРАТ", price: 90000 },
      { foodName: "КОНЬЯК УЗБЕКИСТАН", price: 280000 },
    ],
  },
  {
    categoryName: "АКЦИЯ СУУ",
    foods: [
      { foodName: "АКЦ PEPSI 0.26 L", price: 0 },
      { foodName: "АКЦ COLA 0.5 L", price: 0 },
      { foodName: "АКЦ COLA 1 L", price: 0 },
      { foodName: "АКЦ FANTA 0.5 L", price: 0 },
      { foodName: "АКЦ FANTA 1 L", price: 0 },
      { foodName: "АКЦ PEPSI 1 L", price: 0 },
      { foodName: "АКЦ PEPSI 0.5 L", price: 0 },
    ],
  },
];

async function addMenuItems() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB ga ulandi");

    for (const menu of menuData) {
      // Kategoriyani tekshirish yoki yaratish
      let category = await Category.findOne({
        restaurantId: RESTAURANT_ID,
        title: menu.categoryName,
      });

      if (!category) {
        category = await Category.create({
          restaurantId: RESTAURANT_ID,
          title: menu.categoryName,
        });
        console.log(`✅ Kategoriya yaratildi: ${menu.categoryName}`);
      } else {
        console.log(`⚠️ Kategoriya mavjud: ${menu.categoryName}`);
      }

      // Taomlarni qo'shish
      for (const food of menu.foods) {
        const existingFood = await Food.findOne({
          restaurantId: RESTAURANT_ID,
          foodName: food.foodName,
        });

        if (!existingFood) {
          await Food.create({
            restaurantId: RESTAURANT_ID,
            foodName: food.foodName,
            price: food.price,
            category: menu.categoryName,
            image: "https://placehold.co/400x300?text=" + encodeURIComponent(food.foodName),
            body: food.foodName,
            dosage: "1 porsiya",
            isAvailable: true,
            inStopList: false,
          });
          console.log(`  ✅ Taom qo'shildi: ${food.foodName} - ${food.price.toLocaleString()} so'm`);
        } else {
          console.log(`  ⚠️ Taom mavjud: ${food.foodName}`);
        }
      }
    }

    console.log("\n🎉 Barcha ma'lumotlar muvaffaqiyatli qo'shildi!");
  } catch (error) {
    console.error("Xatolik:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB dan uzildi");
  }
}

addMenuItems();
