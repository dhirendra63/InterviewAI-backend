import mongoose from "mongoose";
import Interview from "../models/Interview.js";
import Resume from "../models/Resume.js";
import model from "../config/gemini.js";
import User from "../models/User.js";
import CreditTransaction from "../models/CreditTransaction.js";

const allowedExperiences = [
  "Fresher",
  "0-1 Years",
  "1-3 Years",
  "3-5 Years",
  "5+ Years",
];

const allowedModes = [
  "HR",
  "Technical",
  "Confidence",
  "Mixed",
];

const allowedDifficulties = [
  "Easy",
  "Medium",
  "Hard",
  "Adaptive",
];

const allowedDurations = [10, 20, 30];

const getAverage = (evaluations, field) => {
  if (!evaluations.length) {
    return 0;
  }

  const total = evaluations.reduce(
    (sum, item) =>
      sum + (Number(item[field]) || 0),
    0
  );

  return Math.round(
    total / evaluations.length
  );
};

const finalizeInterview = (interview) => {
  const evaluations = interview.questions
    .map((item) => item.evaluation)
    .filter(Boolean);

  interview.overallScore =
    getAverage(evaluations, "overallScore");

  interview.technicalScore =
    getAverage(evaluations, "technicalAccuracy");

  interview.communicationScore =
    getAverage(evaluations, "communication");

  interview.confidenceScore =
    getAverage(evaluations, "confidence");

  interview.relevanceScore =
    getAverage(evaluations, "relevance");

  interview.answerQualityScore =
    getAverage(evaluations, "completeness");

  interview.problemSolvingScore =
    Math.round(
      (
        interview.relevanceScore +
        interview.answerQualityScore
      ) / 2
    );

  interview.strengths = [
    ...new Set(
      evaluations.flatMap((item) =>
        Array.isArray(item.strengths)
          ? item.strengths
          : []
      )
    ),
  ];

  interview.weaknesses = [
    ...new Set(
      evaluations.flatMap((item) =>
        Array.isArray(item.improvements)
          ? item.improvements
          : []
      )
    ),
  ];

  interview.recommendations =
    interview.weaknesses.slice(0, 5);

  interview.feedback = evaluations
    .map((item) => item.feedback)
    .filter(Boolean)
    .join(" ");

  interview.status = "completed";
  interview.completedAt = new Date();
};

const cleanGeminiJson = (text) => {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
};

