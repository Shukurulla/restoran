const mongoose = require("mongoose");

const orderSchema = mongoose.Schema({
  orderedAt: {
    type: Date,
    required: true,
    default: new Date(),
  },
  allOrders: {
    type: Object,
    required: true,
  },
  selectFoods: {
    type: Object,
    required: true,
  },
  location: {
    type: Object,
    required: true,
  },
  tableId: {
    type: String,
    required: true,
  },
  totalPrice: {
    type: String,
    required: true,
  },
  tableName: {
    type: String,
    required: true,
  },
  isNew: {
    type: Boolean,
    required: true,
    default: true,
  },
});

const Order = mongoose.model("Orders", orderSchema);

module.exports = Order;
