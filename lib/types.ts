export type Clip = {
  id: string;
  url: string;
  title: string;
  /** Length in seconds */
  duration: number;
  status: "completed";
};

export type GenerateClipsResponse = { clips: Clip[] };
export type ApiError = { error: string };
