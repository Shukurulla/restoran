const mongoose = require("mongoose");

const TradeTable = mongoose.model("tradeTable", {
  tableId: {
    type: String,
    required: true,
  },
  tableName: {
    type: String,
    required: true,
  },
  tableNumber: {
    type: String,
    required: true,
  },
  orderedAt: {
    type: String,
    default: new Date(),
  },
});

module.exports = TradeTable;
