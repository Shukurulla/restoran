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
  },
  { timestamps: true }
);

tableSchema.index({ restaurantId: 1 });

const Table = mongoose.model("Table", tableSchema);

module.exports = Table;
