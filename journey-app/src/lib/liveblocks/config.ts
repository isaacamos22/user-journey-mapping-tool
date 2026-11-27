export function isLiveblocksConfigured(): boolean {
  return Boolean(process.env.LIVEBLOCKS_SECRET_KEY);
}

export function journeyRoomId(journeyId: string): string {
  return `journey:${journeyId}`;
}