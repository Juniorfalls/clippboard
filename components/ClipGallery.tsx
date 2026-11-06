import { ClipCard } from "@/components/ClipCard";
import type { Clip } from "@/types/video";

export function ClipGallery({
  clips,
  progressById,
}: {
  clips: Clip[];
  progressById: Record<string, number>;
}) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {clips.map((clip, i) => (
        <li key={clip.id}>
          <ClipCard clip={clip} index={i} progress={progressById[clip.id] ?? 0} />
        </li>
      ))}
    </ul>
  );
}