export const createInterview = async (req, res) => {
  try {
    const {
      role,
      experience,
      mode,
      difficulty,
      duration,
      resumeId,
      resumeBased,
    } = req.body;

    if (
      !role ||
      !experience ||
      !mode ||
      !difficulty ||
      !duration
    ) {
      return res.status(400).json({
        success: false,
        message: "All interview fields are required",
      });
    }

    if (!allowedExperiences.includes(experience)) {
      return res.status(400).json({
        success: false,
        message: "Invalid experience level",
      });
    }

    if (!allowedModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid interview mode",
      });
    }

    if (!allowedDifficulties.includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: "Invalid difficulty",
      });
    }

    const numericDuration = Number(duration);

    if (!allowedDurations.includes(numericDuration)) {
      return res.status(400).json({
        success: false,
        message: "Invalid interview duration",
      });
    }

    const durationCredits = {
      10: 1,
      20: 2,
      30: 3,
    };

    let requiredCredits =
      durationCredits[numericDuration];

    if (resumeBased) {
      requiredCredits += 1;
    }

    const user = await User.findById(req.user._id);



    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (typeof user.credits !== "number") {
      user.credits = 10;
      await user.save();
    }

    if (user.credits < requiredCredits) {
      return res.status(402).json({
        success: false,
        message: "Insufficient credits",
        requiredCredits,
        availableCredits: user.credits,
      });
    }

    let resumeContext = "";

    if (resumeBased) {
      if (!resumeId) {
        return res.status(400).json({
          success: false,
          message:
            "Resume is required for resume-based interview",
        });
      }

      const resume = await Resume.findOne({
        _id: resumeId,
        userId: req.user._id,
      });

      if (!resume) {
        return res.status(404).json({
          success: false,
          message: "Resume not found",
        });
      }

      resumeContext = `
Resume Analysis:

Summary:
${resume.analysis?.summary || "Not available"}

Skills:
${resume.analysis?.skills?.join(", ") || "Not available"}

Technologies:
${resume.analysis?.technologies?.join(", ") || "Not available"}

Projects:
${resume.analysis?.projects?.join(", ") || "Not available"}

Experience:
${resume.analysis?.experience?.join(", ") || "Not available"}

Education:
${resume.analysis?.education?.join(", ") || "Not available"}

Strengths:
${resume.analysis?.strengths?.join(", ") || "Not available"}

Weaknesses:
${resume.analysis?.weaknesses?.join(", ") || "Not available"}
`;
    }

    let firstQuestion;

    try {
      const prompt = `
Generate the FIRST question for a realistic AI mock interview.

Role: ${role}
Experience: ${experience}
Interview Mode: ${mode}
Difficulty: ${difficulty}
Duration: ${numericDuration} minutes

${resumeContext}

Rules:
- Generate exactly ONE question.
- Match the selected role.
- Match the experience level.
- Match the interview mode.
- Match the difficulty.
- If resume information is provided, use only actual resume information.
- Do not invent candidate experience.
- Make the question feel like a real interviewer.
- Do not generate multiple questions.
- Do not include numbering.
- Do not include markdown.

Return ONLY valid JSON:

{
  "question": "Question text",
  "type": "Technical"
}
`;

      const result =
        await model.generateContent(prompt);

      const responseText =
        result.response.text();

      const cleanedText =
        cleanGeminiJson(responseText);

      const aiData =
        JSON.parse(cleanedText);

      if (
        !aiData.question ||
        typeof aiData.question !== "string"
      ) {
        throw new Error(
          "Invalid first question generated"
        );
      }

      firstQuestion = {
        question: aiData.question.trim(),
        type: aiData.type || mode,
      };
    } catch (aiError) {
      console.error(
        "Gemini first question generation unavailable:",
        aiError.message
      );

      const fallbackQuestions = {
        HR: `Tell me about yourself and why you are interested in working as a ${role}.`,
        Technical: `What are the most important technical skills required for a ${role}, and how have you used them?`,
        Confidence: `Tell me about yourself and explain one project you are confident discussing.`,
        Mixed: `Tell me about yourself and one project that is relevant to a ${role} position.`,
      };

      firstQuestion = {
        question:
          fallbackQuestions[mode] ||
          `Tell me about yourself and your experience related to ${role}.`,
        type: mode,
      };
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        credits: { $gte: requiredCredits },
      },
      {
        $inc: {
          credits: -requiredCredits,
        },
      },
      {
        new: true,
      }
    );

    if (!updatedUser) {
      return res.status(402).json({
        success: false,
        message: "Insufficient credits",
        requiredCredits,
      });
    }

    let interview;

    try {
      interview = await Interview.create({
        userId: req.user._id,
        role: role.trim(),
        experience,
        mode,
        difficulty,
        duration: numericDuration,
        resumeId:
          resumeBased && resumeId
            ? resumeId
            : null,
        questions: [firstQuestion],
        status: "created",
      });

      await CreditTransaction.create({
        userId: req.user._id,
        amount: -requiredCredits,
        type: "INTERVIEW",
        description: `Used ${requiredCredits} credit${requiredCredits > 1 ? "s" : ""
          } for ${numericDuration}-minute ${mode} interview`,
        interviewId: interview._id,
      });
    } catch (creationError) {
      await User.findByIdAndUpdate(
        req.user._id,
        {
          $inc: {
            credits: requiredCredits,
          },
        }
      );

      if (interview?._id) {
        await Interview.findByIdAndDelete(
          interview._id
        );
      }

      throw creationError;
    }

    return res.status(201).json({
      success: true,
      message: "Interview created successfully",
      interview,
      credits: {
        used: requiredCredits,
        remaining: updatedUser.credits,
      },
    });
  } catch (error) {
    console.error(
      "Create interview error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create interview",
    });
  }
};

