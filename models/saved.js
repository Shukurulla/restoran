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
});

module.exports = Saved;
