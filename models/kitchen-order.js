const mongoose = require("mongoose");

const kitchenOrderItemSchema = new mongoose.Schema({
  foodId: {
    type: String,
  },
  foodName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
  price: {
    type: Number,
    default: 0,
  },
  isReady: {
    type: Boolean,
    default: false,
  },
  readyAt: {
    type: Date,
    default: null,
  },
});

const kitchenOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Orders',
      required: true,
    },
    tableId: {
      type: String,
      required: true,
    },
    tableName: {
      type: String,
      required: true,
    },
    tableNumber: {
      type: Number,
    },
    waiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Waiter',
      default: null,
    },
    waiterName: {
      type: String,
      default: null,
    },
    items: [kitchenOrderItemSchema],
    status: {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'served'],
      default: 'pending',
    },
    allItemsReady: {
      type: Boolean,
      default: false,
    },
    notifiedWaiter: {
      type: Boolean,
      default: false,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
    servedAt: {
      type: Date,
      default: null,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'debt'],
      default: 'cash',
    },
    debtInfo: {
      customerName: String,
      customerPhone: String,
      deposit: Number,
      depositItem: String,
      dueDate: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("KitchenOrder", kitchenOrderSchema);
