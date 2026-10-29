const ALLOWED_HOSTS = [/\.mzstatic\.com$/, /^coverartarchive\.org$/, /\.archive\.org$/];

// 앨범아트 중계 주소는 알려진 앨범아트 서버의 https 주소만 허용한다.
export function isAllowedArtworkUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && ALLOWED_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}
