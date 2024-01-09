const mongoose = require("mongoose");

const call = mongoose.model("cal", {
  tableNumber: {
    type: Number,
    required: true,
  },
  tableName: {
    type: String,
    required: true,
  },
  tableId: {
    type: String,
    required: true,
  },
  orderedAt: {
    type: String,
    default: new Date(),
  },
  agent: {
    type: Object,
    required: true,
  },
});

module.exports = call;
