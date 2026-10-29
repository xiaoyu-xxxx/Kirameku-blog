import { photowallUrl } from "@/lib/cdn";

export interface Photo {
  id: string;
  url: string;
  caption: string;
  orientation: "landscape" | "portrait" | "square";
}

export interface PhotoDay {
  date: string;
  label: string;
  photos: Photo[];
}

export const photoDays: PhotoDay[] = [
  {
    date: "2024-12-27",
    label: "2024年12月27日",
    photos: [
      { id: "119", url: photowallUrl("119.webp"), caption: "", orientation: "portrait" },
      { id: "121", url: photowallUrl("121.webp"), caption: "", orientation: "portrait" },
      { id: "127", url: photowallUrl("127.webp"), caption: "", orientation: "portrait" },
      { id: "130", url: photowallUrl("130.webp"), caption: "", orientation: "portrait" },
      { id: "133", url: photowallUrl("133.webp"), caption: "", orientation: "portrait" },
      { id: "134", url: photowallUrl("134.webp"), caption: "", orientation: "portrait" },
    ],
  },
  {
    date: "2024-12-15",
    label: "2024年12月15日",
    photos: [
      { id: "55", url: photowallUrl("55.webp"), caption: "", orientation: "landscape" },
      { id: "57", url: photowallUrl("57.webp"), caption: "", orientation: "landscape" },
      { id: "58", url: photowallUrl("58.webp"), caption: "", orientation: "landscape" },
      { id: "60", url: photowallUrl("60.webp"), caption: "", orientation: "landscape" },
      { id: "61", url: photowallUrl("61.webp"), caption: "", orientation: "landscape" },
      { id: "63", url: photowallUrl("63.webp"), caption: "", orientation: "landscape" },
    ],
  },
  {
    date: "2024-12-14",
    label: "2024年12月14日",
    photos: [
      { id: "20", url: photowallUrl("20.webp"), caption: "", orientation: "landscape" },
      { id: "34", url: photowallUrl("34.webp"), caption: "", orientation: "landscape" },
      { id: "36", url: photowallUrl("36.webp"), caption: "", orientation: "landscape" },
      { id: "39", url: photowallUrl("39.webp"), caption: "", orientation: "landscape" },
      { id: "41", url: photowallUrl("41.webp"), caption: "", orientation: "landscape" },
      { id: "42", url: photowallUrl("42.webp"), caption: "", orientation: "landscape" },
    ],
  },
];