export const submitAnswer = async (req, res) => {
  try {
    const {
      questionId,
      answer,
      voiceMetrics,
    } = req.body;

    if (
      !questionId ||
      !answer?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Question ID and answer are required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid interview ID",
      });
    }

    const interview =
      await Interview.findOne({
        _id: req.params.id,
        userId: req.user._id,
      });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    if (interview.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Interview is not active",
      });
    }

    if (
      interview.expiresAt &&
      new Date() >=
      new Date(interview.expiresAt)
    ) {
      finalizeInterview(interview);

      await interview.save();

      return res.status(400).json({
        success: false,
        message: "Interview time has expired",
        completed: true,
      });
    }

    const question =
      interview.questions.id(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    if (question.answer?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "This question has already been answered",
      });
    }

    const cleanAnswer = answer.trim();

    const previousAnswers =
      interview.questions
        .filter(
          (item) =>
            item.answer?.trim()
        )
        .map(
          (item, index) =>
            `Question ${index + 1}: ${item.question}\nAnswer: ${item.answer}`
        )
        .join("\n\n");

    let evaluation;
    let aiAvailable = true;

    try {
      const evaluationPrompt = `
Evaluate this candidate's answer in an AI mock interview.

Role: ${interview.role}
Experience: ${interview.experience}
Mode: ${interview.mode}
Difficulty: ${interview.difficulty}

Current Question:
${question.question}

Candidate Answer:
${cleanAnswer}

Previous Interview Context:
${previousAnswers || "No previous answers"}

Voice Metrics:
${voiceMetrics ? JSON.stringify(voiceMetrics) : "No voice metrics available"}

Use these metrics only as supporting communication signals. Do not diagnose emotions or mental state. Confidence is an estimate of interview communication confidence, not a psychological measurement.

Evaluate:
- Technical accuracy
- Relevance
- Clarity
- Communication
- Confidence
- Completeness

Return ONLY valid JSON:

{
  "overallScore": 0,
  "technicalAccuracy": 0,
  "relevance": 0,
  "clarity": 0,
  "communication": 0,
  "confidence": 0,
  "completeness": 0,
  "strengths": [],
  "improvements": [],
  "feedback": "",
  "expectedAnswer": "",
  "followUpRequired": false
}

Rules:
- Scores must be between 0 and 100.
- Evaluate the actual answer.
- Do not give a default score.
- Very short, meaningless or irrelevant answers should receive low scores.
- Do not invent candidate information.
- Return JSON only.
`;

      const result =
        await model.generateContent(
          evaluationPrompt
        );

      const responseText =
        result.response.text();

      const cleanedText =
        cleanGeminiJson(responseText);

      evaluation =
        JSON.parse(cleanedText);
    } catch (aiError) {
      aiAvailable = false;

      console.error(
        "Gemini evaluation unavailable:",
        aiError.message
      );

      const wordCount =
        cleanAnswer
          .split(/\s+/)
          .filter(Boolean).length;

      let fallbackScore = 0;

      if (wordCount <= 2) {
        fallbackScore = 5;
      } else if (wordCount <= 5) {
        fallbackScore = 10;
      } else if (wordCount <= 10) {
        fallbackScore = 20;
      } else if (wordCount <= 20) {
        fallbackScore = 30;
      } else if (wordCount <= 40) {
        fallbackScore = 40;
      } else if (wordCount <= 70) {
        fallbackScore = 50;
      } else {
        fallbackScore = 60;
      }

      evaluation = {
        overallScore: fallbackScore,
        technicalAccuracy: fallbackScore,
        relevance: fallbackScore,
        clarity: Math.min(
          fallbackScore + 5,
          100
        ),
        communication: Math.min(
          fallbackScore + 5,
          100
        ),
        confidence: fallbackScore,
        completeness: fallbackScore,
        strengths:
          fallbackScore >= 40
            ? [
              "Answer was recorded successfully",
            ]
            : [],
        improvements:
          fallbackScore < 40
            ? [
              "Provide a more detailed answer",
              "Keep the answer relevant to the question",
              "Add examples or reasoning",
            ]
            : [
              "Add more specific examples and technical details",
            ],
        feedback:
          fallbackScore <= 10
            ? "The answer is too short or does not provide meaningful information."
            : "AI evaluation was temporarily unavailable. A basic answer-quality score was calculated locally.",
        expectedAnswer: "",
        followUpRequired: false,
      };
    }

    const normalizedVoiceMetrics = voiceMetrics
      ? {
        speakingDuration: Math.max(0, Number(voiceMetrics.speakingDuration) || 0),
        wordCount: Math.max(0, Number(voiceMetrics.wordCount) || 0),
        speakingRate: Math.max(0, Number(voiceMetrics.speakingRate) || 0),
        fillerWords: Math.max(0, Number(voiceMetrics.fillerWords) || 0),
        pauseCount: Math.max(0, Number(voiceMetrics.pauseCount) || 0),
        clarityScore: Math.max(0, Math.min(100, Number(voiceMetrics.clarityScore) || 0)),
        communicationScore: Math.max(0, Math.min(100, Number(voiceMetrics.communicationScore) || 0)),
        confidenceScore: Math.max(0, Math.min(100, Number(voiceMetrics.confidenceScore) || 0)),
      }
      : null;

    if (normalizedVoiceMetrics) {
      evaluation.communication = Math.round(
        (Number(evaluation.communication) || 0) * 0.7 +
        normalizedVoiceMetrics.communicationScore * 0.3
      );

      evaluation.confidence = Math.round(
        (Number(evaluation.confidence) || 0) * 0.7 +
        normalizedVoiceMetrics.confidenceScore * 0.3
      );

      evaluation.clarity = Math.round(
        (Number(evaluation.clarity) || 0) * 0.7 +
        normalizedVoiceMetrics.clarityScore * 0.3
      );

      if (!aiAvailable) {
        const voiceOverall =
          normalizedVoiceMetrics.communicationScore * 0.4 +
          normalizedVoiceMetrics.confidenceScore * 0.3 +
          normalizedVoiceMetrics.clarityScore * 0.3;

        evaluation.overallScore = Math.round(
          evaluation.overallScore * 0.7 +
          voiceOverall * 0.3
        );
      }
    }

    const scoreFields = [
      "overallScore",
      "technicalAccuracy",
      "relevance",
      "clarity",
      "communication",
      "confidence",
      "completeness",
    ];

    for (const field of scoreFields) {
      if (
        typeof evaluation[field] !==
        "number" ||
        evaluation[field] < 0 ||
        evaluation[field] > 100
      ) {
        evaluation[field] = 0;
      }
    }

    question.answer = cleanAnswer;
    question.answeredAt = new Date();

    question.evaluation = {
      overallScore:
        evaluation.overallScore,
      technicalAccuracy:
        evaluation.technicalAccuracy,
      relevance:
        evaluation.relevance,
      clarity:
        evaluation.clarity,
      communication:
        evaluation.communication,
      confidence:
        evaluation.confidence,
      completeness:
        evaluation.completeness,
      strengths:
        Array.isArray(
          evaluation.strengths
        )
          ? evaluation.strengths
          : [],
      improvements:
        Array.isArray(
          evaluation.improvements
        )
          ? evaluation.improvements
          : [],
      feedback:
        evaluation.feedback || "",
      expectedAnswer:
        evaluation.expectedAnswer || "",
      followUpRequired:
        Boolean(
          evaluation.followUpRequired
        ),
      voiceMetrics: normalizedVoiceMetrics,
    };

    let adaptiveDifficulty =
      interview.difficulty;

    if (
      interview.difficulty ===
      "Adaptive"
    ) {
      if (
        evaluation.overallScore >= 80
      ) {
        adaptiveDifficulty = "Hard";
      } else if (
        evaluation.overallScore >= 60
      ) {
        adaptiveDifficulty = "Medium";
      } else {
        adaptiveDifficulty = "Easy";
      }
    } else {
      adaptiveDifficulty =
        interview.difficulty;
    }

    let nextQuestion = null;

    const answeredCount =
      interview.questions.filter(
        (item) =>
          item.answer?.trim()
      ).length;

    const maxQuestions = 10;

    if (
      answeredCount < maxQuestions
    ) {
      try {
        const nextQuestionPrompt = `
You are conducting a realistic AI mock interview.

Generate the NEXT interview question.

Role: ${interview.role}
Experience: ${interview.experience}
Interview Mode: ${interview.mode}
Current Adaptive Difficulty: ${adaptiveDifficulty}

Previous Questions and Answers:
${previousAnswers || "No previous answers"}

Current Question:
${question.question}

Current Candidate Answer:
${cleanAnswer}

Current Evaluation:
Overall Score: ${evaluation.overallScore}
Technical Accuracy: ${evaluation.technicalAccuracy}
Relevance: ${evaluation.relevance}
Communication: ${evaluation.communication}
Confidence: ${evaluation.confidence}
Completeness: ${evaluation.completeness}

Rules:
- Generate exactly ONE question.
- The question must build on the candidate's previous performance.
- Do not repeat previous questions.
- If the candidate performed well, increase the challenge.
- If the candidate struggled, simplify the question.
- Match the selected role.
- Match the selected interview mode.
- Match the candidate's experience.
- Make it feel like a real interviewer.
- If the answer has an interesting point, ask a useful follow-up.
- Do not invent resume information.
- Return JSON only.

Return:

{
  "question": "Next question",
  "type": "Technical"
}
`;

        const nextResult =
          await model.generateContent(
            nextQuestionPrompt
          );

        const nextResponseText =
          nextResult.response.text();

        const cleanedNextText =
          cleanGeminiJson(
            nextResponseText
          );

        const nextData =
          JSON.parse(
            cleanedNextText
          );

        if (
          nextData.question &&
          typeof nextData.question ===
          "string"
        ) {
          nextQuestion = {
            _id: new mongoose.Types.ObjectId(),
            question:
              nextData.question.trim(),
            type:
              nextData.type ||
              interview.mode,
          };
        }
      } catch (nextError) {
        console.error(
          "Next question generation unavailable:",
          nextError.message
        );
      }
    }

    if (!nextQuestion) {
      const fallbackNextQuestions = {
        HR: [
          "What motivates you to grow in your career?",
          "Tell me about a challenge you faced and how you handled it.",
          "Where do you see yourself professionally in the next few years?",
          "How do you handle disagreements with your teammates?",
          "Tell me about a time when you had to learn something quickly.",
          "How do you prioritize tasks when you have multiple deadlines?",
          "Tell me about a mistake you made and what you learned from it.",
          "What kind of work environment helps you perform at your best?",
          "How do you handle constructive criticism?",
          "Why are you interested in this role?",
        ],

        Technical: [
          `Explain one important technical concept you would use as a ${interview.role}.`,
          "Describe a technical problem you have solved and how you approached it.",
          `How would you improve the performance of a ${interview.role} project?`,
          "How do you debug a problem when you do not know its exact cause?",
          "Explain how you would design a maintainable software project.",
          "What is one technical decision you made in a project and why?",
          "How do you make sure your code is reliable and easy to maintain?",
          "Explain the difference between a good solution and an optimized solution.",
          "How would you handle a bug that appears only in production?",
          "What technical skill are you currently working to improve?",
        ],

        Confidence: [
          "Tell me about a project you are proud of.",
          "What is one professional weakness you are working to improve?",
          "How do you handle difficult questions during an interview?",
          "Tell me about a situation where you had to take responsibility.",
          "How do you stay confident when working on an unfamiliar problem?",
          "Describe a situation where you had to speak in front of others.",
          "How do you react when your first solution does not work?",
          "Tell me about a time when you received difficult feedback.",
          "How do you communicate your ideas when others disagree with you?",
          "What makes you confident about your ability to succeed in this role?",
        ],

        Mixed: [
          `What makes you a good candidate for a ${interview.role} position?`,
          "Describe a challenging project and how you solved it.",
          "What technical skill would you like to improve further?",
          "How do you handle a disagreement with a teammate?",
          "Explain a technical problem you solved recently.",
          "How do you prioritize tasks when working on a project?",
          "Tell me about a mistake you made and what you learned from it.",
          "How would you improve the performance of one of your projects?",
          "How do you learn a new technology?",
          "Where do you see yourself growing professionally?",
        ],
      };

      const questions =
        fallbackNextQuestions[interview.mode] ||
        fallbackNextQuestions.Mixed;

      const usedQuestions = new Set(
        interview.questions.map((item) =>
          item.question?.trim().toLowerCase()
        )
      );

      const availableQuestions = questions.filter(
        (item) =>
          !usedQuestions.has(
            item.trim().toLowerCase()
          )
      );

      const selectedQuestion =
        availableQuestions[0] ||
        `Tell me about your experience and approach as a ${interview.role}.`;

      nextQuestion = {
        _id: new mongoose.Types.ObjectId(),
        question: selectedQuestion,
        type: interview.mode,
      };
    }

    if (nextQuestion) {
      interview.questions.push(
        nextQuestion
      );
    }

    const newAnsweredCount =
      interview.questions.filter(
        (item) =>
          item.answer?.trim()
      ).length;

    if (
      newAnsweredCount >=
      maxQuestions
    ) {
      finalizeInterview(interview);
    }

    await interview.save();

    const totalQuestions =
      interview.questions.length;

    return res.status(200).json({
      success: true,
      message: aiAvailable
        ? "Answer evaluated successfully"
        : "Answer recorded with local evaluation",
      evaluation: question.evaluation,
      nextQuestion:
        interview.status ===
          "completed"
          ? null
          : nextQuestion,
      adaptiveDifficulty,
      aiAvailable,
      progress: {
        current: newAnsweredCount,
        total: Math.min(
          maxQuestions,
          totalQuestions
        ),
      },
      completed:
        interview.status ===
        "completed",
    });
  } catch (error) {
    console.error(
      "Submit answer error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to submit answer",
    });
  }
};

