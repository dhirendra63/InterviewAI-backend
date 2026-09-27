import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";

import Resume from "../models/Resume.js";
import model from "../config/gemini.js";

const cleanJson = (text) => {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
};

const normalizeArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item) =>
        typeof item === "string" &&
        item.trim()
    )
    .map((item) => item.trim());
};

const normalizeScore = (value) => {
  const score = Number(value);

  if (Number.isNaN(score)) {
    return null;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(score))
  );
};

export const uploadResume = async (req, res) => {
  let resume;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Resume PDF is required",
      });
    }

    const filePath = path.resolve(
      req.file.path
    );

    const fileBuffer = await fs.readFile(
      filePath
    );

    const pdfData = await pdfParse(
      fileBuffer
    );

    const extractedText =
      pdfData.text?.trim();

    if (!extractedText) {
      await fs.unlink(filePath).catch(() => {});

      return res.status(400).json({
        success: false,
        message:
          "Could not extract text from this PDF",
      });
    }

    resume = await Resume.create({
      userId: req.user._id,
      fileName: req.file.originalname,
      filePath: req.file.path,
      extractedText,
      status: "analyzing",
    });

    const prompt = `
Analyze the following candidate resume.

Resume:
${extractedText}

Important rules:
- Use only information explicitly present in the resume.
- Never invent skills, projects, experience, education, certifications or achievements.
- If information is missing, return an empty array.
- Keep every array item concise.
- Score the resume from 0 to 100 based only on the quality and completeness of the provided resume.
- Recommendations must be based on actual weaknesses visible in the resume.
- Return only valid JSON.
- Do not include markdown.
- Do not include explanations outside JSON.

Return exactly:

{
  "summary": "",
  "skills": [],
  "technologies": [],
  "projects": [],
  "experience": [],
  "education": [],
  "certifications": [],
  "achievements": [],
  "strengths": [],
  "weaknesses": [],
  "recommendations": [],
  "score": 0
}
`;

    const result =
      await model.generateContent(
        prompt
      );

    const responseText =
      result.response.text();

    const analysis = JSON.parse(
      cleanJson(responseText)
    );

    resume.analysis = {
      summary:
        typeof analysis.summary ===
        "string"
          ? analysis.summary.trim()
          : "",
      skills: normalizeArray(
        analysis.skills
      ),
      technologies: normalizeArray(
        analysis.technologies
      ),
      projects: normalizeArray(
        analysis.projects
      ),
      experience: normalizeArray(
        analysis.experience
      ),
      education: normalizeArray(
        analysis.education
      ),
      certifications: normalizeArray(
        analysis.certifications
      ),
      achievements: normalizeArray(
        analysis.achievements
      ),
      strengths: normalizeArray(
        analysis.strengths
      ),
      weaknesses: normalizeArray(
        analysis.weaknesses
      ),
      recommendations: normalizeArray(
        analysis.recommendations
      ),
      score: normalizeScore(
        analysis.score
      ),
    };

    resume.status = "analyzed";
    resume.errorMessage = "";

    await resume.save();

    return res.status(201).json({
      success: true,
      message:
        "Resume analyzed successfully",
      resume,
    });
  } catch (error) {
    console.error(
      "Resume analysis error:",
      error
    );

    if (resume) {
      resume.status = "failed";
      resume.errorMessage =
        error.message ||
        "Resume analysis failed";

      await resume.save().catch(() => {});
    }

    res.status(503).json({
      success: false,
      message:
        "Resume analysis failed. Please try again.",
    });
  }
};

export const getResumes = async (
  req,
  res
) => {
  try {
    const resumes =
      await Resume.find({
        userId: req.user._id,
      }).sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      resumes,
    });
  } catch (error) {
    console.error(
      "Get resumes error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch resumes",
    });
  }
};

export const getResume = async (
  req,
  res
) => {
  try {
    const resume =
      await Resume.findOne({
        _id: req.params.id,
        userId: req.user._id,
      });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    res.status(200).json({
      success: true,
      resume,
    });
  } catch (error) {
    console.error(
      "Get resume error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch resume",
    });
  }
};

export const deleteResume = async (
  req,
  res
) => {
  try {
    const resume =
      await Resume.findOne({
        _id: req.params.id,
        userId: req.user._id,
      });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    if (resume.filePath) {
      await fs
        .unlink(
          path.resolve(resume.filePath)
        )
        .catch(() => {});
    }

    await resume.deleteOne();

    res.status(200).json({
      success: true,
      message:
        "Resume deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete resume error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to delete resume",
    });
  }
};