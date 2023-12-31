const mongoose = require("mongoose");

const TradeTable = mongoose.model("tradeTable", {
  tableId: {
    type: String,
    required: true,
  },
  orderedAt: new Date(),
});

module.exports = TradeTable;
