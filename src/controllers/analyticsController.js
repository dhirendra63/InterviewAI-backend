import Interview from "../models/Interview.js";

export const getAnalytics = async (req, res) => {
  try {
    const interviews = await Interview.find({
      userId: req.user._id,
      status: "completed",
    }).sort({
      completedAt: -1,
    });

    const totalInterviews = interviews.length;

    if (!totalInterviews) {
      return res.status(200).json({
        success: true,
        analytics: {
          totalInterviews: 0,
          averageScore: 0,
          technicalScore: 0,
          communicationScore: 0,
          confidenceScore: 0,
          problemSolvingScore: 0,
          relevanceScore: 0,
          answerQualityScore: 0,
          scoreTrend: [],
          modePerformance: [],
          recentInterviews: [],
        },
      });
    }

    const average = (field) => {
      const values = interviews
        .map((item) => Number(item[field]) || 0)
        .filter((value) => value > 0);

      if (!values.length) {
        return 0;
      }

      return Math.round(
        values.reduce(
          (sum, value) => sum + value,
          0
        ) / values.length
      );
    };

    const scoreTrend = interviews
      .slice()
      .reverse()
      .map((interview) => ({
        id: interview._id,
        date:
          interview.completedAt ||
          interview.createdAt,
        score: interview.overallScore || 0,
        role: interview.role,
      }));

    const modeMap = {};

    interviews.forEach((interview) => {
      const mode = interview.mode;

      if (!modeMap[mode]) {
        modeMap[mode] = {
          mode,
          interviews: 0,
          totalScore: 0,
        };
      }

      modeMap[mode].interviews += 1;

      modeMap[mode].totalScore +=
        Number(interview.overallScore) || 0;
    });

    const modePerformance = Object.values(
      modeMap
    ).map((item) => ({
      mode: item.mode,
      interviews: item.interviews,
      averageScore: Math.round(
        item.totalScore / item.interviews
      ),
    }));

    const recentInterviews =
      interviews.slice(0, 5).map(
        (interview) => ({
          id: interview._id,
          role: interview.role,
          mode: interview.mode,
          difficulty:
            interview.difficulty,
          score:
            interview.overallScore || 0,
          date:
            interview.completedAt ||
            interview.createdAt,
        })
      );

    return res.status(200).json({
      success: true,
      analytics: {
        totalInterviews,

        averageScore:
          average("overallScore"),

        technicalScore:
          average("technicalScore"),

        communicationScore:
          average("communicationScore"),

        confidenceScore:
          average("confidenceScore"),

        problemSolvingScore:
          average("problemSolvingScore"),

        relevanceScore:
          average("relevanceScore"),

        answerQualityScore:
          average("answerQualityScore"),

        scoreTrend,

        modePerformance,

        recentInterviews,
      },
    });
  } catch (error) {
    console.error(
      "Get analytics error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch analytics",
    });
  }
};