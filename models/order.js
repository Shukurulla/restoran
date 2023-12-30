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
  },
  musicOrder: {
    type: Object,
    price: Number,
  },
  karaoke: Boolean,
  agent: {
    type: Object,
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
    type: String,
    default: true,
  },
  discount: {
    type: Boolean,
    required: true,
  },
  userInfo: {
    type: Object,
  },
  surcharge: {
    type: Number,
    required: true,
  },
  ofitsianService: Number,
});

const Order = mongoose.model("Orders", orderSchema);

module.exports = Order;
