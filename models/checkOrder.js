const mongoose = require("mongoose");

const saveOrderSchema = mongoose.Schema({
  order: {
    type: Object,
    required: true,
  },
  clientName: String,
  clientPhone: String,
  assurance: String,
  status: {
    type: String,
    required: true,
  },
  ofitsiantPrice: Number,
  similarOrder: {
    type: Object,
    required: true,
  },
});

const SaveOrder = mongoose.model("SaveOrders", saveOrderSchema);
module.exports = SaveOrder;
