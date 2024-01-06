const mongoose = require("mongoose");

const Saved = mongoose.model("Saved", {
  savedOrder: {
    type: Object,
    required: true,
  },
  tableId: String,
  orderType: {
    type: String,
    required: true,
  },
  tableNumber: {
    type: Number,
    required: true,
  },
  place: String,
  numberOfPeople: {
    type: Number,
    default: 0,
  },
});

module.exports = Saved;
