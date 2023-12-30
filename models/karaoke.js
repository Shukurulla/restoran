const mongoose = require("mongoose");

const Karaoke = mongoose.model("karaoke", {
  title: {
    type: String,
  },
  persent: {
    type: Number,
    required: true,
  },
});

module.exports = Karaoke;
