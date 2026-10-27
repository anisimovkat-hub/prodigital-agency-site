export function isVercelPreview(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

export function assertTelegramDeliveryAllowed(): void {
  if (isVercelPreview()) throw new Error("Telegram delivery is disabled in Preview.");
}
