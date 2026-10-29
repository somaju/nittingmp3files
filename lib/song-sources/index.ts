export type SongCandidate = {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  year?: number;
  artworkUrl?: string;
  // 사용자의 한글 이름으로 바꾸기 전 서비스의 원래 제목과 가수. 가사 검색에 쓴다.
  sourceTitle?: string;
  sourceArtist?: string;
  source: "itunes" | "musicbrainz";
};

export type LyricsResult = { plain: string } | null;
