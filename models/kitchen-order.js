const mongoose = require("mongoose");

const kitchenOrderItemSchema = new mongoose.Schema({
  foodId: {
    type: String,
  },
  foodName: {
    type: String,
    required: true,
  },
  // Category - cook panel uchun filter
  category: {
    type: String,
    default: null,
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
  // Qisman tayyor - nechta tayyor bo'lgani
  readyQuantity: {
    type: Number,
    default: 0,
  },
  readyAt: {
    type: Date,
    default: null,
  },
  // Yangi maydonlar - vaqt hisobi uchun
  addedAt: {
    type: Date,
    default: Date.now,
  },
  // Tayyorlash vaqti (sekundlarda) - tayyor bo'lganda hisoblanadi
  cookingTime: {
    type: Number,
    default: null,
  },
});

const kitchenOrderSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Orders",
      required: true,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
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
      ref: "Staff",
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
    // Waiter tomonidan tasdiqlangan (mijoz orderini waiter tasdiqlashi kerak)
    waiterApproved: {
      type: Boolean,
      default: false,
    },
    // Waiter tasdiqlagan vaqt
    approvedAt: {
      type: Date,
      default: null,
    },
    // Waiter tomonidan rad etilgan
    waiterRejected: {
      type: Boolean,
      default: false,
    },
    // Rad etish sababi
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

kitchenOrderSchema.index({ restaurantId: 1, status: 1 });
kitchenOrderSchema.index({ restaurantId: 1, tableId: 1 });

module.exports = mongoose.model("KitchenOrder", kitchenOrderSchema);
