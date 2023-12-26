const mongoose = require("mongoose");

const foodSchema = mongoose.Schema({
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
  orderMusic: Object,
  karaoke: Boolean,
});

const Food = mongoose.model("Foods", foodSchema);
module.exports = Food;
