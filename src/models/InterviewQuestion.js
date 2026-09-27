import mongoose from "mongoose";

const interviewQuestionSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview",
      required: true,
      index: true
    },

    question: {
      type: String,
      required: true
    },

    answer: {
      type: String,
      default: ""
    },

    transcript: {
      type: String,
      default: ""
    },

    evaluation: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    score: {
      type: Number,
      default: null
    },

    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model(
  "InterviewQuestion",
  interviewQuestionSchema
);