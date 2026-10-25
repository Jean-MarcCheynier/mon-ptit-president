const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

/** Waits for the latest email sent to `to` and returns the first link containing `path`. */
export async function linkFromLatestEmail(to: string, path: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    );
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    const latest = messages[0];
    if (latest) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${latest.ID}`);
      const { Text } = (await message.json()) as { Text: string };
      const link = Text.match(new RegExp(`https?://\\S*${path}\\?token=[\\w-]+`))?.[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No email with a ${path} link was sent to ${to}`);
}
