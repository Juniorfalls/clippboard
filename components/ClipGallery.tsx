import { ClipCard } from "@/components/ClipCard";
import type { Clip } from "@/lib/types";

export function ClipGallery({ clips }: { clips: Clip[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {clips.map((clip, i) => (
        <li key={clip.id}>
          <ClipCard clip={clip} index={i} />
        </li>
      ))}
    </ul>
  );
}
