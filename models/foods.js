const mongoose = require("mongoose");

const foodSchema = mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    foodName: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    dosage: {
      type: String,
      required: true,
    },
    totalDosage: Number,
    deepCategory: String,
    isAvailable: {
      type: Boolean,
      default: true,
    },
    // Ortacha tayyorlash vaqti (sekundlarda)
    averageCookingTime: {
      type: Number,
      default: null,
    },
    // Tayyorlash vaqtlarini hisoblash uchun
    cookingTimeCount: {
      type: Number,
      default: 0,
    },
    cookingTimeTotal: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

foodSchema.index({ restaurantId: 1, category: 1 });

const Food = mongoose.model("Foods", foodSchema);
module.exports = Food;
