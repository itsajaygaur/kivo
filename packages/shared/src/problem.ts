export function problem(
  status: number,
  title: string,
  detail: string,
  instance?: string,
): Response {
  return Response.json(
    { type: "about:blank", title, status, detail, instance },
    {
      status,
      headers: { "content-type": "application/problem+json", "cache-control": "no-store" },
    },
  );
}
