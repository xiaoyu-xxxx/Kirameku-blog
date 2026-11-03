import { request } from "./client";

export interface AlbumItem {
  id: number;
  title: string;
  description: string;
  cover: string;
  photo_count: number;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface PhotoItem {
  id: number;
  album_id: number;
  url: string;
  caption: string;
  orientation: string;
  sort: number;
  created_at: string;
}

export function getAlbums(init?: RequestInit) {
  return request<AlbumItem[]>("/api/albums", init);
}

export function getAlbumById(albumId: number) {
  return request<AlbumItem>(`/api/albums/${albumId}`);
}

export function getAlbumPhotos(albumId: number, init?: RequestInit) {
  return request<PhotoItem[]>(`/api/albums/${albumId}/photos`, init);
}
