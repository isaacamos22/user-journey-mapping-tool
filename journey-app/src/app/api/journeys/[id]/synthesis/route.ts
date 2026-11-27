/** Discovery generation runs in Cursor (`discovery:apply`), not via this API. */
export async function POST() {
  return Response.json(
    {
      error:
        "In-app synthesis is disabled. Use Cursor chat: copy the Discovery prompt, then npm run discovery:apply.",
    },
    { status: 410 }
  );
}