const mongoose = require("mongoose");

const Karaoke = mongoose.model("karaoke", {
  title: {
    type: String,
  },
  persent: {
    type: Number,
    required: true,
  },
  agent: {
    type: Object,
    required: true,
  },
});

module.exports = Karaoke;
