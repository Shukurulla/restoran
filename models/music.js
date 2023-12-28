const mongoose = require("mongoose");

const musicModel = mongoose.model("music", {
  tableId: {
    type: String,
    required: true,
  },
  music: {
    type: Object,
    musicName: {
      type: String,
      required: true,
    },
    isPlaying: Boolean,
    isEnding: Boolean,
  },
  orderedAt: String,
});

module.exports = musicModel;
