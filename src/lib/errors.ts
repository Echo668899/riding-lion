export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  console.error(err);
  return Response.json(
    { error: { code: "internal_error", message: "Something went wrong." } },
    { status: 500 },
  );
}
