const errorMiddleware = (err, req, res, next) => {
  console.error(err);

  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size must be less than 5MB",
      });
    }

    return res.status(400).json({
      success: false,
      message: "File upload failed",
    });
  }

  if (err.message === "Only valid PDF files are allowed") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Invalid request data",
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid resource ID",
    });
  }

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Something went wrong. Please try again later."
        : err.message || "Request failed",
  });
};

export default errorMiddleware;