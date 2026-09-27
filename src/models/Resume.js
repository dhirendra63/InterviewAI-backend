import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    extractedText: {
      type: String,
      default: "",
    },
    analysis: {
      summary: {
        type: String,
        default: "",
      },
      skills: {
        type: [String],
        default: [],
      },
      technologies: {
        type: [String],
        default: [],
      },
      projects: {
        type: [String],
        default: [],
      },
      experience: {
        type: [String],
        default: [],
      },
      education: {
        type: [String],
        default: [],
      },
      certifications: {
        type: [String],
        default: [],
      },
      achievements: {
        type: [String],
        default: [],
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
      score: {
        type: Number,
        default: null,
      },
    },
    status: {
      type: String,
      enum: [
        "uploaded",
        "analyzing",
        "analyzed",
        "failed",
      ],
      default: "uploaded",
    },
    errorMessage: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "Resume",
  resumeSchema
);