const mongoose = require("mongoose");

const musicModel = mongoose.model("music", {
  tableId: {
    type: String,
    required: true,
  },
  music: {
    type: Object,
    required: true,
  },
  isPlaying: Boolean,
  isEnding: Boolean,
});

module.exports = musicModel;
