import mongoose from "mongoose";

const voiceMetricsSchema = new mongoose.Schema(
  {
    speakingDuration: {
      type: Number,
      default: 0,
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    speakingRate: {
      type: Number,
      default: 0,
    },
    fillerWords: {
      type: Number,
      default: 0,
    },
    pauseCount: {
      type: Number,
      default: 0,
    },
    clarityScore: {
      type: Number,
      default: null,
    },
    communicationScore: {
      type: Number,
      default: null,
    },
    confidenceScore: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const evaluationSchema = new mongoose.Schema(
  {
    overallScore: {
      type: Number,
      default: null,
    },
    technicalAccuracy: {
      type: Number,
      default: null,
    },
    relevance: {
      type: Number,
      default: null,
    },
    clarity: {
      type: Number,
      default: null,
    },
    communication: {
      type: Number,
      default: null,
    },
    confidence: {
      type: Number,
      default: null,
    },
    completeness: {
      type: Number,
      default: null,
    },
    strengths: {
      type: [String],
      default: [],
    },
    improvements: {
      type: [String],
      default: [],
    },
    feedback: {
      type: String,
      default: "",
    },
    expectedAnswer: {
      type: String,
      default: "",
    },
    followUpRequired: {
      type: Boolean,
      default: false,
    },
    voiceMetrics: {
      type: voiceMetricsSchema,
      default: null,
    },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      default: "General",
    },
    answer: {
      type: String,
      default: "",
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    evaluation: {
      type: evaluationSchema,
      default: null,
    },
  },
  { _id: true }
);

const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    role: {
      type: String,
      required: true,
      trim: true,
    },

    experience: {
      type: String,
      required: true,
      enum: [
        "Fresher",
        "0-1 Years",
        "1-3 Years",
        "3-5 Years",
        "5+ Years",
      ],
    },

    mode: {
      type: String,
      required: true,
      enum: [
        "HR",
        "Technical",
        "Confidence",
        "Mixed",
      ],
    },

    difficulty: {
      type: String,
      required: true,
      enum: [
        "Easy",
        "Medium",
        "Hard",
        "Adaptive",
      ],
    },

    duration: {
      type: Number,
      required: true,
      enum: [10, 20, 30],
    },

    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      default: null,
    },

    questions: {
      type: [questionSchema],
      default: [],
    },

    status: {
      type: String,
      enum: [
        "created",
        "active",
        "completed",
        "cancelled",
      ],
      default: "created",
      index: true,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    overallScore: {
      type: Number,
      default: null,
    },

    technicalScore: {
      type: Number,
      default: null,
    },

    communicationScore: {
      type: Number,
      default: null,
    },

    confidenceScore: {
      type: Number,
      default: null,
    },

    problemSolvingScore: {
      type: Number,
      default: null,
    },

    relevanceScore: {
      type: Number,
      default: null,
    },

    answerQualityScore: {
      type: Number,
      default: null,
    },

    feedback: {
      type: String,
      default: "",
    },

    strengths: {
      type: [String],
      default: [],
    },

    weaknesses: {
      type: [String],
      default: [],
    },

    recommendations: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "Interview",
  interviewSchema
);