const mongoose = require("mongoose");

const Karaoke = mongoose.model("karaoke", {
  title: {
    type: String,
  },
  tableId: {
    type: String,
    required: true,
  },
  place: String,
  orderedAt: {
    type: String,
    default: new Date(),
  },
  agent: {
    type: Object,
    required: true,
  },
});

module.exports = Karaoke;
