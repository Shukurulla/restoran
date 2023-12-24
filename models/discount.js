const mongoose = require("mongoose");

const Discount = mongoose.model("Discount", {
  title: String,
  discount: Number,
});

module.exports = Discount;
