const mongoose = require("mongoose");
const Category = require("../models/category");
const Food = require("../models/foods");

const MONGO_URI = "mongodb://root:SuperStrongPassword123@109.205.176.124:27017/kepket?authSource=admin";
const RESTAURANT_ID = "69661404f734437814a658df";

const menuData = [
  {
    categoryName: "ШАШЛЫК",
    foods: [
      { foodName: "ГИЖДИВАН ШАШЛЫК", price: 18000 },
      { foodName: "ГОВЯДИНА КУСКОВОЙ ШАШЛЫК", price: 28000 },
      { foodName: "НАПОЛЕОН ШАШЛЫК", price: 22000 },
      { foodName: "ШАШЛЫК ИЗ КРЫЛЬЕВ", price: 15000 },
      { foodName: "FARSH", price: 130000 },
      { foodName: "SIRNIY FARSH", price: 20000 },
      { foodName: "АССОРТИ ШАШЛЫК", price: 280000 },
      { foodName: "АССОРТИ ШАШЛЫК 0,5", price: 190000 },
      { foodName: "НАПОЛЕОН БЕЗ ФАРШ", price: 25000 },
      { foodName: "ОВОЩНОЙ ШАШЛЫК", price: 10000 },
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
