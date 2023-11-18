const mongoose = require("mongoose");

const orderSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  location: {
    lat: {
      type: String,
      required: true,
    },
    lon: {
      type: String,
      required: true,
    },
  },
  table: {
    type: Object,
    required: true,
  },
  orderDate: {
    type: String,
    required: true,
  },
});

const Order = mongoose.model("Orders", orderSchema);

module.exports = Order;
