export const VERSION = "1.0.0";

export function cmdVersion(): void {
  process.stdout.write(`flight-monitor ${VERSION}\n`);
}
