const mongoose = require("mongoose");

const Saved = mongoose.model("Saved", {
  savedOrder: {
    type: Object,
    required: true,
  },
});

module.exports = Saved;
