import { ID3Writer } from "browser-id3-writer";
import { parseBlob } from "music-metadata";

export type TagValues = {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  lyrics?: string;
};

export type Picture = { data: Uint8Array; mime: string };

export async function readTags(
  blob: Blob,
): Promise<{ tags: TagValues; picture?: Picture }> {
  try {
    const { common } = await parseBlob(blob);
    const tags: TagValues = {};
    if (common.title) tags.title = common.title;
    if (common.artist) tags.artist = common.artist;
    if (common.album) tags.album = common.album;
    if (common.genre?.length) tags.genre = common.genre[0];
    if (common.year) tags.year = common.year;
    const lyric = common.lyrics?.[0];
    const lyrics = typeof lyric === "string" ? lyric : lyric?.text;
    if (lyrics) tags.lyrics = lyrics;
    const pic = common.picture?.[0];
    return {
      tags,
      ...(pic ? { picture: { data: pic.data, mime: pic.format } } : {}),
    };
  } catch {
    return { tags: {} };
  }
}

// 기존 ID3 태그는 새 태그로 교체되므로, 남기고 싶은 값은 호출하는 쪽에서 함께 넘긴다.
export async function writeTags(
  blob: Blob,
  tags: TagValues,
  picture?: Picture,
): Promise<Blob> {
  const writer = new ID3Writer(await blob.arrayBuffer());
  if (tags.title) writer.setFrame("TIT2", tags.title);
  if (tags.artist) writer.setFrame("TPE1", [tags.artist]);
  if (tags.album) writer.setFrame("TALB", tags.album);
  if (tags.genre) writer.setFrame("TCON", [tags.genre]);
  if (tags.year) writer.setFrame("TYER", tags.year);
  if (tags.lyrics) {
    writer.setFrame("USLT", { description: "", lyrics: tags.lyrics, language: "eng" });
  }
  if (picture) {
    const buffer = picture.data.buffer.slice(
      picture.data.byteOffset,
      picture.data.byteOffset + picture.data.byteLength,
    ) as ArrayBuffer;
    writer.setFrame("APIC", {
      type: 3,
      data: buffer,
      description: "",
      useUnicodeEncoding: false,
    });
  }
  writer.addTag();
  return writer.getBlob();
}
