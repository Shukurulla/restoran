const mongoose = require("mongoose");

const restaurantSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    address: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    logo: {
      type: String,
      default: "",
    },
    subscription: {
      plan: {
        type: String,
        enum: ["basic", "premium"],
        default: "basic",
      },
      startDate: {
        type: Date,
        default: Date.now,
      },
      endDate: {
        type: Date,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
      status: {
        type: String,
        enum: ["active", "warning", "blocked"],
        default: "active",
      },
    },
    settings: {
      sessionDuration: {
        type: Number,
        default: 60, // minutes
      },
      currency: {
        type: String,
        default: "UZS",
      },
      serviceFeePercent: {
        type: Number,
        default: 10,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Slug yaratish
restaurantSchema.pre("save", function (next) {
  if (this.isModified("name") && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

// Obuna holatini tekshirish
restaurantSchema.methods.checkSubscription = function () {
  const now = new Date();
  const endDate = new Date(this.subscription.endDate);
  const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) {
    this.subscription.status = "blocked";
  } else if (daysLeft <= 5) {
    this.subscription.status = "warning";
  } else {
    this.subscription.status = "active";
  }

  return {
    daysLeft: Math.max(0, daysLeft),
    status: this.subscription.status,
  };
};

const Restaurant = mongoose.model("Restaurant", restaurantSchema);

module.exports = Restaurant;
