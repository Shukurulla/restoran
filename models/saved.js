const mongoose = require("mongoose");

const Saved = mongoose.model("Saved", {
  savedOrder: {
    type: Object,
    required: true,
  },
  tableId: String,
});

module.exports = Saved;