export const getInterview = async (
  req,
  res
) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid interview ID",
      });
    }

    const interview =
      await Interview.findOne({
        _id: req.params.id,
        userId: req.user._id,
      });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    if (
      interview.status === "active" &&
      interview.expiresAt &&
      new Date() >=
      new Date(interview.expiresAt)
    ) {
      finalizeInterview(interview);

      await interview.save();
    }

    return res.status(200).json({
      success: true,
      interview,
    });
  } catch (error) {
    console.error(
      "Get interview error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch interview",
    });
  }
};

export const getInterviews = async (
  req,
  res
) => {
  try {
    const interviews =
      await Interview.find({
        userId: req.user._id,
      }).sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      interviews,
    });
  } catch (error) {
    console.error(
      "Get interviews error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch interviews",
    });
  }
};

export const startInterview = async (
  req,
  res
) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid interview ID",
      });
    }

    const interview =
      await Interview.findOne({
        _id: req.params.id,
        userId: req.user._id,
      });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    if (
      interview.status ===
      "completed"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Interview has already been completed",
      });
    }

    if (
      interview.status ===
      "cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Interview has been cancelled",
      });
    }

    if (
      interview.status ===
      "active"
    ) {
      if (
        interview.expiresAt &&
        new Date() >=
        new Date(interview.expiresAt)
      ) {
        finalizeInterview(interview);

        await interview.save();

        return res.status(400).json({
          success: false,
          message:
            "Interview time has expired",
          completed: true,
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Interview is already active",
        interview,
      });
    }

    interview.status = "active";

    interview.startedAt =
      new Date();

    interview.expiresAt =
      new Date(
        Date.now() +
        interview.duration *
        60 *
        1000
      );

    await interview.save();

    return res.status(200).json({
      success: true,
      message:
        "Interview started",
      interview,
    });
  } catch (error) {
    console.error(
      "Start interview error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to start interview",
    });
  }
};

export const cancelInterview = async (
  req,
  res
) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(
        req.params.id
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid interview ID",
      });
    }

    const interview =
      await Interview.findOne({
        _id: req.params.id,
        userId: req.user._id,
      });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    if (
      interview.status ===
      "completed"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Completed interview cannot be cancelled",
      });
    }

    if (
      interview.status ===
      "cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Interview is already cancelled",
      });
    }

    interview.status = "cancelled";

    await interview.save();

    return res.status(200).json({
      success: true,
      message:
        "Interview cancelled",
      interview,
    });
  } catch (error) {
    console.error(
      "Cancel interview error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to cancel interview",
    });
  }
};