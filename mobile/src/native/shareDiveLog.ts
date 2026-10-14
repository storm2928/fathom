import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { SessionResult } from '@fathom/game/session/sessionMachine';
import { buildDiveLog, downloadDiveLog } from '@fathom/game/surface/diveLog';
import type { InputCode } from '@fathom/game/surface/diveLog';

/**
 * Hands the dive log to the person, through the iOS share sheet — Files, Mail,
 * AirDrop, wherever they choose. The same JSON the website downloads, so the
 * two can be read side by side. Nothing is sent anywhere unless they send it.
 */
export async function shareDiveLog(result: SessionResult, plan: string, input: InputCode): Promise<void> {
  const entry = buildDiveLog(result, { plan, input });
  if (!Capacitor.isNativePlatform()) {
    downloadDiveLog(entry);
    return;
  }
  const stamp = entry.recordedAt.slice(0, 16).replace(/[:T]/g, '-');
  const { uri } = await Filesystem.writeFile({
    path: `fathom-dive-${stamp}.json`,
    data: JSON.stringify(entry, null, 2),
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: 'Fathom dive log', url: uri });
}
