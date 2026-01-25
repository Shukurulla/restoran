const mongoose = require("mongoose");

const tableSchema = mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    tableNumber: {
      type: Number,
      required: true,
    },
    surcharge: {
      type: Number,
      required: true,
    },
    // Kabina/stol uchun soatlik haq
    hasHourlyCharge: {
      type: Boolean,
      default: false,
    },
    // Soatlik haq summasi (so'm)
    hourlyChargeAmount: {
      type: Number,
      default: 0,
    },
    // Stolga biriktirilgan waiter
    assignedWaiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
    // Stol holati
    status: {
      type: String,
      enum: ["free", "occupied", "reserved"],
      default: "free",
    },
  },
  { timestamps: true }
);

tableSchema.index({ restaurantId: 1 });

const Table = mongoose.model("Table", tableSchema);

module.exports = Table;
