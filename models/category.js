const mongoose = require("mongoose");

const categorySchema = mongoose.Schema(
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
  },
  { timestamps: true }
);

categorySchema.index({ restaurantId: 1 });

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
