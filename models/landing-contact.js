const mongoose = require("mongoose");

const landingContactSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      default: null,
    },
    plan: {
      type: String,
      default: null,
    },
    source: {
      type: String,
      enum: ["contact_form", "pricing_modal"],
      default: "contact_form",
    },
    status: {
      type: String,
      enum: ["new", "contacted", "completed"],
      default: "new",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("LandingContact", landingContactSchema);
