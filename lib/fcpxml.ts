import type { Clip, TimeRange, TranscriptSegment } from "@/types/video";

const FRAME_RATE = 30;

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fcpxTime(seconds: number) {
  return `${Math.max(0, Math.round(seconds * FRAME_RATE))}/${FRAME_RATE}s`;
}

function mergeCuts(ranges: TimeRange[]) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  return sorted.reduce<TimeRange[]>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 0.02) {
      previous.end = Math.max(previous.end, range.end);
      return merged;
    }
    merged.push({ ...range });
    return merged;
  }, []);
}

function mapTimeThroughCuts(time: number, cuts: TimeRange[]) {
  let removed = 0;
  for (const cut of cuts) {
    if (time <= cut.start) break;
    if (time < cut.end) return Math.max(0, cut.start - removed);
    removed += cut.end - cut.start;
  }
  return Math.max(0, time - removed);
}

export function buildFCPXML(
  clip: Clip,
  transcript: TranscriptSegment[] = []
) {
  const activeCuts = mergeCuts([
    ...(clip.cutRanges ?? []),
    ...(clip.removeFiller ? clip.fillerCuts ?? [] : []),
  ])
    .map((range) => ({
      start: Math.max(0, range.start - clip.startTime),
      end: Math.min(clip.endTime, range.end) - clip.startTime,
    }))
    .filter((range) => range.end > range.start);

  const removedDuration = activeCuts.reduce(
    (total, range) => total + (range.end - range.start),
    0
  );
  const outputDuration = Math.max(0.1, clip.duration - removedDuration);

  const captions = transcript
    .filter(
      (segment) =>
        segment.end > clip.startTime && segment.start < clip.endTime
    )
    .map((segment) => {
      const rawStart = Math.max(0, segment.start - clip.startTime);
      const rawEnd = Math.min(clip.duration, segment.end - clip.startTime);
      return {
        start: mapTimeThroughCuts(rawStart, activeCuts),
        end: mapTimeThroughCuts(rawEnd, activeCuts),
        text: segment.text.trim().replace(/\s+/g, " "),
      };
    })
    .filter(
      (segment) =>
        segment.text.length > 0 && segment.end - segment.start >= 0.05
    );

  const captionTitles = captions
    .map((caption, index) => {
      const duration = Math.max(0.05, caption.end - caption.start);
      return [
        `          <title name="Caption ${index + 1}" lane="1" offset="${fcpxTime(
          caption.start
        )}" duration="${fcpxTime(duration)}" start="0s">`,
        "            <text>",
        `              <text-style ref="ts1">${xmlEscape(caption.text)}</text-style>`,
        "            </text>",
        "          </title>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat1080x1920p30" frameDuration="1/30s" width="1080" height="1920"/>
    <asset id="r2" name="${xmlEscape(clip.title)}.mp4" uid="clippboard-${xmlEscape(
    clip.id
  )}" start="0s" duration="${fcpxTime(clip.duration)}" hasVideo="1" hasAudio="1" format="r1"/>
    <text-style-def id="ts1">
      <text-style font="Inter" fontSize="72" fontColor="1 1 1 1" bold="1" alignment="center"/>
    </text-style-def>
  </resources>
  <library>
    <event name="Clippboard">
      <project name="${xmlEscape(clip.title)}">
        <sequence format="r1" duration="${fcpxTime(
          outputDuration
        )}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
            <asset-clip ref="r2" name="${xmlEscape(
              clip.title
            )}" offset="0s" start="${fcpxTime(
              clip.startTime
            )}" duration="${fcpxTime(outputDuration)}" format="r1" tcFormat="NDF">
${captionTitles}
            </asset-clip>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
}

export function downloadFCPXML(
  clip: Clip,
  transcript: TranscriptSegment[] = []
) {
  const xml = buildFCPXML(clip, transcript);
  const blob = new Blob([xml], { type: "application/xml" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `${
    clip.title.replace(/[^\w\s-]/g, "").trim() || "clip"
  }.fcpxml`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
